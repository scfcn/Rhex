import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { markConversationAsRead } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  return withRequestWriteGuard(createRequestWriteGuardOptions("messages-read", {
    request,
    userId: currentUser.id,
    input: {
      conversationId,
    },
  }), async () => {
    await markConversationAsRead(conversationId, currentUser.id)

    logRouteWriteSuccess({
      scope: "messages-read",
      action: "mark-conversation-read",
    }, {
      userId: currentUser.id,
      targetId: conversationId,
    })

    revalidateUserSurfaceCache(currentUser.id)

    return apiSuccess(undefined, "已读状态已更新")
  })
}, {
  errorMessage: "更新会话已读失败",
  logPrefix: "[api/messages/read] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
