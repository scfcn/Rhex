import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { purchaseInviteCode } from "@/lib/invite-codes"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  return withRequestWriteGuard(createRequestWriteGuardOptions("invite-codes-purchase", {
    request,
    userId: currentUser.id,
    input: {},
  }), async () => {
    const inviteCode = await purchaseInviteCode(currentUser.id)
    revalidateUserSurfaceCache(currentUser.id)
    return apiSuccess({ code: inviteCode.code }, "邀请码购买成功")
  })
}, {
  errorMessage: "邀请码购买失败",
  logPrefix: "[api/invite-codes/purchase] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

