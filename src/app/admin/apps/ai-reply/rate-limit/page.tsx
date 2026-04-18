import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { AiReplyRateLimitPage } from "@/components/admin/ai-reply-rate-limit-page"
import { requireAdminUser } from "@/lib/admin"

export const metadata: Metadata = {
  title: "AI 回复 · 日调用上限",
}

export default async function AdminAiReplyRateLimitPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/ai-reply/rate-limit")
  }

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="查看并调整 AI 回复每日调用上限。"
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "AI 回复", href: "/admin/apps/ai-reply" },
        { label: "日调用上限" },
      ]}
    >
      <div className="space-y-6">
        <AiReplyRateLimitPage />
      </div>
    </AdminShell>
  )
}