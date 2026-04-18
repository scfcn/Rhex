import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { AiReplyModerationPage } from "@/components/admin/ai-reply-moderation-page"
import { requireAdminUser } from "@/lib/admin"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `AI 审核建议 - ${settings.siteName}`,
  }
}

export default async function AiReplyModerationAdminPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/ai-reply/moderation")
  }

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="审核 AI 生成的板块与标签修正建议。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "AI 回复", href: "/admin/apps/ai-reply" },
        { label: "审核建议" },
      ]}
    >
      <div className="space-y-6">
        <AiReplyModerationPage />
      </div>
    </AdminShell>
  )
}