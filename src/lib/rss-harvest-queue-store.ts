import { randomUUID } from "node:crypto"

import { findRssSourceById, type RssSourceAdminRecord } from "@/db/rss-harvest-queries"
import type { RssTriggerType } from "@/db/types"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"

type RssQueueStatusValue = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

export interface RssQueueRecord {
  id: string
  sourceId: string
  backgroundJobId: string | null
  triggerType: RssTriggerType
  status: RssQueueStatusValue
  priority: number
  scheduledAt: Date
  leaseExpiresAt: Date | null
  startedAt: Date | null
  finishedAt: Date | null
  attemptCount: number
  maxAttempts: number
  workerId: string | null
  errorMessage: string | null
  durationMs: number | null
  httpStatus: number | null
  contentType: string | null
  responseBytes: number | null
  fetchedCount: number
  insertedCount: number
  duplicateCount: number
  createdAt: Date
  updatedAt: Date
}

export interface RssQueueWithSourceRecord extends RssQueueRecord {
  source: RssSourceAdminRecord
}

export interface CreateRssQueueRecordInput {
  sourceId: string
  triggerType: RssTriggerType
  priority?: number
  scheduledAt?: Date
  maxAttempts?: number
}

export interface UpdateRssQueueRecordInput {
  backgroundJobId?: string | null
  triggerType?: RssTriggerType
  status?: RssQueueStatusValue
  priority?: number
  scheduledAt?: Date
  leaseExpiresAt?: Date | null
  startedAt?: Date | null
  finishedAt?: Date | null
  attemptCount?: number
  maxAttempts?: number
  workerId?: string | null
  errorMessage?: string | null
  durationMs?: number | null
  httpStatus?: number | null
  contentType?: string | null
  responseBytes?: number | null
  fetchedCount?: number
  insertedCount?: number
  duplicateCount?: number
  updatedAt?: Date
}

const RSS_QUEUE_ITEMS_KEY = createRedisKey("rss-harvest", "queue", "items")
const RSS_QUEUE_INDEX_KEY = createRedisKey("rss-harvest", "queue", "index")
const RSS_QUEUE_STATUS_MIGRATION_KEY = createRedisKey("rss-harvest", "queue", "migration", "byStatus-v1")
const RSS_QUEUE_STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"] as const satisfies readonly RssQueueStatusValue[]
const RSS_QUEUE_RETENTION_SECONDS = Math.max(
  300,
  Number.parseInt(process.env.RSS_QUEUE_RETENTION_SECONDS?.trim() ?? "", 10) || 7 * 24 * 60 * 60,
)
const RSS_QUEUE_RETENTION_MS = RSS_QUEUE_RETENTION_SECONDS * 1_000
const CLAIM_PENDING_RSS_QUEUE_RECORD_LUA = `
local itemsKey = KEYS[1]
local pendingStatusKey = KEYS[2]
local processingStatusKey = KEYS[3]
local recordId = ARGV[1]
local workerId = ARGV[2]
local startedAt = ARGV[3]
local score = ARGV[4]

local currentValue = redis.call("HGET", itemsKey, recordId)
if not currentValue then
  return nil
end

local ok, record = pcall(cjson.decode, currentValue)
if not ok or type(record) ~= "table" or record.status ~= "PENDING" then
  return nil
end

record.backgroundJobId = cjson.null
record.status = "PROCESSING"
record.startedAt = startedAt
record.attemptCount = (tonumber(record.attemptCount) or 0) + 1
record.workerId = workerId
record.leaseExpiresAt = cjson.null
record.updatedAt = startedAt

local nextValue = cjson.encode(record)
redis.call("HSET", itemsKey, recordId, nextValue)
redis.call("ZREM", pendingStatusKey, recordId)
redis.call("ZADD", processingStatusKey, score, recordId)

return nextValue
`

type RedisQueueConnection = ReturnType<typeof getRedis>
type RedisQueueContext = {
  redis?: RedisQueueConnection
}
type GlobalRssQueueStore = {
  __bbsInMemoryRssQueueStore?: Map<string, RssQueueRecord>
}

