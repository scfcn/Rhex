import { prisma } from "@/db/client"
import { PostAuctionStatus, type Prisma } from "@/db/types"
import {
  getInMemoryBackgroundJobDeadLetters,
  resolveBackgroundJobConcurrency,
  resolveBackgroundJobMaxAttempts,
  resolveBackgroundJobRetryDelayMs,
  type BackgroundJobDeadLetterRecord,
} from "@/lib/background-jobs"
import { serializeDateTime } from "@/lib/formatters"
import { connectRedisClient, createRedisConnection, createRedisKey, hasRedisUrl } from "@/lib/redis"

type RedisQueueSnapshot = {
  streamLength: number | null
  pendingCount: number | null
  delayedCount: number | null
  deadLetterCount: number
  liveWorkers: Array<{
    name: string
    processRole: string
    pid: string
    connectionRole: string
    address: string | null
    idleSeconds: number | null
  }>
  deadLetters: BackgroundJobDeadLetterRecord[]
}

export interface BackgroundWorkerAdminData {
  runtime: {
    transport: "redis" | "in-memory"
    transportLabel: string
    redisEnabled: boolean
    webRuntimeMode: string
    webConsumesJobs: boolean
    concurrency: number
    maxAttempts: number
    retryBaseDelayMs: number
  }
  queue: {
    streamLength: number | null
    pendingCount: number | null
    delayedCount: number | null
    deadLetterCount: number
    liveWorkerCount: number | null
    liveWorkers: RedisQueueSnapshot["liveWorkers"]
  }
  deadLetters: Array<{
    id: string
    failedAt: string
    retryable: boolean
    jobName: string
    attempt: number
    maxAttempts: number
    errorName: string
    errorMessage: string
    auction: {
      id: string
      postId: string
      postSlug: string
      postTitle: string
      status: string
    } | null
  }>
  auctionSettlement: {
    settlingCount: number
    pendingEntryCount: number
    items: Array<{
      auctionId: string
      postId: string
      postSlug: string
      postTitle: string
      sellerName: string
      participantCount: number
      processedCount: number
      remainingCount: number
      progressPercent: number
      endsAt: string
      updatedAt: string
      winnerReady: boolean
      finalPriceReady: boolean
    }>
  }
}

function getBackgroundJobStreamKey() {
  return createRedisKey("background-jobs", "stream")
}

function getBackgroundJobConsumerGroupName() {
  return createRedisKey("background-jobs", "group")
}

function getBackgroundJobDelayedSetKey() {
  return createRedisKey("background-jobs", "delayed")
}

function getBackgroundJobDeadLetterKey() {
  return createRedisKey("background-jobs", "dead-letter")
}

function resolveBackgroundJobWebRuntimeMode() {
  return process.env.BACKGROUND_JOB_WEB_RUNTIME?.trim().toLowerCase() || "auto"
}

function resolveBackgroundJobWebConsumesJobs() {
  const mode = resolveBackgroundJobWebRuntimeMode()

  if (mode === "1" || mode === "true" || mode === "on" || mode === "enabled" || mode === "hybrid") {
    return true
  }

  if (mode === "0" || mode === "false" || mode === "off" || mode === "disabled" || mode === "worker-only") {
    return false
  }

  return process.env.NODE_ENV !== "production"
}

function serializeOptionalDateTime(input: Date | string | null | undefined) {
  if (!input) {
    return null
  }

  return serializeDateTime(input) ?? (input instanceof Date ? input.toISOString() : input)
}

function getUserDisplayName(user: { username: string; nickname?: string | null }) {
  return user.nickname?.trim() || user.username
}

function buildAuctionPendingSettlementWhere(
  auctionId: string,
  winnerUserId: number,
  finalPrice: number,
): Prisma.PostAuctionEntryWhereInput {
  return {
    auctionId,
    OR: [
      {
        userId: {
          not: winnerUserId,
        },
        frozenAmount: {
          gt: 0,
        },
      },
      {
        userId: winnerUserId,
        frozenAmount: {
          gt: finalPrice,
        },
      },
    ],
  }
}

