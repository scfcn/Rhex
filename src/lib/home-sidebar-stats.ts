import { CommentStatus, PostStatus } from "@prisma/client"

import { prisma } from "@/db/client"

export interface HomeSidebarStatsData {
  postCount: number
  replyCount: number
  userCount: number
}

const HOME_SIDEBAR_STATS_CACHE_TTL_MS = 60_000

let cachedHomeSidebarStats: HomeSidebarStatsData | null = null
let homeSidebarStatsCacheExpiry = 0
let homeSidebarStatsCachePromise: Promise<HomeSidebarStatsData> | null = null

async function readHomeSidebarStatsFromDB(): Promise<HomeSidebarStatsData> {
  const [postCount, replyCount, userCount] = await Promise.all([
    prisma.post.count({
      where: {
        status: {
          notIn: [PostStatus.PENDING, PostStatus.DELETED],
        },
      },
    }),
    prisma.comment.count({
      where: {
        status: {
          notIn: [CommentStatus.PENDING, CommentStatus.DELETED],
        },
      },
    }),
    prisma.user.count(),
  ])

  return {
    postCount,
    replyCount,
    userCount,
  }
}

function setHomeSidebarStatsCache(stats: HomeSidebarStatsData) {
  cachedHomeSidebarStats = stats
  homeSidebarStatsCacheExpiry = Date.now() + HOME_SIDEBAR_STATS_CACHE_TTL_MS
}

export function invalidateHomeSidebarStatsCache() {
  cachedHomeSidebarStats = null
  homeSidebarStatsCacheExpiry = 0
  homeSidebarStatsCachePromise = null
}

async function getMemoryCachedHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  if (cachedHomeSidebarStats && Date.now() < homeSidebarStatsCacheExpiry) {
    return cachedHomeSidebarStats
  }

  if (!homeSidebarStatsCachePromise) {
    homeSidebarStatsCachePromise = readHomeSidebarStatsFromDB()
      .then((stats) => {
        setHomeSidebarStatsCache(stats)
        return stats
      })
      .finally(() => {
        homeSidebarStatsCachePromise = null
      })
  }

  return homeSidebarStatsCachePromise
}

export async function getHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  return getMemoryCachedHomeSidebarStats()
}