const globalForRssQueueStore = globalThis as typeof globalThis & GlobalRssQueueStore

function getInMemoryRssQueueStore() {
  globalForRssQueueStore.__bbsInMemoryRssQueueStore ??= new Map()
  return globalForRssQueueStore.__bbsInMemoryRssQueueStore
}

function getSourceQueueIndexKey(sourceId: string) {
  return createRedisKey("rss-harvest", "queue", "source", sourceId)
}

function getStatusQueueIndexKey(status: RssQueueStatusValue) {
  return createRedisKey("rss-harvest", "queue", "byStatus", status)
}

/**
 * 一次性回填 byStatus ZSET 索引（从旧版升级时使用）。
 * 使用 SET NX 保证幂等；失败时清除 marker 以便下次重试。
 */
async function ensureStatusIndexesBackfilled(redis: RedisQueueConnection) {
  const acquired = await redis.set(RSS_QUEUE_STATUS_MIGRATION_KEY, "1", "NX").catch(() => null)
  if (acquired !== "OK") {
    return
  }
  try {
    const raw = await redis.zrange(RSS_QUEUE_INDEX_KEY, 0, -1, "WITHSCORES").catch(() => [] as string[])
    if (raw.length === 0) {
      return
    }
    const pairs: Array<{ id: string; score: string }> = []
    for (let i = 0; i + 1 < raw.length; i += 2) {
      pairs.push({ id: raw[i]!, score: raw[i + 1]! })
    }
    if (pairs.length === 0) {
      return
    }
    const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...pairs.map((p) => p.id))
    const multi = redis.multi()
    for (let i = 0; i < pairs.length; i += 1) {
      const rawValue = values[i]
      if (!rawValue) continue
      try {
        const record = JSON.parse(rawValue) as { status?: RssQueueStatusValue }
        if (record.status && (RSS_QUEUE_STATUSES as readonly string[]).includes(record.status)) {
          multi.zadd(getStatusQueueIndexKey(record.status), pairs[i]!.score, pairs[i]!.id)
        }
      } catch {
        // ignore corrupt row
      }
    }
    await multi.exec()
  } catch (err) {
    await redis.del(RSS_QUEUE_STATUS_MIGRATION_KEY).catch(() => {})
    throw err
  }
}

function toDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function serializeRecord(record: RssQueueRecord) {
  return JSON.stringify({
    ...record,
    scheduledAt: record.scheduledAt.toISOString(),
    leaseExpiresAt: record.leaseExpiresAt?.toISOString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  })
}

function cloneRecord(record: RssQueueRecord) {
  return {
    ...record,
    scheduledAt: new Date(record.scheduledAt),
    leaseExpiresAt: record.leaseExpiresAt ? new Date(record.leaseExpiresAt) : null,
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  } satisfies RssQueueRecord
}

function parseRecord(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (
      typeof parsed.id !== "string"
      || typeof parsed.sourceId !== "string"
      || typeof parsed.triggerType !== "string"
      || typeof parsed.status !== "string"
      || typeof parsed.priority !== "number"
      || typeof parsed.scheduledAt !== "string"
      || typeof parsed.attemptCount !== "number"
      || typeof parsed.maxAttempts !== "number"
      || typeof parsed.createdAt !== "string"
      || typeof parsed.updatedAt !== "string"
    ) {
      return null
    }

    const scheduledAt = toDate(parsed.scheduledAt)
    const createdAt = toDate(parsed.createdAt)
    const updatedAt = toDate(parsed.updatedAt)
    if (!scheduledAt || !createdAt || !updatedAt) {
      return null
    }

    return {
      id: parsed.id,
      sourceId: parsed.sourceId,
      backgroundJobId: typeof parsed.backgroundJobId === "string" ? parsed.backgroundJobId : null,
      triggerType: parsed.triggerType as RssTriggerType,
      status: parsed.status as RssQueueStatusValue,
      priority: parsed.priority,
      scheduledAt,
      leaseExpiresAt: toDate(typeof parsed.leaseExpiresAt === "string" ? parsed.leaseExpiresAt : null),
      startedAt: toDate(typeof parsed.startedAt === "string" ? parsed.startedAt : null),
      finishedAt: toDate(typeof parsed.finishedAt === "string" ? parsed.finishedAt : null),
      attemptCount: parsed.attemptCount,
      maxAttempts: parsed.maxAttempts,
      workerId: typeof parsed.workerId === "string" ? parsed.workerId : null,
      errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage : null,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : null,
      httpStatus: typeof parsed.httpStatus === "number" ? parsed.httpStatus : null,
      contentType: typeof parsed.contentType === "string" ? parsed.contentType : null,
      responseBytes: typeof parsed.responseBytes === "number" ? parsed.responseBytes : null,
      fetchedCount: typeof parsed.fetchedCount === "number" ? parsed.fetchedCount : 0,
      insertedCount: typeof parsed.insertedCount === "number" ? parsed.insertedCount : 0,
      duplicateCount: typeof parsed.duplicateCount === "number" ? parsed.duplicateCount : 0,
      createdAt,
      updatedAt,
    } satisfies RssQueueRecord
  } catch {
    return null
  }
}

