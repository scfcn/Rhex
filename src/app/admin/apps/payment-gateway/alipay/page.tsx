import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { PaymentGatewayAlipayAdminPage } from "@/components/admin/payment-gateway-alipay-admin-page"
import { requireAdminUser } from "@/lib/admin"
import { getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `支付宝接口 - ${settings.siteName}`,
  }
}

export default async function PaymentGatewayAlipayAdminRoute() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps/payment-gateway/alipay")
  }

  const initialData = await getPaymentGatewayAdminData()

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="单独维护支付宝接口自身的 AppId、沙箱环境、签名模式、公钥或证书，以及所有敏感密钥内容。"
      headerSearch={
        <div className="space-y-3">
          <AdminModuleSearch className="w-full" />
        </div>
      }
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "应用中心", href: "/admin/apps" },
        { label: "支付网关", href: "/admin/apps/payment-gateway" },
        { label: "支付宝接口" },
      ]}
    >
      <PaymentGatewayAlipayAdminPage initialData={initialData} />
    </AdminShell>
  )
}
