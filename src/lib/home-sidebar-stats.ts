import { cache } from "react"
import { CommentStatus, PostStatus } from "@prisma/client"

import { prisma } from "@/db/client"

export interface HomeSidebarStatsData {
  postCount: number
  replyCount: number
  userCount: number
}

const HOME_SIDEBAR_STATS_CACHE_TTL_MS = 300_000

let cachedHomeSidebarStats: HomeSidebarStatsData | null = null
let homeSidebarStatsCacheExpiry = 0
let homeSidebarStatsPromise: Promise<HomeSidebarStatsData> | null = null

function setHomeSidebarStatsCache(data: HomeSidebarStatsData) {
  cachedHomeSidebarStats = data
  homeSidebarStatsCacheExpiry = Date.now() + HOME_SIDEBAR_STATS_CACHE_TTL_MS
}

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

async function getMemoryCachedHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  if (cachedHomeSidebarStats && Date.now() < homeSidebarStatsCacheExpiry) {
    return cachedHomeSidebarStats
  }

  if (!homeSidebarStatsPromise) {
    homeSidebarStatsPromise = readHomeSidebarStatsFromDB()
      .then((data) => {
        setHomeSidebarStatsCache(data)
        return data
      })
      .finally(() => {
        homeSidebarStatsPromise = null
      })
  }

  return homeSidebarStatsPromise
}

const getCachedHomeSidebarStats = cache(async (): Promise<HomeSidebarStatsData> => {
  return getMemoryCachedHomeSidebarStats()
})

export async function getHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  return getCachedHomeSidebarStats()
}
