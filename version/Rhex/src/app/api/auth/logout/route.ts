import { NextResponse } from "next/server"

import { createRouteHandler } from "@/lib/api-route"
import { getSessionCookieName } from "@/lib/session"

export const POST = createRouteHandler(async () => {
  const response = NextResponse.json({ code: 0, message: "success" })

  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })

  return response
}, {
  errorMessage: "退出登录失败",
  logPrefix: "[api/auth/logout] unexpected error",
})


