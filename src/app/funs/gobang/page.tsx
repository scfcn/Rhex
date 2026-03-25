import { SiteHeader } from "@/components/site-header"

import { getGobangAppConfig } from "@/lib/app-config"
import { GobangPage } from "@/lib/gobang"

export default async function GobangFunPage() {
  const config = await getGobangAppConfig()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="space-y-6">
          <GobangPage AppId="gobang" config={config} />
        </div>
      </div>
    </div>
  )
}
