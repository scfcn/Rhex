import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import type { ReactNode, ComponentType } from "react"

import { requireAdminUser } from "@/lib/admin"
import { getHostAppBySlug } from "@/lib/apps"

import { getGobangAppConfig, getSelfServeAdsAppConfig, getYinYangContractAppConfig } from "@/lib/app-config"
import { AiReplyAdminPage } from "@/components/admin/ai-reply-admin-page"
import { GobangAdminPage } from "@/components/admin/gobang-admin-page"
import { RssHarvestAdminPage } from "@/components/admin/rss-harvest-admin-page"
import { SelfServeAdsAdminPage } from "@/components/admin/self-serve-ads-admin-page"
import { YinYangContractAdminPage } from "@/components/admin/yinyang-contract-admin-page"
import { getAiReplyAdminData } from "@/lib/ai-reply"
import { getRssAdminData } from "@/lib/rss-harvest"
import { getSiteSettings } from "@/lib/site-settings"

type ConfigAdminComponentProps = {
  AppId: string
  config: Record<string, boolean | number | string>
}

type AppPageRenderResult = {
  content: ReactNode
}

type AppPageRenderer = () => Promise<AppPageRenderResult>

function renderConfigPage(
  AppAdminComponent: ComponentType<ConfigAdminComponentProps>,
  appId: string,
  config: Record<string, boolean | number | string>,
): AppPageRenderResult {
  return {
    content: <AppAdminComponent AppId={appId} config={config} />,
  }
}

function renderAdminAppShell(params: {
  adminName: string
  appName: string
  appDescription?: string
  content: ReactNode
}) {
  return (
    <AdminShell
      currentKey="apps"
      adminName={params.adminName}
      headerDescription={params.appDescription ?? `${params.appName} 的后台配置与管理入口。`}
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: params.appName },
      ]}
    >
      <div className="space-y-6">
        {params.content}
      </div>
    </AdminShell>
  )
}



export async function generateMetadata(props: PageProps<"/admin/apps/[app]">): Promise<Metadata> {
  const params = await props.params
  const [app, settings] = await Promise.all([Promise.resolve(getHostAppBySlug(params.app)), getSiteSettings()])

  return {
    title: `${app?.name ?? "应用后台"} - ${settings.siteName}`,
  }
}

export default async function AdminAppPage(props: PageProps<"/admin/apps/[app]">) {
  const params = await props.params
  const admin = await requireAdminUser()
  if (!admin) {
    redirect(`/login?redirect=/admin/apps/${params.app}`)
  }

  const app = getHostAppBySlug(params.app)
  if (!app) {
    notFound()
  }

  const appRenderers: Partial<Record<typeof app.slug, AppPageRenderer>> = {
    "ai-reply": async () => ({
      content: <AiReplyAdminPage initialData={await getAiReplyAdminData()} />,
    }),
    gobang: async () => renderConfigPage(
      GobangAdminPage as ComponentType<ConfigAdminComponentProps>,
      "gobang",
      await getGobangAppConfig(),
    ),
    "self-serve-ads": async () => renderConfigPage(
      SelfServeAdsAdminPage as ComponentType<ConfigAdminComponentProps>,
      "self-serve-ads",
      await getSelfServeAdsAppConfig(),
    ),
    "yinyang-contract": async () => renderConfigPage(
      YinYangContractAdminPage as ComponentType<ConfigAdminComponentProps>,
      "yinyang-contract",
      await getYinYangContractAppConfig(),
    ),
    "rss-harvest": async () => ({
      content: <RssHarvestAdminPage initialData={await getRssAdminData()} />,
    }),
  }

  const renderAppPage = appRenderers[app.slug]
  if (!renderAppPage) {
    notFound()
  }

  const { content } = await renderAppPage()

  return renderAdminAppShell({
    adminName: admin.nickname ?? admin.username,
    appName: app.name,
    appDescription: app.description,
    content,
  })
}
