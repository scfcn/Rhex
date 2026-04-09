import { Prisma } from "@/db/types"
import type { RssLogLevel } from "@/db/types"

import { prisma } from "@/db/client"

const rssSettingSelect = {
  id: true,
  workerEnabled: true,
  schedulerIntervalSec: true,
  maxConcurrentJobs: true,
  maxRetryCount: true,
  retryBackoffSec: true,
  fetchTimeoutMs: true,
  maxResponseBytes: true,
  maxRedirects: true,
  failurePauseThreshold: true,
  homeDisplayEnabled: true,
  homePageSize: true,
  userAgent: true,
  workerHeartbeatAt: true,
  workerLastCycleAt: true,
  workerLastWorkerId: true,
  workerLastSummaryJson: true,
  workerLastErrorAt: true,
  workerLastErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RssSettingSelect

const rssSourceAdminSelect = {
  id: true,
  siteName: true,
  feedUrl: true,
  logoPath: true,
  intervalMinutes: true,
  requiresReview: true,
  status: true,
  requestTimeoutMs: true,
  maxRetryCount: true,
  nextRunAt: true,
  lastRunAt: true,
  lastSuccessAt: true,
  lastErrorAt: true,
  lastErrorMessage: true,
  failureCount: true,
  lastRunDurationMs: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RssSourceSelect

const rssQueueSelect = {
  id: true,
  sourceId: true,
  triggerType: true,
  status: true,
  priority: true,
  scheduledAt: true,
  leaseExpiresAt: true,
  startedAt: true,
  finishedAt: true,
  attemptCount: true,
  maxAttempts: true,
  workerId: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RssQueueSelect

const rssRunSelect = {
  id: true,
  sourceId: true,
  queueId: true,
  triggerType: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  httpStatus: true,
  contentType: true,
  responseBytes: true,
  fetchedCount: true,
  insertedCount: true,
  duplicateCount: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  source: {
    select: {
      id: true,
      siteName: true,
      feedUrl: true,
      status: true,
    },
  },
} satisfies Prisma.RssRunSelect

const rssLogSelect = {
  id: true,
  runId: true,
  level: true,
  stage: true,
  message: true,
  detailJson: true,
  createdAt: true,
  run: {
    select: {
      id: true,
      source: {
        select: {
          id: true,
          siteName: true,
        },
      },
    },
  },
} satisfies Prisma.RssLogSelect

const rssQueueWithSourceSelect = {
  ...rssQueueSelect,
  source: {
    select: rssSourceAdminSelect,
  },
} satisfies Prisma.RssQueueSelect

export type RssSettingRecord = Prisma.RssSettingGetPayload<{ select: typeof rssSettingSelect }>
export type RssSourceAdminRecord = Prisma.RssSourceGetPayload<{ select: typeof rssSourceAdminSelect }>
export type RssQueueRecord = Prisma.RssQueueGetPayload<{ select: typeof rssQueueSelect }>
export type RssQueueWithSourceRecord = Prisma.RssQueueGetPayload<{ select: typeof rssQueueWithSourceSelect }>
export type RssRunRecord = Prisma.RssRunGetPayload<{ select: typeof rssRunSelect }>
export type RssLogRecord = Prisma.RssLogGetPayload<{ select: typeof rssLogSelect }>

export async function getOrCreateRssSettingRecord() {
  const existing = await prisma.rssSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: rssSettingSelect,
  })

  if (existing) {
    return existing
  }

  return prisma.rssSetting.create({
    data: {},
    select: rssSettingSelect,
  })
}

export function updateRssSettingRecord(id: string, data: Prisma.RssSettingUpdateInput) {
  return prisma.rssSetting.update({
    where: { id },
    data,
    select: rssSettingSelect,
  })
}

export function listRssSourcesForAdmin() {
  return prisma.rssSource.findMany({
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" },
    ],
    select: rssSourceAdminSelect,
  })
}

export function countRssSources() {
  return prisma.rssSource.count()
}

