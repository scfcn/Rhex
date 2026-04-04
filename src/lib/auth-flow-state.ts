import { createHmac, timingSafeEqual } from "node:crypto"

import type { NextResponse } from "next/server"
import { cookies } from "next/headers"

import type { OAuthFlowState, PasskeyCeremonyState, PendingExternalAuthState } from "@/lib/external-auth-types"

const PENDING_AUTH_COOKIE_NAME = "bbs_pending_auth"
const PASSKEY_REGISTER_COOKIE_NAME = "bbs_passkey_register"
const PASSKEY_LOGIN_COOKIE_NAME = "bbs_passkey_login"
const PASSKEY_CONNECT_COOKIE_NAME = "bbs_passkey_connect"

function getAuthFlowSecret() {
  const secret = process.env.AUTH_FLOW_SECRET?.trim() || process.env.SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error("缺少 AUTH_FLOW_SECRET 或 SESSION_SECRET 环境变量")
  }

  return secret
}

function encodePayload(payload: string) {
  return Buffer.from(payload, "utf8").toString("base64url")
}

function decodePayload(payload: string) {
  return Buffer.from(payload, "base64url").toString("utf8")
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthFlowSecret()).update(payload).digest("hex")
}

function verifySignature(payload: string, signature: string) {
  const expected = signPayload(payload)
  const left = Buffer.from(signature, "utf8")
  const right = Buffer.from(expected, "utf8")

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

function createSignedValue<T extends object>(value: T, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const payload = encodePayload(JSON.stringify({ ...value, expiresAt }))
  const signature = signPayload(payload)
  return `${payload}.${signature}`
}

function parseSignedValue<T extends object>(token: string | undefined) {
  if (!token) {
    return null
  }

  const [payload, signature] = token.split(".")

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null
  }

  try {
    const parsed = JSON.parse(decodePayload(payload)) as T & { expiresAt?: number }
    if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number") {
      return null
    }

    if (parsed.expiresAt <= Date.now()) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

function clearCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, "", getCookieOptions(0))
}

function setCookie<T extends object>(response: NextResponse, cookieName: string, value: T, ttlSeconds: number) {
  response.cookies.set(cookieName, createSignedValue(value, ttlSeconds), getCookieOptions(ttlSeconds))
}

async function readCookieValue<T extends object>(cookieName: string) {
  const cookieStore = await cookies()
  const rawValue = cookieStore.get(cookieName)?.value
  return parseSignedValue<T>(rawValue)
}

export function buildOAuthStateCookieName(provider: string) {
  return `bbs_oauth_${provider}`
}

export function setOAuthFlowState(response: NextResponse, provider: string, value: OAuthFlowState, ttlSeconds = 600) {
  setCookie(response, buildOAuthStateCookieName(provider), value, ttlSeconds)
}

export async function readOAuthFlowState(provider: string) {
  return readCookieValue<OAuthFlowState>(buildOAuthStateCookieName(provider))
}

export function clearOAuthFlowState(response: NextResponse, provider: string) {
  clearCookie(response, buildOAuthStateCookieName(provider))
}

export function setPendingExternalAuthState(response: NextResponse, value: PendingExternalAuthState, ttlSeconds = 900) {
  setCookie(response, PENDING_AUTH_COOKIE_NAME, value, ttlSeconds)
}

export async function readPendingExternalAuthState() {
  return readCookieValue<PendingExternalAuthState>(PENDING_AUTH_COOKIE_NAME)
}

export function clearPendingExternalAuthState(response: NextResponse) {
  clearCookie(response, PENDING_AUTH_COOKIE_NAME)
}

function getPasskeyCeremonyCookieName(flow: "register" | "login" | "connect") {
  if (flow === "register") {
    return PASSKEY_REGISTER_COOKIE_NAME
  }

  if (flow === "connect") {
    return PASSKEY_CONNECT_COOKIE_NAME
  }

  return PASSKEY_LOGIN_COOKIE_NAME
}

export function setPasskeyCeremonyState(response: NextResponse, flow: "register" | "login" | "connect", value: PasskeyCeremonyState, ttlSeconds = 600) {
  setCookie(response, getPasskeyCeremonyCookieName(flow), value, ttlSeconds)
}

export async function readPasskeyCeremonyState(flow: "register" | "login" | "connect") {
  return readCookieValue<PasskeyCeremonyState>(getPasskeyCeremonyCookieName(flow))
}

export function clearPasskeyCeremonyState(response: NextResponse, flow: "register" | "login" | "connect") {
  clearCookie(response, getPasskeyCeremonyCookieName(flow))
}
