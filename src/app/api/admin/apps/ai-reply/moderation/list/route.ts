import { apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { prisma } from "@/db/client"

const PAGE_SIZE = 20

export const GET = createAdminRouteHandler(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const pageRaw = Number(searchParams.get("page") ?? "1")
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const skip = (page - 1) * PAGE_SIZE

  const [items, total] = await Promise.all([
    prisma.aiModerationSuggestion.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
      select: {
        id: true,
        postId: true,
        suggestedBoardId: true,
        suggestedTagIds: true,
        reasoning: true,
        modelKey: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            boardId: true,
            status: true,
            authorId: true,
            createdAt: true,
            author: { select: { id: true, username: true, nickname: true } },
            board: { select: { id: true, name: true, slug: true } },
          },
        },
        suggestedBoard: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.aiModerationSuggestion.count({ where: { status: "PENDING" } }),
  ])

  const tagIds = Array.from(new Set(items.flatMap((item) => item.suggestedTagIds)))
  const tags = tagIds.length > 0
    ? await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true, slug: true },
    })
    : []
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

  const result = items.map((item) => ({
    ...item,
    suggestedTags: item.suggestedTagIds
      .map((id) => tagMap.get(id))
      .filter((tag): tag is { id: string; name: string; slug: string } => Boolean(tag)),
  }))

  return apiSuccess({
    items: result,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  })
}, {
  errorMessage: "读取 AI 审核建议失败",
  logPrefix: "[api/admin/apps/ai-reply/moderation/list:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})