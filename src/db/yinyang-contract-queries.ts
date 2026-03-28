import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"

const challengeDetailInclude = {
  creator: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
  challenger: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
  attempt: true,
} as const

export type YinYangChallengeDetailRow = Awaited<ReturnType<typeof findChallengeById>> extends infer TResult
  ? NonNullable<TResult>
  : never

export async function countUserCreatedChallengesInRange(userId: number, start: Date, end: Date) {
  return prisma.yinYangChallenge.count({
    where: {
      creatorId: userId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  })
}

export async function countUserAcceptedChallengesInRange(userId: number, start: Date, end: Date) {
  return prisma.yinYangChallengeAttempt.count({
    where: {
      challengerId: userId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  })
}

export async function createYinYangChallengeRecord(params: {
  tx?: Prisma.TransactionClient
  id: string
  creatorId: number
  status: "OPEN" | "LOCKED" | "SETTLED" | "CANCELLED"
  question: string
  optionA: string
  optionB: string
  correctOption: "A" | "B"
  stakePoints: number
  rewardPoints: number
  taxRateBps: number
  taxPoints: number
}) {
  const db = params.tx ?? prisma
  return db.yinYangChallenge.create({
    data: {
      id: params.id,
      creatorId: params.creatorId,
      status: params.status,
      question: params.question,
      optionA: params.optionA,
      optionB: params.optionB,
      correctOption: params.correctOption,
      stakePoints: params.stakePoints,
      rewardPoints: params.rewardPoints,
      taxRateBps: params.taxRateBps,
      taxPoints: params.taxPoints,
    },
  })
}

export async function createYinYangChallengeAttempt(params: {
  tx?: Prisma.TransactionClient
  id: string
  challengeId: string
  challengerId: number
  selectedOption: "A" | "B"
  isCorrect: boolean
  stakePoints: number
  rewardPoints: number
  taxPoints: number
}) {
  const db = params.tx ?? prisma
  return db.yinYangChallengeAttempt.create({
    data: {
      id: params.id,
      challengeId: params.challengeId,
      challengerId: params.challengerId,
      selectedOption: params.selectedOption,
      isCorrect: params.isCorrect,
      stakePoints: params.stakePoints,
      rewardPoints: params.rewardPoints,
      taxPoints: params.taxPoints,
    },
  })
}

export async function findChallengeById(challengeId: string) {
  return prisma.yinYangChallenge.findUnique({
    where: { id: challengeId },
    include: challengeDetailInclude,
  })
}

export async function listOpenYinYangChallenges(limit = 20) {
  return prisma.yinYangChallenge.findMany({
    where: {
      status: "OPEN",
    },
    include: challengeDetailInclude,
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 100)),
  })
}

export async function listRecentYinYangChallengesByUser(userId: number, limit = 20) {
  return prisma.yinYangChallenge.findMany({
    where: {
      OR: [{ creatorId: userId }, { challengerId: userId }],
    },
    include: challengeDetailInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 100)),
  })
}

export async function lockOpenChallenge(tx: Prisma.TransactionClient, challengeId: string, challengerId: number) {
  const result = await tx.yinYangChallenge.updateMany({
    where: {
      id: challengeId,
      status: "OPEN",
    },
    data: {
      status: "LOCKED",
      challengerId,
    },
  })
  return result.count > 0
}

export async function settleChallengeRecord(params: {
  tx: Prisma.TransactionClient
  challengeId: string
  winnerId: number
  loserId: number
}) {
  return params.tx.yinYangChallenge.update({
    where: { id: params.challengeId },
    data: {
      status: "SETTLED",
      winnerId: params.winnerId,
      loserId: params.loserId,
      settledAt: new Date(),
    },
  })
}

export async function getOrCreateDailyStat(userId: number, dateKey: string) {
  return prisma.yinYangChallengeDailyStat.findUnique({
    where: {
      userId_dateKey: {
        userId,
        dateKey,
      },
    },
  })
}

export async function createDailyStatRecord(params: {
  userId: number
  dateKey: string
  winCount: number
  loseCount: number
  todayProfitPoints: number
  todayLossPoints: number
}) {
  return prisma.yinYangChallengeDailyStat.create({
    data: params,
  })
}

export async function updateDailyStat(id: string, data: {
  winCount: number
  loseCount: number
  todayProfitPoints: number
  todayLossPoints: number
}) {
  return prisma.yinYangChallengeDailyStat.update({
    where: { id },
    data,
  })
}

