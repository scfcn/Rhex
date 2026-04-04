import { prisma } from "@/db/client"
import { NotificationType, type Prisma, type RelatedType } from "@/db/types"
import { resolveUserProfileSettings } from "@/lib/user-profile-settings"

type NotificationWriteClient = Prisma.TransactionClient | typeof prisma

export interface NotificationDraft {
  userId: number
  type: NotificationType
  senderId?: number | null
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
}

function resolveNotificationClient(client?: NotificationWriteClient) {
  return client ?? prisma
}

function normalizeNotificationDraft(draft: NotificationDraft) {
  return {
    ...draft,
    senderId: draft.senderId ?? null,
  }
}

interface SystemNotificationWebhookPayload {
  event: "system.notification.created"
  notification: {
    id: string
    type: "SYSTEM"
    title: string
    content: string
    relatedType: RelatedType
    relatedId: string
    createdAt: string
    inboxPath: string
  }
  recipient: {
    userId: number
  }
}

function buildSystemNotificationWebhookPayload(input: {
  id: string
  userId: number
  title: string
  content: string
  relatedType: RelatedType
  relatedId: string
  createdAt: Date
}): SystemNotificationWebhookPayload {
  return {
    event: "system.notification.created",
    notification: {
      id: input.id,
      type: "SYSTEM",
      title: input.title,
      content: input.content,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      createdAt: input.createdAt.toISOString(),
      inboxPath: "/notifications",
    },
    recipient: {
      userId: input.userId,
    },
  }
}

async function postSystemNotificationWebhook(webhookUrl: string, payload: SystemNotificationWebhookPayload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function dispatchSystemNotificationWebhook(input: {
  id: string
  userId: number
  title: string
  content: string
  relatedType: RelatedType
  relatedId: string
  createdAt: Date
}) {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        signature: true,
      },
    })

    if (!recipient) {
      return
    }

    const profileSettings = resolveUserProfileSettings(recipient.signature)
    const webhookUrl = profileSettings.notificationWebhookUrl.trim()

    if (!profileSettings.externalNotificationEnabled || !webhookUrl) {
      return
    }

    await postSystemNotificationWebhook(webhookUrl, buildSystemNotificationWebhookPayload(input))
  } catch (error) {
    console.warn("[notification-writes] failed to dispatch system notification webhook", error)
  }
}

export async function sendSystemNotificationWebhookTest(params: {
  userId: number
  webhookUrl: string
}) {
  await postSystemNotificationWebhook(params.webhookUrl, buildSystemNotificationWebhookPayload({
    id: `test-${Date.now()}`,
    userId: params.userId,
    title: "系统通知 Webhook 测试",
    content: "这是一条测试通知，说明你的站外通知 Webhook 已经可以正常接收系统消息。",
    relatedType: "ANNOUNCEMENT",
    relatedId: "webhook-test",
    createdAt: new Date(),
  }))
}

export function createNotification(params: NotificationDraft & { client?: NotificationWriteClient }) {
  const { client, ...draft } = params

  return resolveNotificationClient(client).notification.create({
    data: normalizeNotificationDraft(draft),
  })
}

export function createNotifications(params: {
  notifications: NotificationDraft[]
  client?: NotificationWriteClient
}) {
  if (params.notifications.length === 0) {
    return Promise.resolve({ count: 0 })
  }

  return resolveNotificationClient(params.client).notification.createMany({
    data: params.notifications.map(normalizeNotificationDraft),
  })
}

export async function createSystemNotification(params: {
  userId: number
  relatedId: string
  title: string
  content: string
  relatedType?: RelatedType
  senderId?: number | null
  client?: NotificationWriteClient
}) {
  const notification = await createNotification({
    client: params.client,
    userId: params.userId,
    type: NotificationType.SYSTEM,
    senderId: params.senderId ?? null,
    relatedType: params.relatedType ?? "ANNOUNCEMENT",
    relatedId: params.relatedId,
    title: params.title,
    content: params.content,
  })

  void dispatchSystemNotificationWebhook({
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    content: notification.content,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    createdAt: notification.createdAt,
  })

  return notification
}

export function createReportResultNotification(params: {
  userId: number
  senderId: number
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
  client?: NotificationWriteClient
}) {
  return createNotification({
    client: params.client,
    userId: params.userId,
    type: NotificationType.REPORT_RESULT,
    senderId: params.senderId,
    relatedType: params.relatedType,
    relatedId: params.relatedId,
    title: params.title,
    content: params.content,
  })
}
