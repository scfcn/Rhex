import { apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { submitFriendLinkApplication } from "@/lib/friend-links"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  await submitFriendLinkApplication({
    name: typeof body.name === "string" ? body.name : "",
    url: typeof body.url === "string" ? body.url : "",
    logoPath: typeof body.logoPath === "string" ? body.logoPath : "",
  })


  return apiSuccess(undefined, "申请已提交，待管理员审核")
}, {
  errorMessage: "申请提交失败",
  logPrefix: "[api/friend-links/apply] unexpected error",
})