export function listRssSourcesPage(skip: number, take: number) {
  return prisma.rssSource.findMany({
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" },
    ],
    skip,
    take,
    select: rssSourceAdminSelect,
  })
}

export function findRssSourceById(id: string) {
  return prisma.rssSource.findUnique({
    where: { id },
    select: rssSourceAdminSelect,
  })
}

export function findRssSourceByFeedUrl(feedUrl: string) {
  return prisma.rssSource.findUnique({
    where: { feedUrl },
    select: rssSourceAdminSelect,
  })
}

export function createRssSourceRecord(data: Prisma.RssSourceCreateInput) {
  return prisma.rssSource.create({
    data,
    select: rssSourceAdminSelect,
  })
}

export function updateRssSourceRecord(id: string, data: Prisma.RssSourceUpdateInput) {
  return prisma.rssSource.update({
    where: { id },
    data,
    select: rssSourceAdminSelect,
  })
}

export function countActiveQueueItemsForSource(sourceId: string) {
  return prisma.rssQueue.count({
    where: {
      sourceId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
  })
}

export function cancelPendingQueueItemsForSource(sourceId: string) {
  return prisma.rssQueue.updateMany({
    where: {
      sourceId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
      errorMessage: "任务已由管理员停止",
      leaseExpiresAt: null,
      workerId: null,
    },
  })
}

export function createRssQueueRecord(data: Prisma.RssQueueUncheckedCreateInput) {
  return prisma.rssQueue.create({
    data,
    select: rssQueueSelect,
  })
}

export function updateRssQueueRecord(id: string, data: Prisma.RssQueueUpdateInput) {
  return prisma.rssQueue.update({
    where: { id },
    data,
    select: rssQueueSelect,
  })
}

export function countRssQueueSummary() {
  return Promise.all([
    prisma.rssQueue.count({ where: { status: "PENDING" } }),
    prisma.rssQueue.count({ where: { status: "PROCESSING" } }),
    prisma.rssQueue.count({ where: { status: "FAILED" } }),
  ])
}

export function listRecentRssRuns(limit = 30) {
  return prisma.rssRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    select: rssRunSelect,
  })
}

export function countRssRuns() {
  return prisma.rssRun.count()
}

export function listRecentRssRunsPage(skip: number, take: number) {
  return prisma.rssRun.findMany({
    orderBy: { startedAt: "desc" },
    skip,
    take,
    select: rssRunSelect,
  })
}

export function listRecentRssLogs(limit = 80) {
  return prisma.rssLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: rssLogSelect,
  })
}

export function countRssLogs() {
  return prisma.rssLog.count()
}

export function listRecentRssLogsPage(skip: number, take: number) {
  return prisma.rssLog.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: rssLogSelect,
  })
}

export function clearRssLogs() {
  return prisma.rssLog.deleteMany()
}

export function clearRssQueueHistoryBySource(sourceId: string) {
  return prisma.rssQueue.deleteMany({
    where: {
      sourceId,
      finishedAt: {
        not: null,
      },
    },
  })
}

export function clearRssRunHistoryBySource(sourceId: string) {
  return prisma.rssRun.deleteMany({
    where: {
      sourceId,
      finishedAt: {
        not: null,
      },
    },
  })
}

export function clearRssRunHistory() {
  return prisma.rssRun.deleteMany({
    where: {
      finishedAt: {
        not: null,
      },
    },
  })
}

export function createRssRunRecord(data: Prisma.RssRunUncheckedCreateInput) {
  return prisma.rssRun.create({
    data,
    select: rssRunSelect,
  })
}

export function updateRssRunRecord(id: string, data: Prisma.RssRunUpdateInput) {
  return prisma.rssRun.update({
    where: { id },
    data,
    select: rssRunSelect,
  })
}

export function createRssLogRecord(data: Prisma.RssLogUncheckedCreateInput) {
  return prisma.rssLog.create({
    data,
    select: rssLogSelect,
  })
}

