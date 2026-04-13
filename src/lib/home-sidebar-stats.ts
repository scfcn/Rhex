import { unstable_cache, revalidateTag } from "next/cache"
import { cache } from "react"

import { findHomeSidebarStats } from "@/db/home-sidebar-queries"

export interface HomeSidebarStatsData {
  postCount: number
  replyCount: number
  userCount: number
}

export const HOME_SIDEBAR_STATS_CACHE_TAG = "home-sidebar-stats"

const HOME_SIDEBAR_STATS_REVALIDATE_SECONDS = 60

const getPersistentHomeSidebarStats = unstable_cache(
  async (): Promise<HomeSidebarStatsData> => findHomeSidebarStats(),
  [HOME_SIDEBAR_STATS_CACHE_TAG],
  {
    tags: [HOME_SIDEBAR_STATS_CACHE_TAG],
    revalidate: HOME_SIDEBAR_STATS_REVALIDATE_SECONDS,
  },
)

const getCachedHomeSidebarStats = cache(async () => {
  return getPersistentHomeSidebarStats()
})

export function revalidateHomeSidebarStatsCache() {
  revalidateTag(HOME_SIDEBAR_STATS_CACHE_TAG, "max")
}

export async function getHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  return getCachedHomeSidebarStats()
}