export async function listTopTodayKings(limit = 1) {
  return prisma.yinYangChallengeDailyStat.findMany({
    where: {
      todayProfitPoints: { gt: 0 },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
    orderBy: [{ todayProfitPoints: "desc" }, { winCount: "desc" }, { todayLossPoints: "asc" }, { updatedAt: "asc" }],
    take: Math.max(1, Math.min(limit, 20)),
  })
}

export async function getTopKingByDateKey(dateKey: string) {
  const row = await prisma.yinYangChallengeDailyStat.findFirst({
    where: {
      dateKey,
      todayProfitPoints: { gt: 0 },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
    orderBy: [{ todayProfitPoints: "desc" }, { winCount: "desc" }, { todayLossPoints: "asc" }, { updatedAt: "asc" }],
  })

  return row
}


export async function listTopYinYangWinners(limit = 10) {
  const rows = await prisma.yinYangChallenge.groupBy({
    by: ["winnerId"],
    where: {
      status: "SETTLED",
      winnerId: { not: null },
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        winnerId: "desc",
      },
    },
    take: Math.max(1, Math.min(limit, 20)),
  })

  const userIds = rows.map((item: { winnerId: number | null }) => item.winnerId).filter((item: number | null): item is number => item !== null)
  if (userIds.length === 0) {
    return []
  }

  const [users, loseCounts, todayStats] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, nickname: true } }),
    prisma.yinYangChallenge.groupBy({ by: ["loserId"], where: { status: "SETTLED", loserId: { in: userIds } }, _count: { _all: true } }),
    prisma.yinYangChallengeDailyStat.findMany({ where: { userId: { in: userIds } } }),
  ])

  return rows.map((row: { winnerId: number | null; _count: { _all: number } }) => {
    const user = users.find((item) => item.id === row.winnerId)
    const loss = loseCounts.find((item: { loserId: number | null; _count: { _all: number } }) => item.loserId === row.winnerId)
    const today = todayStats
      .filter((item) => item.userId === row.winnerId)
      .reduce((acc, item) => ({
        todayProfitPoints: acc.todayProfitPoints + item.todayProfitPoints,
        todayLossPoints: acc.todayLossPoints + item.todayLossPoints,
        totalProfitPoints: acc.totalProfitPoints + item.todayProfitPoints,
        totalLossPoints: acc.totalLossPoints + item.todayLossPoints,
      }), {
        todayProfitPoints: 0,
        todayLossPoints: 0,
        totalProfitPoints: 0,
        totalLossPoints: 0,
      })
    return {
      userId: row.winnerId ?? 0,
      username: user?.username ?? `用户${row.winnerId ?? 0}`,
      nickname: user?.nickname ?? null,
      winCount: row._count._all,
      loseCount: loss?._count._all ?? 0,
      todayProfitPoints: today.todayProfitPoints,
      todayLossPoints: today.todayLossPoints,
      totalProfitPoints: today.totalProfitPoints,
      totalLossPoints: today.totalLossPoints,
    }
  })
}

export async function listTopYinYangEarners(limit = 10) {
  const rows = await prisma.yinYangChallengeDailyStat.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
    orderBy: [{ todayProfitPoints: "desc" }, { todayLossPoints: "asc" }, { winCount: "desc" }],
    take: Math.max(1, Math.min(limit, 20)),
  })

  const byUser = new Map<number, {
    userId: number
    username: string
    nickname: string | null
    winCount: number
    loseCount: number
    todayProfitPoints: number
    todayLossPoints: number
    totalProfitPoints: number
    totalLossPoints: number
  }>()

  rows.forEach((row) => {
    const current = byUser.get(row.userId)
    if (!current) {
      byUser.set(row.userId, {
        userId: row.userId,
        username: row.user.username,
        nickname: row.user.nickname,
        winCount: row.winCount,
        loseCount: row.loseCount,
        todayProfitPoints: row.todayProfitPoints,
        todayLossPoints: row.todayLossPoints,
        totalProfitPoints: row.todayProfitPoints,
        totalLossPoints: row.todayLossPoints,
      })
      return
    }
    current.winCount += row.winCount
    current.loseCount += row.loseCount
    current.todayProfitPoints = Math.max(current.todayProfitPoints, row.todayProfitPoints)
    current.todayLossPoints = Math.max(current.todayLossPoints, row.todayLossPoints)
    current.totalProfitPoints += row.todayProfitPoints
    current.totalLossPoints += row.todayLossPoints
  })

  return Array.from(byUser.values())
    .sort((left, right) => right.totalProfitPoints - left.totalProfitPoints || left.totalLossPoints - right.totalLossPoints || right.winCount - left.winCount)
    .slice(0, Math.max(1, Math.min(limit, 20)))
}
