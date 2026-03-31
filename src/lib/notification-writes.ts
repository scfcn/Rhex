import { prisma } from "@/db/client"
import { NotificationType, type Prisma, type RelatedType } from "@/db/types"

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

export function createSystemNotification(params: {
  userId: number
  relatedId: string
  title: string
  content: string
  relatedType?: RelatedType
  senderId?: number | null
  client?: NotificationWriteClient
}) {
  return createNotification({
    client: params.client,
    userId: params.userId,
    type: NotificationType.SYSTEM,
    senderId: params.senderId ?? null,
    relatedType: params.relatedType ?? "ANNOUNCEMENT",
    relatedId: params.relatedId,
    title: params.title,
    content: params.content,
  })
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
