import type { PaymentGatewayChannelDefinition } from "@/lib/payment-gateway.types"

export const PAYMENT_GATEWAY_CHANNEL_DEFINITIONS = [
  {
    channelCode: "alipay.page",
    providerCode: "alipay",
    label: "支付宝 PC 网页",
    description: "电脑浏览器跳转支付宝收银台，适合桌面 Web 站点。",
    clientTypes: ["WEB_DESKTOP"],
    presentationType: "HTML_FORM",
    alipayMethod: "alipay.trade.page.pay",
    productCode: "FAST_INSTANT_TRADE_PAY",
  },
  {
    channelCode: "alipay.wap",
    providerCode: "alipay",
    label: "支付宝 H5",
    description: "移动浏览器唤起支付宝 App 或 H5 收银台，适合手机网页。",
    clientTypes: ["WEB_MOBILE"],
    presentationType: "HTML_FORM",
    alipayMethod: "alipay.trade.wap.pay",
    productCode: "QUICK_WAP_WAY",
  },
  {
    channelCode: "alipay.precreate",
    providerCode: "alipay",
    label: "支付宝 扫码预下单",
    description: "服务端生成二维码，适合桌面端展示或线下扫码收款。",
    clientTypes: ["QR_CODE", "WEB_DESKTOP", "WEB_MOBILE"],
    presentationType: "QR_CODE",
    alipayMethod: "alipay.trade.precreate",
    productCode: "QR_CODE_OFFLINE",
  },
] as const satisfies readonly PaymentGatewayChannelDefinition[]

const PAYMENT_GATEWAY_CHANNEL_DEFINITION_MAP = new Map<string, PaymentGatewayChannelDefinition>(
  PAYMENT_GATEWAY_CHANNEL_DEFINITIONS.map((item) => [item.channelCode, item]),
)

export function listPaymentGatewayChannelDefinitions() {
  return [...PAYMENT_GATEWAY_CHANNEL_DEFINITIONS]
}

export function findPaymentGatewayChannelDefinition(channelCode: string) {
  return PAYMENT_GATEWAY_CHANNEL_DEFINITION_MAP.get(channelCode) ?? null
}
