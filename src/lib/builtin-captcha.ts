import crypto from "node:crypto"

import { PublicRouteError } from "@/lib/public-route-error"
import { createRedisKey } from "@/lib/redis"
import { acquireRedisLease } from "@/lib/redis-lease"

const BUILTIN_CAPTCHA_CONSUME_SCOPE = "builtin-captcha-consume"

export function hasBuiltinCaptchaSecret() {
  return Boolean(process.env.CAPTCHA_SECRET_KEY?.trim())
}

function resolveSecret() {
  const secret = process.env.CAPTCHA_SECRET_KEY?.trim()

  if (!secret) {
    throw new Error("缺少 CAPTCHA_SECRET_KEY 环境变量，无法校验内建验证码")
  }

  return secret
}


function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url")
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8")
}

async function consumeBuiltinCaptchaToken(tokenNonce: string, expiresAt: number) {
  const lease = await acquireRedisLease({
    key: createRedisKey(BUILTIN_CAPTCHA_CONSUME_SCOPE, tokenNonce),
    ttlMs: Math.max(1, expiresAt - Date.now()),
  })

  if (!lease) {
    throw new PublicRouteError("验证码已被使用，请刷新后重试")
  }
}

export function createBuiltinCaptchaToken(text: string, expiresAt: number) {
  const payload = JSON.stringify({ text, expiresAt, nonce: crypto.randomUUID() })
  const encodedPayload = base64UrlEncode(payload)
  const signature = crypto.createHmac("sha256", resolveSecret()).update(encodedPayload).digest("base64url")
  return `${encodedPayload}.${signature}`
}

export async function verifyBuiltinCaptchaToken(token: string | undefined, input: string) {
  if (!token) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const expectedSignature = crypto.createHmac("sha256", resolveSecret()).update(encodedPayload).digest("base64url")
  if (signature !== expectedSignature) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { text?: string; expiresAt?: number; nonce?: string }
  if (!payload.text || !payload.expiresAt || !payload.nonce || payload.expiresAt < Date.now()) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  if (payload.text.toUpperCase() !== input.trim().toUpperCase()) {
    throw new PublicRouteError("验证码错误")
  }

  await consumeBuiltinCaptchaToken(payload.nonce, payload.expiresAt)

  return true
}
