import { createHash } from "node:crypto"

import { findBuiltinPaymentGatewayChannelDefinition } from "@/lib/payment-gateway-registry"
import type {
  PaymentGatewayCheckoutPresentation,
  ServerPaymentGatewayEpayConfigData,
} from "@/lib/payment-gateway.types"

type EpayChannelCode = "epay.alipay" | "epay.wxpay" | "epay.qqpay"

const EPAY_CHANNEL_PAY_TYPE_MAP: Record<EpayChannelCode, string> = {
  "epay.alipay": "alipay",
  "epay.wxpay": "wxpay",
  "epay.qqpay": "qqpay",
}

export interface CreateEpayCheckoutPresentationInput {
  channelCode: EpayChannelCode
  merchantOrderNo: string
  amountFen: number
  subject: string
  body?: string | null
  notifyUrl: string
  returnUrl: string
  requestIp?: string | null
  sitename?: string | null
  config: ServerPaymentGatewayEpayConfigData
}

export interface CreateEpayCheckoutPresentationResult {
  presentation: PaymentGatewayCheckoutPresentation
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
  providerTradeNo: string | null
  providerTraceId: string | null
}

function formatAmountYuan(amountFen: number) {
  return (amountFen / 100).toFixed(2)
}

export function isEpayConfigRunnable(config: ServerPaymentGatewayEpayConfigData) {
  return Boolean(config.pid && config.key && config.apiBaseUrl)
}

function epayMd5Sign(params: Record<string, string>, key: string) {
  const sortedKeys = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .sort()

  const stringA = sortedKeys.map((k) => `${k}=${params[k]}`).join("&")
  const stringSignTemp = stringA + key
  return createHash("md5").update(stringSignTemp).digest("hex").toLowerCase()
}

function buildFormHtml(actionUrl: string, fields: Record<string, string>) {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join("\n")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>跳转支付...</title>
</head>
<body onload="document.getElementById('epay-form').submit()">
  <form id="epay-form" method="POST" action="${escapeHtml(actionUrl)}">
    ${inputs}
  </form>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function normalizeApiBaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "")
  return trimmed || "https://pay.rliyun.cn"
}

export async function createEpayCheckoutPresentation(
  input: CreateEpayCheckoutPresentationInput,
): Promise<CreateEpayCheckoutPresentationResult> {
  const definition = findBuiltinPaymentGatewayChannelDefinition(input.channelCode)
  if (!definition || definition.providerCode !== "epay") {
    throw new Error("不支持的码支付通道")
  }

  const payType = EPAY_CHANNEL_PAY_TYPE_MAP[input.channelCode]
  if (!payType) {
    throw new Error(`未知的码支付通道: ${input.channelCode}`)
  }

  if (!input.config.key) {
    throw new Error("码支付密钥未配置")
  }

  const subject = input.subject.slice(0, 127)
  const apiBaseUrl = normalizeApiBaseUrl(input.config.apiBaseUrl)
  const actionUrl = `${apiBaseUrl}/xpay/epay/submit.php`

  const signParams: Record<string, string> = {
    pid: input.config.pid,
    type: payType,
    out_trade_no: input.merchantOrderNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: subject,
    money: formatAmountYuan(input.amountFen),
    device: "pc",
  }

  if (input.sitename) {
    signParams.sitename = input.sitename
  }

  if (input.body) {
    signParams.param = input.body
  }

  if (input.requestIp) {
    signParams.clientip = input.requestIp
  }

  const sign = epayMd5Sign(signParams, input.config.key)

  const formFields: Record<string, string> = {
    ...signParams,
    sign,
    sign_type: "MD5",
  }

  const html = buildFormHtml(actionUrl, formFields)

  return {
    presentation: {
      type: "HTML_FORM",
      html,
    },
    requestPayload: {
      actionUrl,
      ...formFields,
    },
    responsePayload: {
      html,
    },
    providerTradeNo: null,
    providerTraceId: null,
  }
}

export async function queryEpayOrderStatus(params: {
  config: ServerPaymentGatewayEpayConfigData
  merchantOrderNo: string
}) {
  if (!params.config.key) {
    throw new Error("码支付密钥未配置")
  }

  const apiBaseUrl = normalizeApiBaseUrl(params.config.apiBaseUrl)
  const queryUrl = `${apiBaseUrl}/xpay/epay/api.php?act=order&pid=${encodeURIComponent(params.config.pid)}&key=${encodeURIComponent(params.config.key)}&out_trade_no=${encodeURIComponent(params.merchantOrderNo)}`

  const response = await fetch(queryUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`码支付查单请求失败: HTTP ${response.status}`)
  }

  const result = await response.json() as Record<string, unknown>

  return result
}

export function verifyEpayNotifySignature(
  config: ServerPaymentGatewayEpayConfigData,
  payload: Record<string, string>,
) {
  if (!config.key) {
    return false
  }

  const receivedSign = (payload.sign ?? "").trim().toLowerCase()
  if (!receivedSign) {
    return false
  }

  const computedSign = epayMd5Sign(payload, config.key)
  return computedSign === receivedSign
}

export function readEpayNotifyTradeStatus(payload: Record<string, string>) {
  return (payload.trade_status ?? "").trim()
}

export function readEpayNotifyPayType(payload: Record<string, string>) {
  return (payload.type ?? "").trim()
}
