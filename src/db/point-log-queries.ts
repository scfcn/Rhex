import { prisma } from "@/db/client"

export function countUserPointLogs(userId: number) {
  return prisma.pointLog.count({
    where: { userId },
  })
}

export function findUserPointLogsPage(userId: number, skip: number, take: number) {
  return prisma.pointLog.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  })
}
