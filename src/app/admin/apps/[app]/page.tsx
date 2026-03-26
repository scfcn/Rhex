import { notFound, redirect } from "next/navigation"

import { AdminShell } from "@/components/admin-shell"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

import { requireAdminUser } from "@/lib/admin"
import { getHostAppBySlug } from "@/lib/apps"
import type { ComponentType } from "react"

import { getGobangAppConfig, getSelfServeAdsAppConfig } from "@/lib/app-config"
import { GobangAdminPage } from "@/components/gobang-admin-page"
import { SelfServeAdsAdminPage } from "@/components/self-serve-ads-admin-page"



interface AdminAppPageProps {
  params: {
    app: string
  }
}

export default async function AdminAppPage({ params }: AdminAppPageProps) {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect(`/login?redirect=/admin/apps/${params.app}`)
  }

  const app = getHostAppBySlug(params.app)
  if (!app) {
    notFound()
  }

  if (app.slug === "gobang") {
    const config = await getGobangAppConfig()
    const AppAdminComponent = GobangAdminPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>
    return (
      <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{app.name} · 应用后台</CardTitle>
            </CardHeader>
          </Card>
          <AppAdminComponent AppId="gobang" config={config} />
        </div>
      </AdminShell>
    )
  }

  if (app.slug === "self-serve-ads") {
    const config = await getSelfServeAdsAppConfig()
    const AppAdminComponent = SelfServeAdsAdminPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>
    return (
      <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{app.name} · 应用后台</CardTitle>
            </CardHeader>
          </Card>
          <AppAdminComponent AppId="self-serve-ads" config={config} />
        </div>
      </AdminShell>
    )
  }


  notFound()
}
