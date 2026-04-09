import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  addPostToFavoriteCollection,
  createFavoriteCollection,
  deleteFavoriteCollection,
  getFavoriteCollectionModalData,
  getUserFavoriteCollectionManageData,
  removePostFromFavoriteCollection,
  reviewFavoriteCollectionSubmission,
  updateFavoriteCollection,
} from "@/lib/favorite-collections"

export const GET = createUserRouteHandler<unknown>(async ({ request, currentUser }) => {
  const url = new URL(request.url)
  const view = url.searchParams.get("view")?.trim() ?? "modal"
  const pageValue = Number(url.searchParams.get("page") ?? "1")

  if (view === "owned") {
    const data = await getUserFavoriteCollectionManageData(currentUser.id, {
      page: Number.isFinite(pageValue) ? pageValue : 1,
    })
    return apiSuccess(data)
  }

  const postId = url.searchParams.get("postId")?.trim() ?? ""
  const data = await getFavoriteCollectionModalData({
    userId: currentUser.id,
    postId,
    page: Number.isFinite(pageValue) ? pageValue : 1,
    q: url.searchParams.get("q"),
  })
  return apiSuccess(data)
}, {
  errorMessage: "合集数据加载失败",
  logPrefix: "[api/favorite-collections:GET] unexpected error",
  unauthorizedMessage: "请先登录后再使用合集功能",
  allowStatuses: ["ACTIVE", "MUTED"],
})

export const POST = createUserRouteHandler<unknown>(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""

  if (action === "create") {
    const created = await createFavoriteCollection({
      userId: currentUser.id,
      input: body.collection && typeof body.collection === "object" ? body.collection as Record<string, unknown> : {},
      postId: typeof body.postId === "string" ? body.postId.trim() : undefined,
    })
    return apiSuccess(created, body.postId ? "合集已创建，帖子已加入" : "合集已创建")
  }

  if (action === "add-post") {
    const result = await addPostToFavoriteCollection({
      userId: currentUser.id,
      postId: typeof body.postId === "string" ? body.postId.trim() : "",
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
    })
    return apiSuccess(result, result.message)
  }

  if (action === "update") {
    const updated = await updateFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
      input: body.collection && typeof body.collection === "object" ? body.collection as Record<string, unknown> : {},
    })
    return apiSuccess(updated, "合集已更新")
  }

  if (action === "delete") {
    const deleted = await deleteFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
    })
    return apiSuccess(deleted, "合集已删除")
  }

  if (action === "remove-post") {
    const result = await removePostFromFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
      postId: typeof body.postId === "string" ? body.postId.trim() : "",
    })
    return apiSuccess(result, "帖子已移出合集")
  }

  if (action === "review-submission") {
    const result = await reviewFavoriteCollectionSubmission({
      userId: currentUser.id,
      submissionId: typeof body.submissionId === "string" ? body.submissionId.trim() : "",
      decision: body.decision === "REJECT" ? "REJECT" : "APPROVE",
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined,
    })
    return apiSuccess(result, result.status === "APPROVED" ? "投稿已通过" : "投稿已驳回")
  }

  return apiSuccess(undefined, "未执行任何操作")
}, {
  errorMessage: "合集操作失败",
  logPrefix: "[api/favorite-collections:POST] unexpected error",
  unauthorizedMessage: "请先登录后再使用合集功能",
  allowStatuses: ["ACTIVE", "MUTED"],
})
