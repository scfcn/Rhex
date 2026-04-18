import "server-only"

import { createSystemNotification } from "@/lib/notification-writes"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonNotificationCreateInput,
  AddonNotificationRecord,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveNotificationRecipient(input: AddonNotificationCreateInput) {
  return resolveAddonActor({
    userId: input.recipientId,
    username: input.recipientUsername,
    label: "通知接收账号",
  })
}

function mapAddonNotificationRecord(
  notification: Awaited<ReturnType<typeof createSystemNotification>>,
): AddonNotificationRecord {
  return {
    id: notification.id,
    userId: notification.userId,
    type: "SYSTEM",
    senderId: notification.senderId ?? null,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    title: notification.title,
    content: notification.content,
    createdAt: notification.createdAt.toISOString(),
  }
}

export async function createAddonNotification(
  input: AddonNotificationCreateInput,
): Promise<AddonNotificationRecord> {
  const recipient = await resolveNotificationRecipient(input)
  const notification = await createSystemNotification({
    userId: recipient.id,
    senderId: input.senderId ?? null,
    relatedType: input.relatedType ?? "ANNOUNCEMENT",
    relatedId: normalizeOptionalString(input.relatedId),
    title: normalizeOptionalString(input.title),
    content: normalizeOptionalString(input.content),
  })

  return mapAddonNotificationRecord(notification)
}

export async function createAddonNotifications(
  inputs: AddonNotificationCreateInput[],
): Promise<AddonNotificationRecord[]> {
  return Promise.all((Array.isArray(inputs) ? inputs : []).map((input) => createAddonNotification(input)))
}