function shouldPruneRecord(record: RssQueueRecord, nowMs: number) {
  return Boolean(
    record.finishedAt
    && nowMs - record.finishedAt.getTime() > RSS_QUEUE_RETENTION_MS,
  )
}

async function removeRedisRecord(redis: RedisQueueConnection, record: RssQueueRecord) {
  const multi = redis.multi()
    .hdel(RSS_QUEUE_ITEMS_KEY, record.id)
    .zrem(RSS_QUEUE_INDEX_KEY, record.id)
    .zrem(getSourceQueueIndexKey(record.sourceId), record.id)
  for (const status of RSS_QUEUE_STATUSES) {
    multi.zrem(getStatusQueueIndexKey(status), record.id)
  }
  await multi.exec()
}

async function withRedisQueueConnection<T>(
  _role: string,
  context: RedisQueueContext | undefined,
  handler: (redis: RedisQueueConnection) => Promise<T>,
) {
  const redis = context?.redis ?? getRedis()
  await connectRedisClient(redis)
  return handler(redis)
}

async function pruneRedisQueue(nowMs = Date.now(), context?: RedisQueueContext) {
  await withRedisQueueConnection("rss-harvest:queue-prune", context, async (redis) => {
    const ids = await redis.zrange(RSS_QUEUE_INDEX_KEY, 0, -1).catch(() => [])
    if (!Array.isArray(ids) || ids.length === 0) {
      return
    }

    const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...ids)
    for (let index = 0; index < ids.length; index += 1) {
      const record = parseRecord(values[index])
      if (!record || shouldPruneRecord(record, nowMs)) {
        if (record) {
          await removeRedisRecord(redis, record)
        } else {
          const orphanId = ids[index] ?? ""
          const multi = redis.multi()
            .hdel(RSS_QUEUE_ITEMS_KEY, orphanId)
            .zrem(RSS_QUEUE_INDEX_KEY, orphanId)
          for (const status of RSS_QUEUE_STATUSES) {
            multi.zrem(getStatusQueueIndexKey(status), orphanId)
          }
          await multi.exec()
        }
      }
    }
  })
}

async function pruneQueueStore(context?: RedisQueueContext) {
  if (hasRedisUrl()) {
    await pruneRedisQueue(Date.now(), context)
    return
  }

  const store = getInMemoryRssQueueStore()
  const nowMs = Date.now()
  for (const [id, record] of store.entries()) {
    if (shouldPruneRecord(record, nowMs)) {
      store.delete(id)
    }
  }
}

async function readRedisRecordsByIds(ids: string[], context?: RedisQueueContext) {
  if (ids.length === 0) {
    return [] satisfies RssQueueRecord[]
  }

  return withRedisQueueConnection("rss-harvest:queue-read", context, async (redis) => {
    const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...ids)
    return values
      .map((value) => parseRecord(value))
      .filter((item): item is RssQueueRecord => Boolean(item))
  })
}

