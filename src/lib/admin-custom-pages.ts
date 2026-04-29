import { AnnouncementStatus } from "@/db/types"
import {
  createCustomPageRecord,
  deleteCustomPageRecordById,
  findAdminCustomPages,
  findCustomPageById,
  findCustomPageByRoutePath,
  type CustomPageRow,
  updateCustomPageRecordById,
} from "@/db/custom-page-queries"

import { requireAdminUser } from "@/lib/admin"
import { apiError } from "@/lib/api-route"
import { stripCustomPageHtmlToText, isReservedCustomPageRoutePath, normalizeCustomPageRoutePath } from "@/lib/custom-page-types"
import { formatMonthDayTime, serializeDateTime } from "@/lib/formatters"
import { normalizeTrimmedText } from "@/lib/shared/normalizers"

export interface AdminCustomPageItem {
  id: string
  title: string
  routePath: string
  htmlContent: string
  summaryText: string
  status: AnnouncementStatus
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
  createdAt: string
  createdAtText: string
  publishedAt: string | null
  publishedAtText: string | null
  creatorName: string
}

export interface AdminCustomPageInput {
  id?: string
  title: string
  routePath?: string
  htmlContent?: string
  status: string
  includeHeader?: boolean
  includeFooter?: boolean
  includeLeftSidebar?: boolean
  includeRightSidebar?: boolean
}

function normalizeStatus(value: unknown): AnnouncementStatus {
  if (value === AnnouncementStatus.DRAFT || value === AnnouncementStatus.PUBLISHED || value === AnnouncementStatus.OFFLINE) {
    return value
  }

  return AnnouncementStatus.DRAFT
}

function mapRequiredDateTime(input: string | Date) {
  const value = serializeDateTime(input)
  if (!value) {
    apiError(500, "自定义页面时间序列化失败")
  }

  return value
}

function mapCustomPage(item: CustomPageRow): AdminCustomPageItem {
  const publishedAt = item.publishedAt ? mapRequiredDateTime(item.publishedAt) : null

  return {
    id: item.id,
    title: item.title,
    routePath: item.routePath,
    htmlContent: item.htmlContent,
    summaryText: stripCustomPageHtmlToText(item.htmlContent),
    status: item.status,
    includeHeader: item.includeHeader,
    includeFooter: item.includeFooter,
    includeLeftSidebar: item.includeLeftSidebar,
    includeRightSidebar: item.includeRightSidebar,
    createdAt: mapRequiredDateTime(item.createdAt),
    createdAtText: formatMonthDayTime(item.createdAt),
    publishedAt,
    publishedAtText: publishedAt ? formatMonthDayTime(publishedAt) : null,
    creatorName: item.creator.nickname ?? item.creator.username,
  }
}

function buildCustomPageUpdatePayload(
  record: CustomPageRow,
  overrides: Partial<{
    title: string
    routePath: string
    htmlContent: string
    status: AnnouncementStatus
    includeHeader: boolean
    includeFooter: boolean
    includeLeftSidebar: boolean
    includeRightSidebar: boolean
    publishedAt: Date | null
  }> = {},
) {
  return {
    title: record.title,
    routePath: record.routePath,
    htmlContent: record.htmlContent,
    status: record.status,
    includeHeader: record.includeHeader,
    includeFooter: record.includeFooter,
    includeLeftSidebar: record.includeLeftSidebar,
    includeRightSidebar: record.includeRightSidebar,
    publishedAt: record.publishedAt,
    ...overrides,
  }
}

export async function getAdminCustomPageList(): Promise<AdminCustomPageItem[]> {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权限访问自定义页面数据")
  }

  const items = await findAdminCustomPages()
  return items.map(mapCustomPage)
}

export async function saveAdminCustomPage(input: AdminCustomPageInput) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权操作自定义页面")
  }

  const currentRecord = input.id ? await findCustomPageById(String(input.id)) : null
  if (input.id && !currentRecord) {
    apiError(404, "自定义页面不存在")
  }

  const title = normalizeTrimmedText(input.title, 120)
  const routePath = normalizeCustomPageRoutePath(input.routePath)
  const htmlContent = String(input.htmlContent ?? "").trim()
  const status = normalizeStatus(input.status)
  const includeHeader = input.includeHeader === undefined ? true : Boolean(input.includeHeader)
  const includeFooter = input.includeFooter === undefined ? true : Boolean(input.includeFooter)
  const includeLeftSidebar = Boolean(input.includeLeftSidebar)
  const includeRightSidebar = Boolean(input.includeRightSidebar)

  if (!title) {
    apiError(400, "页面标题不能为空")
  }

  if (!routePath) {
    apiError(400, "自定义路由不能为空")
  }

  if (isReservedCustomPageRoutePath(routePath)) {
    apiError(400, "自定义路由与站点内置页面冲突，请更换一级路径")
  }

  if (!htmlContent) {
    apiError(400, "HTML 内容不能为空")
  }

  const existingRoutePage = await findCustomPageByRoutePath(routePath)
  if (existingRoutePage && existingRoutePage.id !== input.id) {
    apiError(400, "该自定义路由已被占用")
  }

  const publishedAt = status === AnnouncementStatus.PUBLISHED
    ? currentRecord?.publishedAt ?? new Date()
    : status === AnnouncementStatus.DRAFT
      ? null
      : currentRecord?.publishedAt ?? null

  const record = input.id
    ? await updateCustomPageRecordById(String(input.id), {
        title,
        routePath,
        htmlContent,
        status,
        includeHeader,
        includeFooter,
        includeLeftSidebar,
        includeRightSidebar,
        publishedAt,
      })
    : await createCustomPageRecord({
        title,
        routePath,
        htmlContent,
        status,
        includeHeader,
        includeFooter,
        includeLeftSidebar,
        includeRightSidebar,
        publishedAt,
        createdBy: currentUser.id,
      })

  return mapCustomPage(record)
}

export async function removeAdminCustomPage(id: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权删除自定义页面")
  }

  if (!id) {
    apiError(404, "自定义页面不存在")
  }

  await deleteCustomPageRecordById(id)
}

export async function updateAdminCustomPageStatus(id: string, status: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权更新自定义页面")
  }

  if (!id) {
    apiError(404, "自定义页面不存在")
  }

  const currentRecord = await findCustomPageById(id)
  if (!currentRecord) {
    apiError(404, "自定义页面不存在")
  }

  const normalizedStatus = normalizeStatus(status)
  const publishedAt = normalizedStatus === AnnouncementStatus.PUBLISHED
    ? currentRecord.publishedAt ?? new Date()
    : normalizedStatus === AnnouncementStatus.DRAFT
      ? null
      : currentRecord.publishedAt

  const updated = await updateCustomPageRecordById(
    id,
    buildCustomPageUpdatePayload(currentRecord, {
      status: normalizedStatus,
      publishedAt,
    }),
  )

  return mapCustomPage(updated)
}
