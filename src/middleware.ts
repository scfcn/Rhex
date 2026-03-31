import { NextResponse, type NextRequest } from "next/server"

import { buildUnauthorizedResponse, getSessionFromRequest, isProtectedPath } from "@/lib/auth-guards"
import { getSessionClearedCookieOptions, getSessionCookieName } from "@/lib/session"

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value
  const protectedPath = isProtectedPath(request.nextUrl.pathname)

  if (!token) {
    if (!protectedPath) {
      return NextResponse.next()
    }

    return buildUnauthorizedResponse(request)
  }

  const session = await getSessionFromRequest(request)
  if (session) {
    return NextResponse.next()
  }

  if (protectedPath) {
    const response = buildUnauthorizedResponse(request)
    response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions())
    return response
  }

  const response = NextResponse.next()
  response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions())
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
}
