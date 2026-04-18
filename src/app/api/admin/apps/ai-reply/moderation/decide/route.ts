import {
  apiError,
  apiSuccess,
  createAdminRouteHandler,
  readJsonBody,
  requireStringField,
  type JsonObject,
} from "@/lib/api-route"
import { prisma } from "@/db/client"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = (await readJsonBody(request)) as JsonObject
  const id = requireStringField(body, "id", "缺少建议 ID")
  const actionRaw = requireStringField(body, "action", "缺少操作类型")
  const action = actionRaw.toLowerCase()

  if (action !== "approve" && action !== "reject") {
    return apiError(400, "操作类型不合法，仅支持 approve 或 reject")
  }

  const suggestion = await prisma.aiModerationSuggestion.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      postId: true,
      suggestedBoardId: true,
      suggestedTagIds: true,
    },
  })

  if (!suggestion) {
    return apiError(404, "审核建议不存在")
  }

  if (suggestion.status !== "PENDING") {
    return apiError(409, "该建议已被处理")
  }

  const now = new Date()

  if (action === "reject") {
    await prisma.aiModerationSuggestion.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerId: adminUser.id,
        decidedAt: now,
      },
    })
    return apiSuccess({ id, status: "REJECTED" }, "已驳回该建议")
  }

  // approve：事务更新 Post.boardId + PostTag 关联 + suggestion 状态
  const { suggestedBoardId, suggestedTagIds, postId } = suggestion

  // 校验目标 Board 仍存在且 ACTIVE
  if (suggestedBoardId) {
    const board = await prisma.board.findUnique({
      where: { id: suggestedBoardId },
      select: { id: true, status: true },
    })
    if (!board || board.status !== "ACTIVE") {
      return apiError(409, "建议的板块已失效，无法采纳")
    }
  }

  // 校验 tags 仍存在
  const validTagIds = suggestedTagIds.length > 0
    ? (await prisma.tag.findMany({
      where: { id: { in: suggestedTagIds } },
      select: { id: true },
    })).map((tag) => tag.id)
    : []

  await prisma.$transaction(async (tx) => {
    if (suggestedBoardId) {
      await tx.post.update({
        where: { id: postId },
        data: { boardId: suggestedBoardId },
      })
    }

    if (validTagIds.length > 0) {
      // 以建议 tags 替换原 tags（简单策略：删除旧的，加新的；若 tag 已存在则跳过）
      await tx.postTag.deleteMany({ where: { postId } })
      await tx.postTag.createMany({
        data: validTagIds.map((tagId) => ({ postId, tagId })),
        skipDuplicates: true,
      })
    }

    await tx.aiModerationSuggestion.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewerId: adminUser.id,
        decidedAt: now,
      },
    })
  })

  revalidateHomeSidebarStatsCache()
  expireTaxonomyCacheImmediately()

  return apiSuccess({ id, status: "APPROVED" }, "已采纳该建议并应用到帖子")
}, {
  errorMessage: "处理审核建议失败",
  logPrefix: "[api/admin/apps/ai-reply/moderation/decide:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})