function parseRedisClientListEntry(line: string) {
  const fields = new Map<string, string>()

  for (const token of line.split(" ")) {
    const separatorIndex = token.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = token.slice(0, separatorIndex)
    const value = token.slice(separatorIndex + 1)
    fields.set(key, value)
  }

  return fields
}

function parseRedisDeadLetter(value: string): BackgroundJobDeadLetterRecord | null {
  try {
    const parsed = JSON.parse(value) as BackgroundJobDeadLetterRecord
    if (
      !parsed
      || typeof parsed !== "object"
      || !parsed.job
      || typeof parsed.job.name !== "string"
      || typeof parsed.failedAt !== "string"
      || typeof parsed.retryable !== "boolean"
      || !parsed.error
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function readRedisQueueSnapshot(limit = 10): Promise<RedisQueueSnapshot> {
  const redis = createRedisConnection("background-job:admin")

  try {
    await connectRedisClient(redis)

    const [streamLengthRaw, delayedCountRaw, deadLetterCountRaw, deadLetterItems, clientListRaw] = await Promise.all([
      redis.xlen(getBackgroundJobStreamKey()).catch(() => null),
      redis.zcard(getBackgroundJobDelayedSetKey()).catch(() => null),
      redis.llen(getBackgroundJobDeadLetterKey()).catch(() => 0),
      redis.lrange(getBackgroundJobDeadLetterKey(), 0, Math.max(0, limit - 1)).catch(() => []),
      redis.client("LIST").catch(() => ""),
    ])

    const pendingSummaryRaw = await redis.call(
      "XPENDING",
      getBackgroundJobStreamKey(),
      getBackgroundJobConsumerGroupName(),
    ).catch(() => null)

    const pendingCount = Array.isArray(pendingSummaryRaw)
      ? Number(pendingSummaryRaw[0] ?? 0)
      : null

    const liveWorkers = String(clientListRaw)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseRedisClientListEntry)
      .map((fields) => {
        const name = fields.get("name") ?? ""
        const parts = name.split(":")
        const processRole = parts[1] ?? "unknown"
        const pid = parts[2] ?? "-"
        const connectionRole = parts.slice(3).join(":")

        return {
          name,
          processRole,
          pid,
          connectionRole,
          address: fields.get("addr") ?? null,
          idleSeconds: fields.get("idle") ? Number(fields.get("idle")) : null,
        }
      })
      .filter((item) => item.connectionRole.startsWith("background-job:") && item.connectionRole !== "background-job:admin")
      .sort((left, right) => left.name.localeCompare(right.name))

    return {
      streamLength: streamLengthRaw === null ? null : Number(streamLengthRaw),
      pendingCount,
      delayedCount: delayedCountRaw === null ? null : Number(delayedCountRaw),
      deadLetterCount: Number(deadLetterCountRaw ?? 0),
      liveWorkers,
      deadLetters: Array.isArray(deadLetterItems)
        ? deadLetterItems
          .map((item) => parseRedisDeadLetter(String(item)))
          .filter((item): item is BackgroundJobDeadLetterRecord => Boolean(item))
        : [],
    }
  } finally {
    redis.disconnect()
  }
}

async function readDeadLetterSnapshot(limit = 10) {
  if (hasRedisUrl()) {
    return readRedisQueueSnapshot(limit)
  }

  const deadLetters = getInMemoryBackgroundJobDeadLetters().slice(0, limit)
  return {
    streamLength: null,
    pendingCount: null,
    delayedCount: null,
    deadLetterCount: deadLetters.length,
    liveWorkers: [],
    deadLetters,
  } satisfies RedisQueueSnapshot
}

export async function getBackgroundWorkerAdminData(): Promise<BackgroundWorkerAdminData> {
  const [queueSnapshot, settlingAuctions] = await Promise.all([
    readDeadLetterSnapshot(12),
    prisma.postAuction.findMany({
      where: {
        status: PostAuctionStatus.SETTLING,
      },
      select: {
        id: true,
        postId: true,
        participantCount: true,
        endsAt: true,
        updatedAt: true,
        winnerUserId: true,
        finalPrice: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
        seller: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 20,
    }),
  ])

  const settlementItems = await Promise.all(settlingAuctions.map(async (auction) => {
    const remainingCount = auction.winnerUserId !== null && auction.finalPrice !== null
      ? await prisma.postAuctionEntry.count({
        where: buildAuctionPendingSettlementWhere(
          auction.id,
          auction.winnerUserId,
          auction.finalPrice,
        ),
      })
      : await prisma.postAuctionEntry.count({
        where: {
          auctionId: auction.id,
        },
      })

    const processedCount = Math.max(0, auction.participantCount - remainingCount)
    const progressPercent = auction.participantCount > 0
      ? Math.min(100, Math.round((processedCount / auction.participantCount) * 100))
      : 100

    return {
      auctionId: auction.id,
      postId: auction.postId,
      postSlug: auction.post.slug,
      postTitle: auction.post.title,
      sellerName: getUserDisplayName(auction.seller),
      participantCount: auction.participantCount,
      processedCount,
      remainingCount,
      progressPercent,
      endsAt: serializeOptionalDateTime(auction.endsAt) ?? auction.endsAt.toISOString(),
      updatedAt: serializeOptionalDateTime(auction.updatedAt) ?? auction.updatedAt.toISOString(),
      winnerReady: auction.winnerUserId !== null,
      finalPriceReady: auction.finalPrice !== null,
    }
  }))

  const deadLetterAuctionIds = Array.from(new Set(queueSnapshot.deadLetters
    .map((item) => {
      const payload = item.job.payload
      return payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
        ? payload.auctionId
        : null
    })
    .filter((item): item is string => Boolean(item))))

  const deadLetterAuctions = deadLetterAuctionIds.length > 0
    ? await prisma.postAuction.findMany({
      where: {
        id: {
          in: deadLetterAuctionIds,
        },
      },
      select: {
        id: true,
        status: true,
        postId: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
      },
    })
    : []

  const deadLetterAuctionMap = new Map(deadLetterAuctions.map((item) => [item.id, item]))
  const pendingEntryCount = settlementItems.reduce((total, item) => total + item.remainingCount, 0)

  return {
    runtime: {
      transport: hasRedisUrl() ? "redis" : "in-memory",
      transportLabel: hasRedisUrl() ? "Redis 持久化队列" : "进程内内存队列",
      redisEnabled: hasRedisUrl(),
      webRuntimeMode: resolveBackgroundJobWebRuntimeMode(),
      webConsumesJobs: resolveBackgroundJobWebConsumesJobs(),
      concurrency: resolveBackgroundJobConcurrency(),
      maxAttempts: resolveBackgroundJobMaxAttempts(),
      retryBaseDelayMs: resolveBackgroundJobRetryDelayMs(1),
    },
    queue: {
      streamLength: queueSnapshot.streamLength,
      pendingCount: queueSnapshot.pendingCount,
      delayedCount: queueSnapshot.delayedCount,
      deadLetterCount: queueSnapshot.deadLetterCount,
      liveWorkerCount: hasRedisUrl() ? queueSnapshot.liveWorkers.length : null,
      liveWorkers: queueSnapshot.liveWorkers,
    },
    deadLetters: queueSnapshot.deadLetters.map((item, index) => {
      const payload = item.job.payload
      const auctionId = payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
        ? payload.auctionId
        : null
      const auction = auctionId ? deadLetterAuctionMap.get(auctionId) ?? null : null

      return {
        id: `${item.failedAt}:${item.job.name}:${index}`,
        failedAt: item.failedAt,
        retryable: item.retryable,
        jobName: item.job.name,
        attempt: item.job.attempt,
        maxAttempts: item.job.maxAttempts,
        errorName: item.error.name,
        errorMessage: item.error.message,
        auction: auction
          ? {
            id: auction.id,
            postId: auction.postId,
            postSlug: auction.post.slug,
            postTitle: auction.post.title,
            status: auction.status,
          }
          : null,
      }
    }),
    auctionSettlement: {
      settlingCount: settlementItems.length,
      pendingEntryCount,
      items: settlementItems,
    },
  }
}
