import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getCurrentUser } from "@/lib/auth"

export const GET = createRouteHandler(async () => {
  const user = await getCurrentUser()
  return apiSuccess(user, "success")
}, {
  errorMessage: "获取当前用户失败",
  logPrefix: "[api/auth/me] unexpected error",
})

