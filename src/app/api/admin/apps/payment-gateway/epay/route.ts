import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { updatePaymentGatewayEpayConfigFromAdminInput } from "@/lib/payment-gateway-config"

export const dynamic = "force-dynamic"

export const GET = createAdminRouteHandler(async () => {
  return apiSuccess(await getPaymentGatewayAdminData())
}, {
  errorMessage: "码支付后台数据读取失败",
  logPrefix: "[api/admin/apps/payment-gateway/epay:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  await updatePaymentGatewayEpayConfigFromAdminInput(body)
  revalidateSiteSettingsCache()
  revalidatePath("/admin/apps/payment-gateway")
  revalidatePath("/admin/apps/payment-gateway/epay")
  revalidatePath("/admin/apps")

  return apiSuccess(await getPaymentGatewayAdminData(), "码支付接口配置已保存")
}, {
  errorMessage: "码支付接口配置保存失败",
  logPrefix: "[api/admin/apps/payment-gateway/epay:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
