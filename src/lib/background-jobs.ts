import { logError } from "@/lib/logger"

export interface BackgroundJobPayloadMap {
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
  "level.refresh-all-users": Record<string, never>
  "check-in.refresh-all-streaks": {
    includeMakeUps: boolean
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

class InMemoryBackgroundJobTransport implements BackgroundJobTransport {
  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>) {
    const run = () => {
      void dispatchBackgroundJob(job)
    }

    if (typeof setImmediate === "function") {
      setImmediate(run)
    } else {
      setTimeout(run, 0)
    }

    return Promise.resolve()
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
