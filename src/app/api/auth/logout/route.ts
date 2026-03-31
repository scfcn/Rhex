import { NextResponse } from "next/server"

import { createRouteHandler } from "@/lib/api-route"
import { getSessionClearedCookieOptions, getSessionCookieName } from "@/lib/session"

export const POST = createRouteHandler(async () => {
  const response = NextResponse.json({ code: 0, message: "success" })

  response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions())

  return response
}, {
  errorMessage: "退出登录失败",
  logPrefix: "[api/auth/logout] unexpected error",
})