export function createManyRssEntries(data: Prisma.RssEntryCreateManyInput[]) {
  return prisma.rssEntry.createMany({
    data,
    skipDuplicates: true,
  })
}

export function recoverExpiredRssQueueItems(now: Date) {
  return prisma.rssQueue.updateMany({
    where: {
      status: "PROCESSING",
      leaseExpiresAt: {
        lt: now,
      },
    },
    data: {
      status: "PENDING",
      workerId: null,
      startedAt: null,
      leaseExpiresAt: null,
      errorMessage: "检测到过期执行租约，任务已重新排队",
    },
  })
}

export async function claimPendingRssQueueItems(params: {
  now: Date
  limit: number
  workerId: string
  leaseExpiresAt: Date
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH claimed AS (
      SELECT id
      FROM "rss_queue"
      WHERE status = CAST(${"PENDING"} AS "RssQueueStatus")
        AND "scheduledAt" <= ${params.now}
      ORDER BY priority DESC, "scheduledAt" ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${params.limit}
    )
    UPDATE "rss_queue" AS queue
    SET
      status = CAST(${"PROCESSING"} AS "RssQueueStatus"),
      "leaseExpiresAt" = ${params.leaseExpiresAt},
      "startedAt" = ${params.now},
      "attemptCount" = queue."attemptCount" + 1,
      "workerId" = ${params.workerId},
      "updatedAt" = ${params.now}
    FROM claimed
    WHERE queue.id = claimed.id
    RETURNING queue.id
  `)

  if (rows.length === 0) {
    return [] satisfies RssQueueWithSourceRecord[]
  }

  const items = await prisma.rssQueue.findMany({
    where: {
      id: {
        in: rows.map((row) => row.id),
      },
    },
    select: rssQueueWithSourceSelect,
  })

  const itemMap = new Map(items.map((item) => [item.id, item]))
  return rows
    .map((row) => itemMap.get(row.id))
    .filter((item): item is RssQueueWithSourceRecord => Boolean(item))
}

export function findDueRssSources(now: Date, limit: number) {
  return prisma.rssSource.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
    select: rssSourceAdminSelect,
  })
}

export function countRssRunsBySource(sourceId: string) {
  return prisma.rssRun.count({
    where: { sourceId },
  })
}

export function countRssQueueItemsBySource(sourceId: string) {
  return prisma.rssQueue.count({
    where: { sourceId },
  })
}

export function listRssQueueItemsBySource(sourceId: string, limit = 20) {
  return prisma.rssQueue.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: rssQueueSelect,
  })
}

export function listRssQueueItemsPageBySource(sourceId: string, skip: number, take: number) {
  return prisma.rssQueue.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: rssQueueSelect,
  })
}

export async function createRssLogBatch(items: Array<{
  runId: string
  level: RssLogLevel
  stage: string
  message: string
  detailJson?: Prisma.InputJsonValue
}>) {
  if (items.length === 0) {
    return
  }

  await prisma.rssLog.createMany({
    data: items.map((item) => ({
      runId: item.runId,
      level: item.level,
      stage: item.stage,
      message: item.message,
      detailJson: item.detailJson,
    })),
  })
}

export function findRssRunsForSource(sourceId: string, limit = 20) {
  return prisma.rssRun.findMany({
    where: { sourceId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: rssRunSelect,
  })
}

export function findRssRunsPageForSource(sourceId: string, skip: number, take: number) {
  return prisma.rssRun.findMany({
    where: { sourceId },
    orderBy: { startedAt: "desc" },
    skip,
    take,
    select: rssRunSelect,
  })
}

export function findRssLogsForRunIds(runIds: string[]) {
  if (runIds.length === 0) {
    return Promise.resolve([] satisfies RssLogRecord[])
  }

  return prisma.rssLog.findMany({
    where: {
      runId: {
        in: runIds,
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: rssLogSelect,
  })
}

export function countRssEntriesForSource(sourceId: string) {
  return prisma.rssEntry.count({
    where: { sourceId },
  })
}
