import type { Metadata } from "next"

import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { buildMetadataKeywords } from "@/lib/seo"
import { getYinYangLobbyData, YinYangContractPage } from "@/lib/yinyang-contract"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `阴阳契 - ${settings.siteName}`,
    description: `在 ${settings.siteName} 发起双选项积分挑战，参与阴阳契应战、查看胜负排行与积分盈利榜。`,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, ["阴阳契", "积分挑战", "排行榜", "赢家榜", "盈利榜"]),
  }
}

export default async function YinYangContractFunPage() {
  const user = await getCurrentUser()
  const initialData = await getYinYangLobbyData(user)

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1280px] px-4 py-8 mt-8">
        <YinYangContractPage initialData={initialData} canPlay={Boolean(user)} />
      </div>
    </div>
  )
}
