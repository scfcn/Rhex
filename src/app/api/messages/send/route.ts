import { apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, readOptionalStringField } from "@/lib/api-route"
import { sendDirectMessage } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const recipientId = requireNumberField(body, "recipientId", "缺少接收方信息")
  const content = readOptionalStringField(body, "body")

  return withRequestWriteGuard(createRequestWriteGuardOptions("messages-send", {
    request,
    userId: currentUser.id,
    input: {
      recipientId,
      body: content,
    },
  }), async () => {
    const data = await sendDirectMessage(currentUser.id, recipientId, content)

    revalidateUserSurfaceCache(currentUser.id)
    revalidateUserSurfaceCache(recipientId)

    logRouteWriteSuccess({
      scope: "messages-send",
      action: "send-direct-message",
    }, {
      userId: currentUser.id,
      targetId: String(recipientId),
      extra: {
        conversationId: data.conversationId,
        messageId: data.id,
        contentAdjusted: data.contentAdjusted,
      },
    })

    return apiSuccess(data, data.contentAdjusted ? "发送成功，部分内容已自动替换" : "发送成功")
  })
}, {
  errorMessage: "发送失败",
  logPrefix: "[api/messages/send] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法发送私信",
    INACTIVE: "账号未激活，无法发送私信",
  },
})
