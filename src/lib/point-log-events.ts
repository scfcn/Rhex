import type { Prisma } from "@/db/types"

export const POINT_LOG_EVENT_TYPES = {
  GENERIC: "GENERIC",
  BOARD_POST_CHARGE: "BOARD_POST_CHARGE",
  BOARD_REPLY_CHARGE: "BOARD_REPLY_CHARGE",
  BOARD_TREASURY_WITHDRAW: "BOARD_TREASURY_WITHDRAW",
  POST_BLOCK_PURCHASE_PAID: "POST_BLOCK_PURCHASE_PAID",
  POST_BLOCK_PURCHASE_SOLD: "POST_BLOCK_PURCHASE_SOLD",
  POST_ATTACHMENT_PURCHASE_PAID: "POST_ATTACHMENT_PURCHASE_PAID",
  POST_ATTACHMENT_PURCHASE_SOLD: "POST_ATTACHMENT_PURCHASE_SOLD",
  POST_AUCTION_BID_FREEZE: "POST_AUCTION_BID_FREEZE",
  POST_AUCTION_OUTBID_REFUND: "POST_AUCTION_OUTBID_REFUND",
  POST_AUCTION_LOSE_REFUND: "POST_AUCTION_LOSE_REFUND",
  POST_AUCTION_WIN_SETTLEMENT: "POST_AUCTION_WIN_SETTLEMENT",
  POST_AUCTION_SELLER_INCOME: "POST_AUCTION_SELLER_INCOME",
  POST_GIFT_RECEIVED: "POST_GIFT_RECEIVED",
  POST_GIFT_SENT: "POST_GIFT_SENT",
  POST_TIP_RECEIVED: "POST_TIP_RECEIVED",
  POST_TIP_SENT: "POST_TIP_SENT",
  POINTS_TOPUP: "POINTS_TOPUP",
} as const

export type PointLogEventType = (typeof POINT_LOG_EVENT_TYPES)[keyof typeof POINT_LOG_EVENT_TYPES]
export type PointLogEventDataInput = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
export type PointLogEventDataValue = Prisma.JsonValue | null

export const POINT_LOG_EVENT_LABELS: Record<PointLogEventType, string> = {
  GENERIC: "通用变动",
  BOARD_POST_CHARGE: "发帖积分",
  BOARD_REPLY_CHARGE: "回帖积分",
  BOARD_TREASURY_WITHDRAW: "节点金库提取",
  POST_BLOCK_PURCHASE_PAID: "隐藏内容购买支出",
  POST_BLOCK_PURCHASE_SOLD: "隐藏内容购买收入",
  POST_ATTACHMENT_PURCHASE_PAID: "附件购买支出",
  POST_ATTACHMENT_PURCHASE_SOLD: "附件购买收入",
  POST_AUCTION_BID_FREEZE: "拍卖出价冻结",
  POST_AUCTION_OUTBID_REFUND: "拍卖被超退款",
  POST_AUCTION_LOSE_REFUND: "拍卖失败退款",
  POST_AUCTION_WIN_SETTLEMENT: "拍卖赢家结算",
  POST_AUCTION_SELLER_INCOME: "拍卖卖家收入",
  POST_GIFT_RECEIVED: "收到礼物",
  POST_GIFT_SENT: "送出礼物",
  POST_TIP_RECEIVED: "收到打赏",
  POST_TIP_SENT: "打赏支出",
  POINTS_TOPUP: "积分充值",
} as const

export function normalizePointLogEventType(eventType?: string | null): PointLogEventType {
  if (typeof eventType === "string" && eventType.trim()) {
    return eventType.trim().toUpperCase() as PointLogEventType
  }

  return POINT_LOG_EVENT_TYPES.GENERIC
}

export function getPointLogEventLabel(eventType: string | null | undefined) {
  const normalized = normalizePointLogEventType(eventType)
  return POINT_LOG_EVENT_LABELS[normalized] ?? normalized
}
