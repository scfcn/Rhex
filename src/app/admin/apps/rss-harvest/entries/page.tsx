import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin-module-search"
import { RssEntryAdminPage } from "@/components/rss-entry-admin-page"
import { AdminShell } from "@/components/admin-shell"
import { Button } from "@/components/ui/button"
import { requireAdminUser } from "@/lib/admin"
import { getRssEntryAdminPageData } from "@/lib/rss-entry-admin"
import { getSiteSettings } from "@/lib/site-settings"

export const dynamic = "force-dynamic"

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const settings = await getSiteSettings()
  const searchParams = await props.searchParams
  const keyword = typeof searchParams?.keyword === "string" ? searchParams.keyword.trim() : ""

  return {
    title: `${keyword ? `${keyword} - ` : ""}RSS 采集数据 - ${settings.siteName}`,
  }
}

export default async function RssHarvestEntriesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/rss-harvest/entries")
  }

  const searchParams = await props.searchParams
  const data = await getRssEntryAdminPageData({
    keyword: searchParams?.keyword,
    sourceId: searchParams?.sourceId,
    reviewStatus: searchParams?.reviewStatus,
    page: searchParams?.page,
    pageSize: searchParams?.pageSize,
  })

  return (
    <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">RSS 模块</p>
            <h2 className="text-lg font-semibold">RSS 采集数据后台</h2>
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <Link href="/admin/apps/rss-harvest">
              <Button type="button" variant="outline">返回任务页</Button>
            </Link>
            <AdminModuleSearch className="md:w-[360px]" />
          </div>
        </div>

        <RssEntryAdminPage initialData={data} />
      </div>
    </AdminShell>
  )
}
