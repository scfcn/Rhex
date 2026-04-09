import type { NotificationType, RelatedType } from "@/db/types"
import { logError } from "@/lib/logger"

export interface BackgroundJobPayloadMap {
  "notification.create": {
    userId: number
    type: NotificationType
    senderId?: number | null
    relatedType: RelatedType
    relatedId: string
    title: string
    content: string
  }
  "notification.create-many": {
    notifications: Array<{
      userId: number
      type: NotificationType
      senderId?: number | null
      relatedType: RelatedType
      relatedId: string
      title: string
      content: string
    }>
  }
  "follow.notify-new-post": {
    postId: string
  }
  "follow.notify-post-comment": {
    commentId: string
    excludeUserIds?: number[]
  }
  "follow.notify-user-followed": {
    userId: number
    followerUserId: number
    followerName: string
  }
  "level.evaluate-user-progress": {
    userId: number
    notifyOnUpgrade: boolean
  }
  "level.sync-user-received-likes": {
    userId: number
    notifyOnUpgrade: boolean
  }
  "level.refresh-all-users": Record<string, never>
  "check-in.refresh-all-streaks": {
    includeMakeUps: boolean
  }
  "interaction.dispatch-post-like-effects": {
    postId: string
    userId: number
    targetUserId: number | null
    liked: boolean
  }
  "interaction.dispatch-post-favorite-effects": {
    postId: string
    userId: number
    favored: boolean
  }
  "interaction.dispatch-comment-create-effects": {
    postId: string
    userId: number
    commentId: string
  }
}

export type BackgroundJobName = keyof BackgroundJobPayloadMap

export interface BackgroundJobEnvelope<Name extends BackgroundJobName = BackgroundJobName> {
  name: Name
  payload: BackgroundJobPayloadMap[Name]
  enqueuedAt: string
}

type BackgroundJobHandler<Name extends BackgroundJobName> = (payload: BackgroundJobPayloadMap[Name]) => Promise<void>

export interface BackgroundJobTransport {
  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>): Promise<void>
}

const backgroundJobHandlers = new Map<BackgroundJobName, (payload: unknown) => Promise<void>>()
const DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 10
const MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 32

async function dispatchBackgroundJob(job: BackgroundJobEnvelope) {
  const handler = backgroundJobHandlers.get(job.name)

  if (!handler) {
    logError({
      scope: "background-job",
      action: "missing-handler",
      metadata: {
        jobName: job.name,
      },
    }, new Error(`Missing background job handler: ${job.name}`))
    return
  }

  try {
    await handler(job.payload)
  } catch (error) {
    logError({
      scope: "background-job",
      action: "run",
      metadata: {
        jobName: job.name,
        enqueuedAt: job.enqueuedAt,
      },
    }, error)
  }
}

function resolveInMemoryBackgroundJobConcurrency() {
  const rawValue = process.env.BACKGROUND_JOB_CONCURRENCY?.trim()

  if (!rawValue) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  return Math.min(MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY, parsed)
}

class InMemoryBackgroundJobTransport implements BackgroundJobTransport {
  private readonly concurrency: number
  private readonly queue: BackgroundJobEnvelope[] = []
  private activeCount = 0
  private pumpScheduled = false

  constructor(concurrency = resolveInMemoryBackgroundJobConcurrency()) {
    this.concurrency = concurrency
  }

  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>) {
    this.queue.push(job)
    this.schedulePump()

    return Promise.resolve()
  }

  private schedulePump() {
    if (this.pumpScheduled) {
      return
    }

    this.pumpScheduled = true

    const run = () => {
      this.pumpScheduled = false
      this.pump()
    }

    if (typeof setImmediate === "function") {
      setImmediate(run)
    } else {
      setTimeout(run, 0)
    }
  }

  private pump() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const nextJob = this.queue.shift()

      if (!nextJob) {
        return
      }

      this.activeCount += 1

      void dispatchBackgroundJob(nextJob)
        .catch((error) => {
          logError({
            scope: "background-job",
            action: "transport-run",
            metadata: {
              jobName: nextJob.name,
              enqueuedAt: nextJob.enqueuedAt,
            },
          }, error)
        })
        .finally(() => {
          this.activeCount -= 1

          if (this.queue.length > 0) {
            this.schedulePump()
          }
        })
    }
  }
}

let backgroundJobTransport: BackgroundJobTransport = new InMemoryBackgroundJobTransport()

export function registerBackgroundJobHandler<Name extends BackgroundJobName>(
  name: Name,
  handler: BackgroundJobHandler<Name>,
) {
  backgroundJobHandlers.set(name, handler as (payload: unknown) => Promise<void>)
}

export function setBackgroundJobTransport(transport: BackgroundJobTransport) {
  backgroundJobTransport = transport
}

export function getBackgroundJobTransport() {
  return backgroundJobTransport
}

export function enqueueBackgroundJob<Name extends BackgroundJobName>(
  name: Name,
  payload: BackgroundJobPayloadMap[Name],
) {
  return backgroundJobTransport.enqueue({
    name,
    payload,
    enqueuedAt: new Date().toISOString(),
  })
}
