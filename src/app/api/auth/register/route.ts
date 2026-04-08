import { NextResponse } from "next/server"

import { apiError, apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createRegisterFlow } from "@/lib/auth-register-service"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { validateAuthPayload } from "@/lib/validators"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const validated = validateAuthPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const payload = validated.data
  const dedupeKey = JSON.stringify({
    username: payload.username,
    nickname: payload.nickname,
    inviterUsername: payload.inviterUsername,
    inviteCode: payload.inviteCode,
    email: payload.email,
    emailCode: payload.emailCode,
    phone: payload.phone,
    phoneCode: payload.phoneCode,
    gender: payload.gender,
    captchaToken: readOptionalStringField(body, "captchaToken"),
    builtinCaptchaCode: readOptionalStringField(body, "builtinCaptchaCode"),
    powNonce: readOptionalStringField(body, "powNonce"),
  })

  return withRequestWriteGuard({
    request,
    scope: "auth-register",
    cooldownMs: 2_000,
    cooldownMessage: "注册提交过于频繁，请稍后再试",
    dedupeKey,
    dedupeWindowMs: 10_000,
  }, async () => {
    const result = await createRegisterFlow({ request, body })
    const responseMessage = result.successMessage ?? "注册成功"

    const response = NextResponse.json(apiSuccess(
      { username: result.user.username, autoLogin: true },
      responseMessage,
    ))

    try {
      const sessionToken = await createSessionToken(result.user.username, getRequestIp(request))
      response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())
    } catch (error) {
      console.error("[api/auth/register] auto login failed after successful registration", {
        error,
        userId: result.user.id,
        username: result.user.username,
      })

      try {
        logRouteWriteSuccess({
          scope: "auth-register",
          action: "register",
        }, {
          userId: result.user.id,
          targetId: result.user.username,
          extra: {
            registerIp: result.registerIp,
            invited: result.invited,
            autoLoginFailed: true,
          },
        })
      } catch (logError) {
        console.error("[api/auth/register] success logging failed after auto login failure", {
          error: logError,
          userId: result.user.id,
          username: result.user.username,
        })
      }

      return NextResponse.json(apiSuccess(
        { username: result.user.username, autoLogin: false },
        "注册成功，但自动登录失败，请前往登录页登录",
      ))
    }

    try {
      logRouteWriteSuccess({
        scope: "auth-register",
        action: "register",
      }, {
        userId: result.user.id,
        targetId: result.user.username,
        extra: {
          registerIp: result.registerIp,
          invited: result.invited,
        },
      })
    } catch (logError) {
      console.error("[api/auth/register] success logging failed after successful registration", {
        error: logError,
        userId: result.user.id,
        username: result.user.username,
      })
    }

    return response
  })
}, {
  errorMessage: "注册失败",
  logPrefix: "[api/auth/register] unexpected error",
})
