import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getCurrentUser } from "@/lib/auth"
import { getLatestFeed, type FeedSort } from "@/lib/forum-feed"
import { mapForumFeedItemsToDisplayItems } from "@/lib/forum-feed-display"
import { getSiteSettings } from "@/lib/site-settings"

function parsePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

function parseSort(request: Request): FeedSort {
  const value = new URL(request.url).searchParams.get("sort")
  return value === "new" || value === "hot" || value === "following" ? value : "latest"
}

export const GET = createRouteHandler(async ({ request }) => {
  const page = parsePage(request)
  const sort = parseSort(request)
  const [currentUser, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])
  const result = await getLatestFeed(page, settings.homeFeedPostPageSize, sort, currentUser?.id, settings.homeHotRecentWindowHours)

  return apiSuccess({
    ...result,
    items: mapForumFeedItemsToDisplayItems(result.items, sort, settings),
  })
}, {
  errorMessage: "获取首页帖子失败",
  logPrefix: "[api/feed] unexpected error",
})
