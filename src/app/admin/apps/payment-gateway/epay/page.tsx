import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { PaymentGatewayEpayAdminPage } from "@/components/admin/payment-gateway-epay-admin-page"
import { requireAdminUser } from "@/lib/admin"
import { getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `码支付接口 - ${settings.siteName}`,
  }
}

export default async function PaymentGatewayEpayAdminRoute() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/payment-gateway/epay")
  }

  const initialData = await getPaymentGatewayAdminData()

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="单独维护码支付接口自身的 API 地址、商户 ID、异步通知路径和商户密钥。"
      headerSearch={
        <div className="space-y-3">
          <AdminModuleSearch className="w-full" />
        </div>
      }
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "支付网关", href: "/admin/apps/payment-gateway" },
        { label: "码支付接口" },
      ]}
    >
      <PaymentGatewayEpayAdminPage initialData={initialData} />
    </AdminShell>
  )
}
