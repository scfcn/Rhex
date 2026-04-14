import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { BackgroundWorkerAdminPage } from "@/components/admin/background-worker-admin-page"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminUser } from "@/lib/admin"
import { getBackgroundWorkerAdminData } from "@/lib/background-job-admin"
import { getSiteSettings } from "@/lib/site-settings"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `Worker 中心 - ${settings.siteName}`,
  }
}

export default async function WorkerAdminPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/worker")
  }

  const data = await getBackgroundWorkerAdminData()

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="查看后台任务 worker 的队列状态、结算进度、死信告警和在线连接。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "Worker 中心" },
      ]}
    >
      <BackgroundWorkerAdminPage data={data} />
    </AdminShell>
  )
}
