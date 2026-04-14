import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { PointsTopupCard } from "@/components/points-topup-card"
import { RedeemCodeCard } from "@/components/redeem-code-card"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getEnabledPointTopupPackages } from "@/lib/payment-gateway"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `积分充值 / 兑换 - ${settings.siteName}`,
    description: `在 ${settings.siteName} 通过支付宝充值站内 ${settings.pointName}，或使用兑换码领取 ${settings.pointName}。支持固定套餐和后台允许范围内的自定义金额。`,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, ["积分充值", "兑换码兑换", settings.pointName, "支付宝充值", "充值中心"]),
  }
}

export default async function TopupPage() {
  const [currentUser, settings, pointTopup] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    getEnabledPointTopupPackages(),
  ])

  if (!currentUser) {
    redirect("/login?redirect=/topup")
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 py-8">
        <div className="space-y-6">
    

          {pointTopup.enabled ? (
            <PointsTopupCard
              enabled={pointTopup.enabled}
              pointName={settings.pointName}
              packages={pointTopup.packages}
              customAmountEnabled={pointTopup.customAmountEnabled}
              customMinAmountFen={pointTopup.customMinAmountFen}
              customMaxAmountFen={pointTopup.customMaxAmountFen}
              customPointsPerYuan={pointTopup.customPointsPerYuan}
              heading="选择充值方案"
              description="购买充值包更优惠。"
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                当前未开放积分充值，但你仍然可以在下方使用兑换码领取 {settings.pointName}。
              </CardContent>
            </Card>
          )}

          <RedeemCodeCard
            pointName={settings.pointName}
            currentPoints={currentUser.points}
            helpLinkEnabled={settings.redeemCodeHelpEnabled}
            helpLinkTitle={settings.redeemCodeHelpTitle}
            helpLinkUrl={settings.redeemCodeHelpUrl}
          />
        </div>
      </main>
    </div>
  )
}
