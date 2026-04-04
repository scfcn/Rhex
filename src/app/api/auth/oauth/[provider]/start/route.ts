import { NextResponse } from "next/server"

import { clearOAuthFlowState, setOAuthFlowState } from "@/lib/auth-flow-state"
import { createOAuthAuthorizationRequest, isExternalAuthProvider, isExternalAuthProviderEnabled } from "@/lib/auth-provider-config"
import { setAccountBindingFlash } from "@/lib/account-binding-flash"
import { getCurrentUser } from "@/lib/auth"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"
import { getServerSiteSettings } from "@/lib/site-settings"

interface OAuthProviderRouteProps {
  params: Promise<{
    provider: string
  }>
}

async function redirectWithError(targetPath: string, message: string) {
  const url = new URL(await toAbsoluteSiteUrl(targetPath))
  const response = NextResponse.redirect(url)

  if (targetPath.startsWith("/settings")) {
    setAccountBindingFlash(response, {
      type: "error",
      message,
    })
  } else {
    url.searchParams.set("authError", message)
    return NextResponse.redirect(url)
  }

  return response
}

export async function GET(request: Request, props: OAuthProviderRouteProps) {
  const params = await props.params
  const requestUrl = new URL(request.url)
  const requestedMode = requestUrl.searchParams.get("mode")
  const mode = requestedMode === "register"
    ? "register"
    : requestedMode === "connect"
      ? "connect"
      : "login"
  const redirectTo = requestUrl.searchParams.get("redirectTo")?.trim()
  const safeRedirectTo = redirectTo?.startsWith("/") ? redirectTo : "/settings?tab=profile&profileTab=accounts"

  if (!isExternalAuthProvider(params.provider)) {
    return redirectWithError("/login", "不支持的第三方登录渠道")
  }

  const settings = await getServerSiteSettings()
  if (!isExternalAuthProviderEnabled(settings, params.provider)) {
    return redirectWithError(mode === "connect" ? safeRedirectTo : "/login", "该第三方登录暂未开放")
  }

  try {
    const currentUser = mode === "connect" ? await getCurrentUser() : null
    if (mode === "connect" && !currentUser) {
      return redirectWithError(`/login?redirect=${encodeURIComponent("/settings?tab=profile&profileTab=accounts")}`, "请先登录后再绑定第三方账号")
    }

    const authorization = await createOAuthAuthorizationRequest(params.provider, settings)
    const response = NextResponse.redirect(authorization.url)

    clearOAuthFlowState(response, params.provider)
    setOAuthFlowState(response, params.provider, {
      provider: params.provider,
      state: authorization.state,
      codeVerifier: authorization.codeVerifier,
      mode,
      redirectTo: mode === "connect" ? safeRedirectTo : null,
      connectUserId: mode === "connect" ? currentUser?.id : undefined,
    })

    return response
  } catch (error) {
    console.error("[api/auth/oauth/start] unexpected error", error)
    return redirectWithError(mode === "connect" ? safeRedirectTo : "/login", error instanceof Error ? error.message : "第三方登录初始化失败，请检查后台配置")
  }
}
