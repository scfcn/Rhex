import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { AiReplySummaryPage } from "@/components/admin/ai-reply-summary-page"
import { requireAdminUser } from "@/lib/admin"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `AI 总结缓存 - ${settings.siteName}`,
  }
}

export default async function AiReplySummaryAdminPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/ai-reply/summary")
  }

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="查看并清理 AI 总结缓存。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "AI 回复", href: "/admin/apps/ai-reply" },
        { label: "总结缓存" },
      ]}
    >
      <div className="space-y-6">
        <AiReplySummaryPage />
      </div>
    </AdminShell>
  )
}