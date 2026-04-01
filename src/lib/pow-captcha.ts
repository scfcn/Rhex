import crypto from "node:crypto"

import { createRequestControl, purgeExpiredRequestControls } from "@/db/write-guard-queries"
import { Prisma } from "@/db/types"
import { PublicRouteError } from "@/lib/public-route-error"

const DEFAULT_POW_DIFFICULTY = 5
const DEFAULT_POW_EXPIRE_SECONDS = 40
const POW_CONSUME_SCOPE = "pow-captcha-consume"
const POW_CONSUME_KIND = "pow"
const POW_PURGE_SAMPLING_RATE = 0.01

export type PowCaptchaScope = "login" | "register"

export interface PowCaptchaChallenge {
  challenge: string
  difficulty: number
  expiresAt: number
}

interface CreatePowCaptchaChallengeOptions {
  scope: PowCaptchaScope
  requestIp?: string | null
}

interface VerifyPowCaptchaSolutionOptions {
  challenge: string | undefined
  nonce: unknown
  scope: PowCaptchaScope
  requestIp?: string | null
}

function resolveSecret() {
  const secret = process.env.POW_CAPTCHA_SECRET_KEY?.trim()
    || process.env.CAPTCHA_SECRET_KEY?.trim()
    || process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    throw new Error("缺少 POW_CAPTCHA_SECRET_KEY、CAPTCHA_SECRET_KEY 或 TURNSTILE_SECRET_KEY，无法校验 PoW 验证码")
  }

  return secret
}

function parseConfigInteger(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function createSignature(payload: string) {
  return crypto.createHmac("sha256", resolveSecret()).update(payload).digest("hex")
}

function createContextHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function verifySignature(payload: string, signature: string) {
  const expected = Buffer.from(createSignature(payload), "utf8")
  const received = Buffer.from(signature, "utf8")

  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

function normalizeNonce(raw: unknown) {
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) {
    return String(raw)
  }

  if (typeof raw === "string") {
    const value = raw.trim()
    if (/^\d{1,18}$/.test(value)) {
      return value
    }
  }

  throw new PublicRouteError("工作量证明参数错误，请重新验证")
}

function normalizeScope(raw: unknown): PowCaptchaScope {
  const scope = String(raw ?? "").trim().toLowerCase()

  if (scope === "login" || scope === "register") {
    return scope
  }

  throw new PublicRouteError("工作量证明场景参数错误，请刷新后重试")
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function getRequestIpHash(requestIp?: string | null) {
  return createContextHash(requestIp?.trim().toLowerCase() || "anonymous")
}

function shouldPurgeExpiredPowControls() {
  return Math.random() < POW_PURGE_SAMPLING_RATE
}

function parseChallenge(challenge: string) {
  const parts = challenge.split("-")

  if (parts.length !== 8) {
    throw new PublicRouteError("工作量证明挑战格式错误，请刷新后重试")
  }

  const [randomData, issuedAtRaw, expiresAtRaw, difficultyRaw, scopeRaw, ipHash, challengeId, signature] = parts
  const scope = normalizeScope(scopeRaw)
  const payload = `${randomData}-${issuedAtRaw}-${expiresAtRaw}-${difficultyRaw}-${scope}-${ipHash}-${challengeId}`
  const issuedAt = Number.parseInt(issuedAtRaw, 10)
  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  const difficulty = Number.parseInt(difficultyRaw, 10)

  if (!randomData || !ipHash || !challengeId || !signature || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(difficulty)) {
    throw new PublicRouteError("工作量证明挑战格式错误，请刷新后重试")
  }

  return {
    challengeId,
    difficulty,
    expiresAt,
    ipHash,
    payload,
    randomData,
    scope,
    signature,
  }
}

async function consumePowChallenge(challengeId: string, scope: PowCaptchaScope, expiresAt: number) {
  try {
    if (shouldPurgeExpiredPowControls()) {
      await purgeExpiredRequestControls(new Date())
    }

    await createRequestControl({
      scope: POW_CONSUME_SCOPE,
      identity: `scope:${scope}`,
      kind: POW_CONSUME_KIND,
      fingerprint: challengeId,
      expiresAt: new Date(expiresAt),
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PublicRouteError("工作量证明已被使用，请重新验证")
    }

    throw error
  }
}

export function hasPowCaptchaSecret() {
  return Boolean(
    process.env.POW_CAPTCHA_SECRET_KEY?.trim()
    || process.env.CAPTCHA_SECRET_KEY?.trim()
    || process.env.TURNSTILE_SECRET_KEY?.trim(),
  )
}

export function getPowCaptchaDifficulty() {
  return parseConfigInteger(process.env.POW_CAPTCHA_DIFFICULTY, DEFAULT_POW_DIFFICULTY, 1, 6)
}

export function getPowCaptchaExpireSeconds() {
  return parseConfigInteger(process.env.POW_CAPTCHA_EXPIRE_SECONDS, DEFAULT_POW_EXPIRE_SECONDS, 15, 300)
}

export function parsePowCaptchaScope(raw: unknown): PowCaptchaScope {
  return normalizeScope(raw)
}

export function createPowCaptchaChallenge(options: CreatePowCaptchaChallengeOptions): PowCaptchaChallenge {
  const randomData = crypto.randomBytes(16).toString("hex")
  const challengeId = crypto.randomBytes(12).toString("hex")
  const issuedAt = Date.now()
  const expiresAt = issuedAt + getPowCaptchaExpireSeconds() * 1000
  const difficulty = getPowCaptchaDifficulty()
  const scope = normalizeScope(options.scope)
  const ipHash = getRequestIpHash(options.requestIp)
  const payload = `${randomData}-${issuedAt}-${expiresAt}-${difficulty}-${scope}-${ipHash}-${challengeId}`
  const signature = createSignature(payload)

  return {
    challenge: `${payload}-${signature}`,
    difficulty,
    expiresAt,
  }
}

export async function verifyPowCaptchaSolution(options: VerifyPowCaptchaSolutionOptions) {
  if (!options.challenge) {
    throw new PublicRouteError("工作量证明已失效，请刷新后重试")
  }

  const challengeData = parseChallenge(options.challenge)

  if (!verifySignature(challengeData.payload, challengeData.signature)) {
    throw new PublicRouteError("工作量证明已失效，请刷新后重试")
  }

  if (challengeData.expiresAt < Date.now()) {
    throw new PublicRouteError("工作量证明已过期，请刷新后重试")
  }

  if (challengeData.difficulty < 1 || challengeData.difficulty > 6) {
    throw new PublicRouteError("工作量证明参数错误，请刷新后重试")
  }

  if (challengeData.scope !== normalizeScope(options.scope)) {
    throw new PublicRouteError("工作量证明场景不匹配，请刷新后重试")
  }

  if (challengeData.ipHash !== getRequestIpHash(options.requestIp)) {
    throw new PublicRouteError("工作量证明上下文不匹配，请刷新后重试")
  }

  const normalizedNonce = normalizeNonce(options.nonce)
  const hash = crypto.createHash("sha256").update(`${challengeData.randomData}${normalizedNonce}`).digest("hex")

  if (!hash.startsWith("0".repeat(challengeData.difficulty))) {
    throw new PublicRouteError("工作量证明验证失败，请重新计算")
  }

  await consumePowChallenge(challengeData.challengeId, challengeData.scope, challengeData.expiresAt)

  return true
}