async function readRedisSortedIds(
  key: string,
  options: {
    role: string
    start: number
    stop: number
    reverse?: boolean
  },
  context?: RedisQueueContext,
) {
  return withRedisQueueConnection(options.role, context, async (redis) => {
    const ids = options.reverse
      ? await redis.zrevrange(key, options.start, options.stop).catch(() => [])
      : await redis.zrange(key, options.start, options.stop).catch(() => [])

    return Array.isArray(ids) ? ids.map(String) : []
  })
}

async function readQueueRecord(id: string, context?: RedisQueueContext) {
  await pruneQueueStore(context)
  if (!hasRedisUrl()) {
    const record = getInMemoryRssQueueStore().get(id)
    return record ? cloneRecord(record) : null
  }

  return withRedisQueueConnection("rss-harvest:queue-read-one", context, async (redis) => {
    const value = await redis.hget(RSS_QUEUE_ITEMS_KEY, id)
    return parseRecord(value)
  })
}

async function persistQueueRecord(record: RssQueueRecord, context?: RedisQueueContext) {
  if (!hasRedisUrl()) {
    getInMemoryRssQueueStore().set(record.id, cloneRecord(record))
    return
  }

  await withRedisQueueConnection("rss-harvest:queue-write", context, async (redis) => {
    const score = record.createdAt.getTime()
    const multi = redis.multi()
      .hset(RSS_QUEUE_ITEMS_KEY, record.id, serializeRecord(record))
      .zadd(RSS_QUEUE_INDEX_KEY, String(score), record.id)
      .zadd(getSourceQueueIndexKey(record.sourceId), String(score), record.id)
    for (const status of RSS_QUEUE_STATUSES) {
      if (status === record.status) {
        multi.zadd(getStatusQueueIndexKey(status), String(score), record.id)
      } else {
        multi.zrem(getStatusQueueIndexKey(status), record.id)
      }
    }
    await multi.exec()
  })
}

function applyPatch(record: RssQueueRecord, patch: UpdateRssQueueRecordInput) {
  return {
    ...record,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date(),
  } satisfies RssQueueRecord
}

async function claimPendingRedisQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}, context?: RedisQueueContext) {
  return withRedisQueueConnection("rss-harvest:queue-claim", context, async (redis) => {
    const nextValue = await redis.eval(
      CLAIM_PENDING_RSS_QUEUE_RECORD_LUA,
      3,
      RSS_QUEUE_ITEMS_KEY,
      getStatusQueueIndexKey("PENDING"),
      getStatusQueueIndexKey("PROCESSING"),
      id,
      input.workerId,
      input.startedAt.toISOString(),
      String(input.startedAt.getTime()),
    )

    return typeof nextValue === "string" ? parseRecord(nextValue) : null
  })
}

async function claimPendingInMemoryQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}) {
  const current = getInMemoryRssQueueStore().get(id)
  if (!current || current.status !== "PENDING") {
    return null
  }

  const nextRecord = applyPatch(current, {
    backgroundJobId: null,
    status: "PROCESSING",
    startedAt: input.startedAt,
    attemptCount: current.attemptCount + 1,
    workerId: input.workerId,
    leaseExpiresAt: null,
    updatedAt: input.startedAt,
  })
  await persistQueueRecord(nextRecord)
  return cloneRecord(nextRecord)
}

function listInMemoryQueueItems(filter?: (record: RssQueueRecord) => boolean) {
  return [...getInMemoryRssQueueStore().values()]
    .filter((record) => filter ? filter(record) : true)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(cloneRecord)
}

async function resolveQueueWithSource(record: RssQueueRecord | null) {
  if (!record) {
    return null
  }

  const source = await findRssSourceById(record.sourceId)
  if (!source) {
    return null
  }

  return {
    ...record,
    source,
  } satisfies RssQueueWithSourceRecord
}

