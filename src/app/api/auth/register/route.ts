import { NextResponse } from "next/server"

import { apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { createRegisterFlow } from "@/lib/auth-register-service"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const result = await createRegisterFlow({ request, body })

  const response = NextResponse.json(apiSuccess(
    { username: result.user.username },
    result.successMessage,
  ))

  const sessionToken = await createSessionToken(result.user.username, getRequestIp(request))
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())

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

  return response
}, {
  errorMessage: "注册失败",
  logPrefix: "[api/auth/register] unexpected error",
})
