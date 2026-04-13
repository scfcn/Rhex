import { randomUUID } from "node:crypto"

import { logError } from "@/lib/logger"
import type { MessageStreamEvent } from "@/lib/message-types"
import { connectRedisClient, createRedisConnection, createRedisKey, hasRedisUrl } from "@/lib/redis"

export type { MessageStreamEvent } from "@/lib/message-types"

export interface MessageStreamCursor {
  id: string
  createdAt: string
}

type MessageEventListener = (event: MessageStreamEvent) => void

interface MessageEventSubscriber {
  userId: number
  listener: MessageEventListener
}

type GlobalMessageEventBusState = {
  __bbsMessageEventBus?: MessageEventBus
  __bbsRedisMessageEventBusRuntime?: RedisMessageEventBusRuntime
}

const globalMessageEventBus = globalThis as typeof globalThis & GlobalMessageEventBusState

function getMessageEventChannel() {
  return createRedisKey("message-events", "pubsub")
}

class MessageEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, MessageEventSubscriber>()

  subscribe(userId: number, listener: MessageEventListener) {
    void ensureMessageEventBusRuntimeReady()

    const subscriberId = this.nextSubscriberId
    this.nextSubscriberId += 1
    this.subscribers.set(subscriberId, { userId, listener })

    return () => {
      this.subscribers.delete(subscriberId)
    }
  }

  async publish(event: MessageStreamEvent) {
    if (!hasRedisUrl()) {
      this.publishLocal(event)
      return
    }

    try {
      const runtime = getRedisMessageEventBusRuntime()
      await runtime.ensureReady()
      await runtime.publish(event)
    } catch (error) {
      logError({
        scope: "message-event-bus",
        action: "publish",
        metadata: {
          conversationId: event.conversationId,
          messageId: event.messageId,
        },
      }, error)
      this.publishLocal(event)
    }
  }

  publishLocal(event: MessageStreamEvent) {
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.userId !== event.senderId && subscriber.userId !== event.recipientId) {
        continue
      }

      try {
        subscriber.listener(event)
      } catch (error) {
        console.error("[message-event-bus] subscriber failed", error)
      }
    }
  }
}

class RedisMessageEventBusRuntime {
  private readonly runtimeId = randomUUID()
  private readonly publisher = createRedisConnection()
  private readonly subscriber = createRedisConnection()
  private readyPromise: Promise<void> | null = null

  constructor(private readonly bus: MessageEventBus) {}

  async ensureReady() {
    this.readyPromise ??= this.start()
      .catch((error) => {
        this.readyPromise = null
        throw error
      })

    return this.readyPromise
  }

  async publish(event: MessageStreamEvent) {
    await this.publisher.publish(getMessageEventChannel(), JSON.stringify({
      event,
      origin: this.runtimeId,
    }))
  }

  private async start() {
    this.subscriber.on("message", (channel, rawMessage) => {
      if (channel !== getMessageEventChannel()) {
        return
      }

      try {
        const payload = JSON.parse(rawMessage) as {
          event?: MessageStreamEvent
        }

        if (!payload?.event) {
          return
        }

        this.bus.publishLocal(payload.event)
      } catch (error) {
        logError({
          scope: "message-event-bus",
          action: "consume",
        }, error)
      }
    })

    await Promise.all([
      connectRedisClient(this.publisher),
      connectRedisClient(this.subscriber),
    ])

    await this.subscriber.subscribe(getMessageEventChannel())
  }
}

export const messageEventBus = globalMessageEventBus.__bbsMessageEventBus ?? new MessageEventBus()

if (!globalMessageEventBus.__bbsMessageEventBus) {
  globalMessageEventBus.__bbsMessageEventBus = messageEventBus
}

function getRedisMessageEventBusRuntime() {
  const runtime = globalMessageEventBus.__bbsRedisMessageEventBusRuntime ?? new RedisMessageEventBusRuntime(messageEventBus)

  if (!globalMessageEventBus.__bbsRedisMessageEventBusRuntime) {
    globalMessageEventBus.__bbsRedisMessageEventBusRuntime = runtime
  }

  return runtime
}

export async function ensureMessageEventBusRuntimeReady() {
  if (!hasRedisUrl()) {
    return
  }

  await getRedisMessageEventBusRuntime().ensureReady()
}

export function buildMessageEventPayload(event: MessageStreamEvent) {
  const cursor = getMessageStreamCursorFromEvent(event)
  const cursorId = cursor ? formatMessageStreamCursor(cursor) : undefined
  return `${cursorId ? `id: ${cursorId}\n` : ""}data: ${JSON.stringify(event)}\n\n`
}

export function buildHeartbeatPayload() {
  return `data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`
}

export function buildCursorPayload(cursor: MessageStreamCursor) {
  return `event: cursor\ndata: ${JSON.stringify({ cursor: formatMessageStreamCursor(cursor) })}\n\n`
}

export function createMessageStreamCursor(id: string, createdAt: Date | string): MessageStreamCursor {
  return {
    id,
    createdAt: typeof createdAt === "string" ? new Date(createdAt).toISOString() : createdAt.toISOString(),
  }
}

export function compareMessageStreamCursor(left: MessageStreamCursor, right: MessageStreamCursor) {
  if (left.createdAt < right.createdAt) {
    return -1
  }

  if (left.createdAt > right.createdAt) {
    return 1
  }

  return left.id.localeCompare(right.id)
}

export function isMessageStreamCursorAfter(cursor: MessageStreamCursor, baseline: MessageStreamCursor | null) {
  if (!baseline) {
    return true
  }

  return compareMessageStreamCursor(cursor, baseline) > 0
}

export function getMessageStreamCursorFromEvent(event: Pick<MessageStreamEvent, "messageId" | "occurredAt">) {
  if (!event.messageId || !event.occurredAt) {
    return null
  }

  return createMessageStreamCursor(event.messageId, event.occurredAt)
}

export function parseMessageStreamCursor(value: string | null): MessageStreamCursor | null {
  if (!value) {
    return null
  }

  const [createdAt, id] = value.split("|")
  if (!createdAt || !id) {
    return null
  }

  const timestamp = new Date(createdAt)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  return {
    id,
    createdAt: timestamp.toISOString(),
  }
}

export function formatMessageStreamCursor(cursor: MessageStreamCursor) {
  return `${cursor.createdAt}|${cursor.id}`
}
