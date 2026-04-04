import { ChangeType } from "@/db/types"

import { countUserPointLogs, findUserPointLogsPage } from "@/db/point-log-queries"
import { formatDateTime } from "@/lib/formatters"
import { parsePointLogAuditTrail } from "@/lib/point-log-audit"

import { withRuntimeFallback } from "@/lib/runtime-errors"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"


export interface SitePointLogItem {
  id: string
  changeType: ChangeType
  changeValue: number
  reason: string
  displayReason: string
  relatedType?: string | null
  relatedId?: string | null
  createdAt: string
  beforeBalance?: number | null
  afterBalance?: number | null
  isRedeemCode?: boolean
  pointEffect?: {
    baseValue: string
    ruleSummary: string
    deltaValue: string
  } | null
}

export interface UserPointLogsResult {
  items: SitePointLogItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function getUserPointLogs(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserPointLogsResult> {
  const pageSize = 10
  const requestedPage = normalizePositiveInteger(options.page, 1)

  return withRuntimeFallback(async () => {
    const total = await countUserPointLogs(userId)

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const logs = await findUserPointLogsPage(userId, (page - 1) * pageSize, pageSize)


    return {
      items: logs.map((log) => ({
        ...parsePointLogAuditTrail(log.reason),
        id: log.id,
        changeType: log.changeType,
        changeValue: log.changeValue,
        reason: log.reason,
        relatedType: log.relatedType,
        relatedId: log.relatedId,
        createdAt: formatDateTime(log.createdAt),
      })),
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    }
  }, {
    area: "points",
    action: "getUserPointLogs",
    message: "积分日志加载失败",
    metadata: { userId, page: requestedPage },
    fallback: {
      items: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    },
  })
}


