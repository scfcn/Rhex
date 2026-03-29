import { prisma } from "@/db/client"
import type { BadgeGrantSource, Prisma } from "@/db/types"


export const badgeWithRulesAndCountInclude = {
  rules: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  _count: {
    select: {
      users: true,
    },
  },
} satisfies Prisma.BadgeInclude

export function findBadgeEligibilityUserSnapshot(userId: number) {
  return Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        postCount: true,
        commentCount: true,
        likeReceivedCount: true,
        inviteCount: true,
        acceptedAnswerCount: true,
        level: true,
        vipLevel: true,
      },
    }),
    prisma.userLevelProgress.findUnique({
      where: { userId },
      select: { checkInDays: true },
    }),
  ])
}

export function findGrantedUserBadge(userId: number, badgeId: string) {
  return prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    select: { id: true },
  })
}

export function findAllBadgesWithRules() {
  return prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: badgeWithRulesAndCountInclude,
  })
}

export function findGrantedBadgesForUserRecord(userId: number) {
  return prisma.userBadge.findMany({
    where: { userId },
    orderBy: [{ grantedAt: "desc" }],
    include: {
      badge: {
        include: badgeWithRulesAndCountInclude,
      },
    },
  })
}

export function findUserBadgeDisplayStates(userId: number) {
  return prisma.userBadge.findMany({
    where: { userId },
    select: {
      badgeId: true,
      isDisplayed: true,
      displayOrder: true,
    },
  })
}

export function createSelfClaimUserBadge(input: {
  userId: number
  badgeId: string
  grantSource: BadgeGrantSource
  grantSnapshot: string | null
}) {

  return prisma.userBadge.create({
    data: {
      userId: input.userId,
      badgeId: input.badgeId,
      grantSource: input.grantSource,
      grantSnapshot: input.grantSnapshot,
    },
  })
}

export function findUserBadgeWithBadge(userId: number, badgeId: string) {
  return prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    include: {
      badge: true,
    },
  })
}

export function updateUserBadgeDisplayById(id: string, input: { isDisplayed: boolean; displayOrder: number }) {
  return prisma.userBadge.update({
    where: { id },
    data: {
      isDisplayed: input.isDisplayed,
      displayOrder: input.displayOrder,
    },
  })
}

export function findDisplayedUserBadges(userId: number) {
  return prisma.userBadge.findMany({
    where: {
      userId,
      isDisplayed: true,
    },
    orderBy: [{ displayOrder: "asc" }, { grantedAt: "desc" }],
    select: {
      id: true,
      displayOrder: true,
    },
  })
}
