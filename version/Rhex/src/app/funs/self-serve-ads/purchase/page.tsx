import { notFound } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

import { SelfServeAdsPurchasePage } from "@/components/self-serve-ads-purchase-page"
import { getSelfServeAdsAppConfig } from "@/lib/self-serve-ads"
import { buildSelfServeAdPriceMap, toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { getSiteSettings } from "@/lib/site-settings"




interface SelfServeAdsPurchaseRouteProps {
  searchParams?: {
    slotType?: string
    slotIndex?: string
  }
}

export default async function SelfServeAdsPurchaseRoute({ searchParams }: SelfServeAdsPurchaseRouteProps) {
  const slotType = searchParams?.slotType === "IMAGE" ? "IMAGE" : searchParams?.slotType === "TEXT" ? "TEXT" : null
  const slotIndex = Math.max(0, Number(searchParams?.slotIndex ?? 0) || 0)

  if (!slotType) {
    notFound()
  }

  const [rawConfig, settings] = await Promise.all([
    getSelfServeAdsAppConfig(),
    getSiteSettings(),
  ])
  const config = toSelfServeAdConfig(rawConfig)


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[960px] px-4 py-8">
        <SelfServeAdsPurchasePage
          slotType={slotType}
          slotIndex={slotIndex}
          pointName={settings.pointName}
          prices={buildSelfServeAdPriceMap(config)}
        />
      </div>
    </div>
  )
}
