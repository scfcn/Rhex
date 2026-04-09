import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin-module-search"
import { AdminShell } from "@/components/admin-shell"
import type { ReactNode, ComponentType } from "react"

import { requireAdminUser } from "@/lib/admin"
import { getHostAppBySlug } from "@/lib/apps"

import { getGobangAppConfig, getSelfServeAdsAppConfig, getYinYangContractAppConfig } from "@/lib/app-config"
import { GobangAdminPage } from "@/components/gobang-admin-page"
import { RssHarvestAdminPage } from "@/components/rss-harvest-admin-page"
import { SelfServeAdsAdminPage } from "@/components/self-serve-ads-admin-page"
import { YinYangContractAdminPage } from "@/components/yinyang-contract-admin-page"
import { getRssAdminData } from "@/lib/rss-harvest"
import { getSiteSettings } from "@/lib/site-settings"

type ConfigAdminComponentProps = {
  AppId: string
  config: Record<string, boolean | number | string>
}

type AppPageRenderResult = {
  content: ReactNode
  showTitleCard?: boolean
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
  content: ReactNode
  showTitleCard?: boolean
}) {
  return (
    <AdminShell currentTab="/admin/apps" adminName={params.adminName}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
            <h2 className="text-lg font-semibold">{params.appName}  应用后台</h2>
          </div>
          <AdminModuleSearch className="md:ml-auto" />
        </div>



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

  const { content, showTitleCard } = await renderAppPage()

  return renderAdminAppShell({
    adminName: admin.nickname ?? admin.username,
    appName: app.name,
    content,
    showTitleCard: app.slug === "gobang" ? false : showTitleCard,
  })
}
