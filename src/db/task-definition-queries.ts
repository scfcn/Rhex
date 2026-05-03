import { prisma } from "@/db/client"
import { Prisma, TaskConditionType, TaskDefinitionStatus } from "@/db/types"

export function countTaskDefinitions() {
  return prisma.taskDefinition.count()
}

export function findTaskDefinitionById(id: string) {
  return prisma.taskDefinition.findUnique({
    where: { id },
  })
}

export function findAdminTaskDefinitions() {
  return prisma.taskDefinition.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export function listActiveTaskDefinitionsByConditionType(conditionType: TaskConditionType, now = new Date()) {
  return prisma.taskDefinition.findMany({
    where: {
      conditionType,
      status: TaskDefinitionStatus.ACTIVE,
      OR: [
        { startsAt: null, endsAt: null },
        {
          startsAt: null,
          endsAt: {
            gte: now,
          },
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: null,
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gte: now,
          },
        },
      ],
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  })
}

export function listVisibleTaskDefinitions(now = new Date()) {
  return prisma.taskDefinition.findMany({
    where: {
      status: TaskDefinitionStatus.ACTIVE,
      OR: [
        { startsAt: null, endsAt: null },
        {
          startsAt: null,
          endsAt: {
            gte: now,
          },
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: null,
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gte: now,
          },
        },
      ],
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  })
}

export function createTaskDefinitionRecord(data: Parameters<typeof prisma.taskDefinition.create>[0]["data"]) {
  return prisma.taskDefinition.create({ data })
}

export function createManyTaskDefinitionRecords(data: Prisma.TaskDefinitionCreateManyInput[]) {
  return prisma.taskDefinition.createMany({ data })
}

export function updateTaskDefinitionRecordById(id: string, data: Parameters<typeof prisma.taskDefinition.update>[0]["data"]) {
  return prisma.taskDefinition.update({
    where: { id },
    data,
  })
}
