import type { ComponentType } from "react"

import { SiteHeader } from "@/components/site-header"


import { SelfServeAdsIntroPage } from "@/components/self-serve-ads-intro-page"
import { getSelfServeAdsAppConfig } from "@/lib/app-config"


export default async function SelfServeAdsPage() {
  const config = await getSelfServeAdsAppConfig()
  const AppIntroComponent = SelfServeAdsIntroPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="space-y-6">
          <AppIntroComponent AppId="self-serve-ads" config={config} />
        </div>
      </div>
    </div>
  )
}