export async function createRssQueueRecord(input: CreateRssQueueRecordInput) {
  const now = new Date()
  const record: RssQueueRecord = {
    id: randomUUID(),
    sourceId: input.sourceId,
    backgroundJobId: null,
    triggerType: input.triggerType,
    status: "PENDING",
    priority: input.priority ?? 0,
    scheduledAt: input.scheduledAt ?? now,
    leaseExpiresAt: null,
    startedAt: null,
    finishedAt: null,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    workerId: null,
    errorMessage: null,
    durationMs: null,
    httpStatus: null,
    contentType: null,
    responseBytes: null,
    fetchedCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  await persistQueueRecord(record)
  return record
}

export async function findRssQueueWithSourceById(id: string) {
  return resolveQueueWithSource(await readQueueRecord(id))
}

export async function updateRssQueueRecord(id: string, patch: UpdateRssQueueRecordInput) {
  const current = await readQueueRecord(id)
  if (!current) {
    throw new Error(`RSS queue record not found: ${id}`)
  }

  const nextRecord = applyPatch(current, patch)
  await persistQueueRecord(nextRecord)
  return nextRecord
}

export async function claimPendingRssQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}) {
  await pruneQueueStore()
  if (!hasRedisUrl()) {
    return claimPendingInMemoryQueueRecord(id, input)
  }

  return claimPendingRedisQueueRecord(id, input)
}

export async function countRssQueueSummary() {
  if (!hasRedisUrl()) {
    const items = listInMemoryQueueItems()
    const pending = items.filter((item) => item.status === "PENDING").length
    const processing = items.filter((item) => item.status === "PROCESSING").length
    const failed = items.filter((item) => item.status === "FAILED").length
    return [pending, processing, failed] as const
  }

  return withRedisQueueConnection("rss-harvest:queue-summary", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureStatusIndexesBackfilled(redis)
    const [pending, processing, failed] = await Promise.all([
      redis.zcard(getStatusQueueIndexKey("PENDING")).catch(() => 0),
      redis.zcard(getStatusQueueIndexKey("PROCESSING")).catch(() => 0),
      redis.zcard(getStatusQueueIndexKey("FAILED")).catch(() => 0),
    ])
    return [Number(pending) || 0, Number(processing) || 0, Number(failed) || 0] as const
  })
}

export async function countActiveQueueItemsForSource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  return items.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length
}

export async function cancelPendingQueueItemsForSource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  let count = 0

  for (const item of items) {
    if (item.status !== "PENDING") {
      continue
    }

    await updateRssQueueRecord(item.id, {
      backgroundJobId: null,
      status: "CANCELLED",
      finishedAt: new Date(),
      errorMessage: "任务已由管理员停止",
      leaseExpiresAt: null,
      workerId: null,
    })
    count += 1
  }

  return { count }
}

export async function clearRssQueueHistoryBySource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  const finishedItems = items.filter((item) => item.finishedAt)

  if (finishedItems.length === 0) {
    return { count: 0 }
  }

  if (!hasRedisUrl()) {
    const store = getInMemoryRssQueueStore()
    for (const item of finishedItems) {
      store.delete(item.id)
    }
    return { count: finishedItems.length }
  }

  await withRedisQueueConnection("rss-harvest:queue-clear-source", undefined, async (redis) => {
    const multi = redis.multi()
    for (const item of finishedItems) {
      multi.hdel(RSS_QUEUE_ITEMS_KEY, item.id)
      multi.zrem(RSS_QUEUE_INDEX_KEY, item.id)
      multi.zrem(getSourceQueueIndexKey(sourceId), item.id)
      for (const status of RSS_QUEUE_STATUSES) {
        multi.zrem(getStatusQueueIndexKey(status), item.id)
      }
    }
    await multi.exec()
  })

  return { count: finishedItems.length }
}

export async function countRssQueueItemsBySource(sourceId: string) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId).length
  }

  return withRedisQueueConnection("rss-harvest:queue-count-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    return Number(await redis.zcard(getSourceQueueIndexKey(sourceId)).catch(() => 0))
  })
}

export async function listRssQueueItemsBySource(sourceId: string, limit = 20) {
  return listRssQueueItemsPageBySource(sourceId, 0, limit)
}

export async function listRssQueueItemsPageBySource(sourceId: string, skip: number, take: number) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId).slice(skip, skip + take)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(getSourceQueueIndexKey(sourceId), {
      role: "rss-harvest:queue-list-source-read-ids",
      start: skip,
      stop: skip + take - 1,
      reverse: true,
    }, { redis })

    return readRedisRecordsByIds(ids, { redis })
  })
}

