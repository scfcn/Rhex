import { cache } from "react"
import { CommentStatus, PostStatus } from "@prisma/client"

import { prisma } from "@/db/client"

export interface HomeSidebarStatsData {
  postCount: number
  replyCount: number
  userCount: number
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

const getCachedHomeSidebarStats = cache(async (): Promise<HomeSidebarStatsData> => {
  return readHomeSidebarStatsFromDB()
})

export async function getHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  return getCachedHomeSidebarStats()
}
