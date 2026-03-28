import { NotificationType, type Prisma } from "@/db/types"

import { extractSummaryFromContent } from "@/lib/content"
import { extractMentionTexts, findMentionUsersByContent } from "@/lib/mentions"
import { getAllPostContentText } from "@/lib/post-content"

export function extractPostMentionTextsFromText(content: string) {
  return extractMentionTexts(content)
}

export function extractPostMentionTexts(rawPostContent: string) {
  const plainTextContent = getAllPostContentText(rawPostContent)
  return extractMentionTexts(plainTextContent)
}


export async function findPostMentionUsers(rawPostContent: string) {
  const plainTextContent = getAllPostContentText(rawPostContent)
  return findMentionUsersByContent(plainTextContent)
}

export async function createPostMentionNotifications(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  senderName: string
  rawPostContent: string
  excludeUserIds?: number[]
}) {
  const plainTextContent = getAllPostContentText(params.rawPostContent)
  const mentionUsers = await findMentionUsersByContent(plainTextContent)
  const excludeUserIds = new Set([params.senderId, ...(params.excludeUserIds ?? [])])
  const notificationTargets = mentionUsers.filter((user) => !excludeUserIds.has(user.id))

  if (notificationTargets.length === 0) {
    return 0
  }

  const summary = extractSummaryFromContent(plainTextContent, 80)

  await params.tx.notification.createMany({
    data: notificationTargets.map((user) => ({
      userId: user.id,
      type: NotificationType.MENTION,
      senderId: params.senderId,
      relatedType: "POST" as const,
      relatedId: params.postId,
      title: "你在帖子中被提及了",
      content: `${params.senderName} 在帖子中提到了你：${summary || "查看帖子详情"}`,
    })),
  })

  return notificationTargets.length
}