function isExecutionQueueRecord(item: RssQueueRecord) {
  return Boolean(item.startedAt)
}

function sortExecutionRecordsDesc(left: RssQueueRecord, right: RssQueueRecord) {
  const leftTime = left.startedAt?.getTime() ?? left.createdAt.getTime()
  const rightTime = right.startedAt?.getTime() ?? right.createdAt.getTime()
  return rightTime - leftTime
}

async function listAllQueueItems() {
  if (!hasRedisUrl()) {
    await pruneQueueStore()
    return listInMemoryQueueItems()
  }

  return withRedisQueueConnection("rss-harvest:queue-list-all", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(RSS_QUEUE_INDEX_KEY, {
      role: "rss-harvest:queue-list-all-read-ids",
      start: 0,
      stop: -1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

async function listAllQueueItemsBySource(sourceId: string) {
  if (!hasRedisUrl()) {
    await pruneQueueStore()
    return listInMemoryQueueItems((item) => item.sourceId === sourceId)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-all-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(getSourceQueueIndexKey(sourceId), {
      role: "rss-harvest:queue-list-all-source-read-ids",
      start: 0,
      stop: -1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

export async function countRssExecutionItems() {
  const items = await listAllQueueItems()
  return items.filter(isExecutionQueueRecord).length
}

export async function listAllRssQueueItems() {
  return listAllQueueItems()
}

export async function listAllRssQueueItemsBySource(sourceId: string) {
  return listAllQueueItemsBySource(sourceId)
}

export async function listRssExecutionItemsPage(skip: number, take: number) {
  const items = await listAllQueueItems()
  return items
    .filter(isExecutionQueueRecord)
    .sort(sortExecutionRecordsDesc)
    .slice(skip, skip + take)
}

export async function listCompletedRssQueueIds() {
  const items = await listAllQueueItems()
  return items
    .filter((item) => Boolean(item.finishedAt))
    .map((item) => ({ id: item.id }))
}

export async function clearRssQueueHistory() {
  const finishedItems = (await listAllQueueItems()).filter((item) => Boolean(item.finishedAt))

  if (finishedItems.length === 0) {
    return { count: 0 }
  }

  if (!hasRedisUrl()) {
    const store = getInMemoryRssQueueStore()
    for (const item of finishedItems) {
      store.delete(item.id)
    }
    return { count: finishedItems.length }
  }

  await withRedisQueueConnection("rss-harvest:queue-clear-all", undefined, async (redis) => {
    const multi = redis.multi()
    for (const item of finishedItems) {
      multi.hdel(RSS_QUEUE_ITEMS_KEY, item.id)
      multi.zrem(RSS_QUEUE_INDEX_KEY, item.id)
      multi.zrem(getSourceQueueIndexKey(item.sourceId), item.id)
      for (const status of RSS_QUEUE_STATUSES) {
        multi.zrem(getStatusQueueIndexKey(status), item.id)
      }
    }
    await multi.exec()
  })

  return { count: finishedItems.length }
}

export async function countRssExecutionItemsBySource(sourceId: string) {
  const items = await listAllQueueItemsBySource(sourceId)
  return items.filter(isExecutionQueueRecord).length
}

export async function listRssExecutionItemsBySource(sourceId: string, limit = 20) {
  const items = await listAllQueueItemsBySource(sourceId)
  return items
    .filter(isExecutionQueueRecord)
    .sort(sortExecutionRecordsDesc)
    .slice(0, limit)
}

export async function listRssExecutionItemsPageBySource(sourceId: string, skip: number, take: number) {
  const items = await listAllQueueItemsBySource(sourceId)
  return items
    .filter(isExecutionQueueRecord)
    .sort(sortExecutionRecordsDesc)
    .slice(skip, skip + take)
}

export async function listCompletedRssQueueIdsBySource(sourceId: string) {
  const items = await listAllQueueItemsBySource(sourceId)
  return items
    .filter((item) => Boolean(item.finishedAt))
    .map((item) => ({ id: item.id }))
}
