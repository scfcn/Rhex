import { ChangeType } from "@/db/types"

import { prisma } from "@/db/client"
import { withDbTransaction } from "@/db/helpers"

export interface UserCheckInCalendarEntryRow {
  checkedInOn: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: Date
}

export interface ExecuteUserCheckInParams {
  userId: number
  dateKey: string
  reward: number
  pointName: string
  makeUpCost: number
  isMakeUp: boolean
}

export interface ExecuteUserCheckInResult {
  alreadyCheckedIn: boolean
  points: number
}

export async function listUserCheckInLogsInRange(params: {
  userId: number
  startDateKey: string
  endDateKey: string
}): Promise<UserCheckInCalendarEntryRow[]> {
  return prisma.userCheckInLog.findMany({
    where: {
      userId: params.userId,
      checkedInOn: {
        gte: params.startDateKey,
        lte: params.endDateKey,
      },
    },
    orderBy: [{ checkedInOn: "asc" }],
    select: {
      checkedInOn: true,
      reward: true,
      isMakeUp: true,
      makeUpCost: true,
      createdAt: true,
    },
  })
}

export async function executeUserCheckIn(params: ExecuteUserCheckInParams): Promise<ExecuteUserCheckInResult | null> {
  return withDbTransaction(async (tx) => {
    const dbUser = await tx.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        points: true,
      },
    })

    if (!dbUser) {
      return null
    }

    const existing = await tx.userCheckInLog.findUnique({
      where: {
        userId_checkedInOn: {
          userId: dbUser.id,
          checkedInOn: params.dateKey,
        },
      },
      select: {
        userId: true,
      },
    })

    if (existing) {
      return { alreadyCheckedIn: true, points: dbUser.points }
    }

    const updatedUser = await tx.user.update({
      where: { id: dbUser.id },
      data: {
        points: {
          increment: params.reward - params.makeUpCost,
        },
      },
      select: {
        points: true,
      },
    })

    await tx.userCheckInLog.create({
      data: {
        userId: dbUser.id,
        reward: params.reward,
        checkedInOn: params.dateKey,
        isMakeUp: params.isMakeUp,
        makeUpCost: params.makeUpCost,
      },
    })

    if (params.makeUpCost > 0) {
      await tx.pointLog.create({
        data: {
          userId: dbUser.id,
          changeType: ChangeType.DECREASE,
          changeValue: params.makeUpCost,
          reason: `购买签到补签卡，消耗${params.pointName}`,
        },
      })
    }

    if (params.reward > 0) {
      await tx.pointLog.create({
        data: {
          userId: dbUser.id,
          changeType: ChangeType.INCREASE,
          changeValue: params.reward,
          reason: params.isMakeUp ? `补签获得${params.pointName}` : `每日签到获得${params.pointName}`,
        },
      })
    }

    return { alreadyCheckedIn: false, points: updatedUser.points }
  })
}
