import { headers } from "next/headers";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function getConfiguredSiteOrigin() {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim() || process.env.APP_URL?.trim()
  return envOrigin ? normalizeOrigin(envOrigin) : null
}

export async function resolveSiteOrigin() {
  const configuredOrigin = getConfiguredSiteOrigin()
  if (configuredOrigin) {
    return configuredOrigin
  }

  const headerStore = await headers()
  const proto = headerStore.get("x-forwarded-proto") ?? "https"
  const forwardedHost = headerStore.get("x-forwarded-host")
  const host = forwardedHost?.split(",")[0]?.trim() || headerStore.get("host")?.trim()

  if (!host) {
    throw new Error("无法解析站点 origin，请配置 NEXT_PUBLIC_SITE_URL 或在请求中提供 host 头")
  }

  return normalizeOrigin(`${proto}://${host}`)
}

export async function toAbsoluteSiteUrl(path = "/") {
  return new URL(path, `${await resolveSiteOrigin()}/`).toString()
}
