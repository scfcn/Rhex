import { ChangeType, type Prisma } from "@/db/types"
import { normalizePointLogEventType, type PointLogEventDataValue, type PointLogEventType } from "@/lib/point-log-events"

import { countUserPointLogs, findUserPointLogsCursor } from "@/db/point-log-queries"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/cursor-pagination"
import { resolvePointLogAuditPresentation, type PointLogEffectMetadata, type PointLogTaxMetadata } from "@/lib/point-log-audit"

import { withRuntimeFallback } from "@/lib/runtime-errors"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"


export interface SitePointLogItem {
  id: string
  changeType: ChangeType
  changeValue: number
  reason: string
  displayReason: string
  eventType: PointLogEventType
  eventData?: PointLogEventDataValue
  relatedType?: string | null
  relatedId?: string | null
  createdAt: string
  beforeBalance?: number | null
  afterBalance?: number | null
  isRedeemCode?: boolean
  pointEffect?: PointLogEffectMetadata | null
  pointTax?: PointLogTaxMetadata | null
}

export interface UserPointLogsResult {
  items: SitePointLogItem[]
  pageSize: number
  total: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
  filters: {
    changeType: "ALL" | ChangeType
    eventType: "ALL" | PointLogEventType
  }
}

export async function getUserPointLogs(
  userId: number,
  options: {
    pageSize?: number
    after?: string | null
    before?: string | null
    changeType?: string | null
    eventType?: string | null
  } = {},
): Promise<UserPointLogsResult> {
  const pageSize = Math.min(50, Math.max(1, normalizePositiveInteger(options.pageSize, 10)))
  const changeType = options.changeType === ChangeType.INCREASE || options.changeType === ChangeType.DECREASE
    ? options.changeType
    : "ALL"
  const eventType = typeof options.eventType === "string" && options.eventType.trim() && options.eventType !== "ALL"
    ? normalizePointLogEventType(options.eventType)
    : "ALL"
  const where: Prisma.PointLogWhereInput = {
    ...(changeType !== "ALL" ? { changeType } : {}),
    ...(eventType !== "ALL" ? { eventType } : {}),
  }

  return withRuntimeFallback(async () => {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserPointLogs(userId, where)
    const { items: logs, hasPrevPage, hasNextPage } = await findUserPointLogsCursor({
      userId,
      take: pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
      where,
    })


    return {
      items: logs.map((log) => {
        const presentation = resolvePointLogAuditPresentation(log.reason, log.eventData)

        return {
          ...presentation,
          id: log.id,
          changeType: log.changeType,
          changeValue: log.changeValue,
          reason: log.reason,
          eventType: log.eventType as PointLogEventType,
          eventData: log.eventData,
          relatedType: log.relatedType,
          relatedId: log.relatedId,
          createdAt: log.createdAt.toISOString(),
        }
      }),
      pageSize,
      total,
      hasPrevPage,
      hasNextPage,
      prevCursor: logs.length > 0 ? encodeTimestampCursor({ id: logs[0].id, createdAt: logs[0].createdAt.toISOString() }) : null,
      nextCursor: logs.length > 0 ? encodeTimestampCursor({ id: logs[logs.length - 1].id, createdAt: logs[logs.length - 1].createdAt.toISOString() }) : null,
      filters: {
        changeType,
        eventType,
      },
    }
  }, {
    area: "points",
    action: "getUserPointLogs",
    message: "积分日志加载失败",
    metadata: { userId, after: options.after ?? null, before: options.before ?? null, changeType, eventType },
    fallback: {
      items: [],
      pageSize,
      total: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
      filters: {
        changeType,
        eventType,
      },
    },
  })
}


