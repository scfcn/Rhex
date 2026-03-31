export interface MessageStreamCursor {
  id: string
  createdAt: string
}

export interface MessageStreamEvent {
  type: "message.created"
  conversationId: string
  messageId: string
  senderId: number
  recipientId: number
  occurredAt: string
}

type MessageEventListener = (event: MessageStreamEvent) => void

interface MessageEventSubscriber {
  userId: number
  listener: MessageEventListener
}

class MessageEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, MessageEventSubscriber>()

  subscribe(userId: number, listener: MessageEventListener) {
    const subscriberId = this.nextSubscriberId
    this.nextSubscriberId += 1
    this.subscribers.set(subscriberId, { userId, listener })

    return () => {
      this.subscribers.delete(subscriberId)
    }
  }

  publish(event: MessageStreamEvent) {
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

const globalMessageEventBus = globalThis as typeof globalThis & {
  __bbsMessageEventBus?: MessageEventBus
}

export const messageEventBus = globalMessageEventBus.__bbsMessageEventBus ?? new MessageEventBus()

if (!globalMessageEventBus.__bbsMessageEventBus) {
  globalMessageEventBus.__bbsMessageEventBus = messageEventBus
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
