import { BadgeRuleOperator, BadgeRuleType } from "@/db/types"

import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { prisma } from "@/db/client"

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim()
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function isRuleType(value: string): value is BadgeRuleType {
  return Object.values(BadgeRuleType).includes(value as BadgeRuleType)
}

function isRuleOperator(value: string): value is BadgeRuleOperator {
  return Object.values(BadgeRuleOperator).includes(value as BadgeRuleOperator)
}

function parseRules(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const ruleType = normalizeText(row.ruleType)
      const operator = normalizeText(row.operator)
      const value = normalizeText(row.value)
      const extraValue = normalizeText(row.extraValue)

      if (!isRuleType(ruleType) || !isRuleOperator(operator) || !value) {
        return null
      }

      return {
        ruleType,
        operator,
        value,
        extraValue: extraValue || null,
        sortOrder: normalizeNumber(row.sortOrder, index),
      }
    })
    .filter(Boolean) as Array<{
      ruleType: BadgeRuleType
      operator: BadgeRuleOperator
      value: string
      extraValue: string | null
      sortOrder: number
    }>
}

export const GET = createAdminRouteHandler(async () => {
  const badges = await prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      rules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
  })

  return apiSuccess(badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    code: badge.code,
    description: badge.description,
    iconPath: badge.iconPath,
    iconText: badge.iconText,
    color: badge.color,
    imageUrl: badge.imageUrl,
    category: badge.category,
    sortOrder: badge.sortOrder,
    status: badge.status,
    isHidden: badge.isHidden,
    grantedUserCount: badge._count.users,
    createdAt: badge.createdAt.toISOString(),
    updatedAt: badge.updatedAt.toISOString(),
    rules: badge.rules,
  })))
}, {
  errorMessage: "读取勋章列表失败",
  logPrefix: "[api/admin/badges:GET] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const name = requireStringField(body, "name", "勋章名称和标识不能为空")
  const code = requireStringField(body, "code", "勋章名称和标识不能为空")
  const rules = parseRules(body.rules)

  const badge = await prisma.badge.create({
    data: {
      name,
      code,
      description: normalizeText(body.description) || undefined,
      iconPath: normalizeText(body.iconPath) || undefined,
      iconText: normalizeText(body.iconText, "🏅") || "🏅",
      color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
      imageUrl: normalizeText(body.imageUrl) || undefined,
      category: normalizeText(body.category, "社区成就") || "社区成就",
      sortOrder: normalizeNumber(body.sortOrder),
      status: body.status === undefined ? true : normalizeBoolean(body.status),
      isHidden: normalizeBoolean(body.isHidden),
      rules: {
        create: rules,
      },
    },
  })

  await writeAdminLog(adminUser.id, "badge.create", "BADGE", badge.id, `创建勋章 ${name}`, requestIp)
  return apiSuccess({ id: badge.id }, "勋章已创建")
}, {
  errorMessage: "创建勋章失败",
  logPrefix: "[api/admin/badges:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少必要参数")
  const name = requireStringField(body, "name", "缺少必要参数")
  const code = requireStringField(body, "code", "缺少必要参数")
  const rules = parseRules(body.rules)

  await prisma.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id },
      data: {
        name,
        code,
        description: normalizeText(body.description) || undefined,
        iconPath: normalizeText(body.iconPath) || undefined,
        iconText: normalizeText(body.iconText, "🏅") || "🏅",
        color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
        imageUrl: normalizeText(body.imageUrl) || undefined,
        category: normalizeText(body.category, "社区成就") || "社区成就",
        sortOrder: normalizeNumber(body.sortOrder),
        status: body.status === undefined ? true : normalizeBoolean(body.status),
        isHidden: normalizeBoolean(body.isHidden),
      },
    })

    await tx.badgeRule.deleteMany({ where: { badgeId: id } })

    if (rules.length > 0) {
      await tx.badgeRule.createMany({
        data: rules.map((rule) => ({
          badgeId: id,
          ruleType: rule.ruleType,
          operator: rule.operator,
          value: rule.value,
          extraValue: rule.extraValue,
          sortOrder: rule.sortOrder,
        })),
      })
    }
  })

  await writeAdminLog(adminUser.id, "badge.update", "BADGE", id, `更新勋章 ${name}`, requestIp)
  return apiSuccess(undefined, "勋章已更新")
}, {
  errorMessage: "更新勋章失败",
  logPrefix: "[api/admin/badges:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少必要参数")

  const grantedCount = await prisma.userBadge.count({ where: { badgeId: id } })
  if (grantedCount > 0) {
    apiError(400, "该勋章已有用户领取记录，暂不允许删除")
  }

  await prisma.badge.delete({ where: { id } })
  await writeAdminLog(adminUser.id, "badge.delete", "BADGE", id, "删除勋章", requestIp)
  return apiSuccess(undefined, "勋章已删除")
}, {
  errorMessage: "删除勋章失败",
  logPrefix: "[api/admin/badges:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})
