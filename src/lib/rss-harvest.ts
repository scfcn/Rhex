import { createHash, randomUUID } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { XMLParser } from "fast-xml-parser"

import { prisma } from "@/db/client"
import { resolvePagination, type PaginationResult } from "@/db/helpers"
import type { Prisma, RssLogLevel, RssTriggerType } from "@/db/types"
import {
  cancelPendingQueueItemsForSource,
  claimPendingRssQueueItems,
  clearRssLogs as clearRssLogRecords,
  clearRssQueueHistoryBySource,
  clearRssRunHistory,
  clearRssRunHistoryBySource,
  countActiveQueueItemsForSource,
  countRssEntriesForSource,
  countRssLogs,
  countRssQueueSummary,
  countRssQueueItemsBySource,
  countRssRuns,
  countRssRunsBySource,
  countRssSources,
  createManyRssEntries,
  createRssLogBatch,
  createRssQueueRecord,
  createRssRunRecord,
  createRssSourceRecord,
  findDueRssSources,
  findRssLogsForRunIds,
  findRssRunsForSource,
  findRssRunsPageForSource,
  findRssSourceByFeedUrl,
  findRssSourceById,
  getOrCreateRssSettingRecord,
  listRecentRssLogsPage,
  listRecentRssRunsPage,
  listRssQueueItemsBySource,
  listRssQueueItemsPageBySource,
  listRssSourcesPage,
  recoverExpiredRssQueueItems,
  updateRssQueueRecord,
  updateRssRunRecord,
  updateRssSettingRecord,
  updateRssSourceRecord,
  type RssQueueWithSourceRecord,
  type RssRunRecord,
  type RssSettingRecord,
  type RssSourceAdminRecord,
} from "@/db/rss-harvest-queries"
import { apiError } from "@/lib/api-route"
import { formatDateTime } from "@/lib/formatters"
import { logError, logInfo } from "@/lib/logger"
import { normalizeBoolean, normalizeNumber, normalizeText, normalizeTrimmedText } from "@/lib/shared/normalizers"

const RSS_ACCEPT_HEADER = "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.2"
const DEFAULT_IDLE_SLEEP_MS = 5_000
const DEFAULT_MAX_SOURCE_FETCH = 50
const RSS_SOURCE_PAGE_SIZE = 10
const RSS_MODAL_PAGE_SIZE = 20
const MIN_INTERVAL_MINUTES = 1
const MAX_INTERVAL_MINUTES = 24 * 60
const MIN_TIMEOUT_MS = 3_000
const MAX_TIMEOUT_MS = 60_000
const MIN_RETRY_COUNT = 0
const MAX_RETRY_COUNT = 10
const MIN_RESPONSE_BYTES = 32 * 1024
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const MIN_REDIRECTS = 0
const MAX_REDIRECTS = 5
const MIN_CONCURRENCY = 1
const MAX_CONCURRENCY = 10
const MIN_FAILURE_PAUSE_THRESHOLD = 1
const MAX_FAILURE_PAUSE_THRESHOLD = 20
const MIN_HOME_PAGE_SIZE = 1
const MAX_HOME_PAGE_SIZE = 100

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  htmlEntities: false,
})

type LogBufferItem = {
  level: RssLogLevel
  stage: string
  message: string
  detailJson?: Prisma.InputJsonValue
}

type ParsedFeedItem = {
  guid: string | null
  linkUrl: string | null
  title: string
  author: string | null
  summary: string | null
  contentHtml: string | null
  contentText: string | null
  publishedAt: Date | null
  dedupeKey: string
  rawJson: Prisma.InputJsonValue
}

type ParsedFeed = {
  title: string | null
  items: ParsedFeedItem[]
}

type FetchFeedResult = {
  finalUrl: string
  httpStatus: number
  contentType: string | null
  responseBytes: number
  body: string
}

export interface RssAdminData {
  settings: {
    id: string
    workerEnabled: boolean
    schedulerIntervalSec: number
    maxConcurrentJobs: number
    maxRetryCount: number
    retryBackoffSec: number
    fetchTimeoutMs: number
    maxResponseBytes: number
    maxRedirects: number
    failurePauseThreshold: number
    homeDisplayEnabled: boolean
    homePageSize: number
    userAgent: string
    workerHeartbeatAt: string | null
    workerLastCycleAt: string | null
    workerLastWorkerId: string | null
    workerLastSummaryJson: string | null
    workerLastErrorAt: string | null
    workerLastErrorMessage: string | null
  }
  workerStatus: {
    enabled: boolean
    online: boolean
    stateLabel: string
    heartbeatAt: string | null
    lastCycleAt: string | null
    lastWorkerId: string | null
    lastSummaryText: string | null
    lastErrorAt: string | null
    lastErrorMessage: string | null
  }
  queueSummary: {
    pending: number
    processing: number
    failed: number
  }
  sourcePagination: RssPaginationMeta
  sources: Array<{
    id: string
    siteName: string
    feedUrl: string
    logoPath: string | null
    intervalMinutes: number
    requiresReview: boolean
    status: string
    requestTimeoutMs: number | null
    maxRetryCount: number | null
    nextRunAt: string | null
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastErrorAt: string | null
    lastErrorMessage: string | null
    failureCount: number
    lastRunDurationMs: number | null
    createdAt: string
    updatedAt: string
    runCount: number
    entryCount: number
    queueCount: number
    queuePreview: Array<{
      id: string
      status: string
      triggerType: string
      attemptCount: number
      maxAttempts: number
      scheduledAt: string
      startedAt: string | null
      errorMessage: string | null
    }>
    recentRuns: Array<{
      id: string
      status: string
      triggerType: string
      startedAt: string
      finishedAt: string | null
      durationMs: number | null
      fetchedCount: number
      insertedCount: number
      duplicateCount: number
      httpStatus: number | null
      errorMessage: string | null
    }>
  }>
  recentRunsPagination: RssPaginationMeta
  recentRuns: Array<{
    id: string
    sourceId: string
    sourceName: string
    status: string
    triggerType: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    fetchedCount: number
    insertedCount: number
    duplicateCount: number
    httpStatus: number | null
    errorMessage: string | null
  }>
  recentLogsPagination: RssPaginationMeta
  recentLogs: Array<{
    id: string
    runId: string
    sourceId: string
    sourceName: string
    level: string
    stage: string
    message: string
    detailText: string | null
    createdAt: string
  }>
}

export interface RssPaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface RssSourceQueuePageData {
  sourceId: string
  sourceName: string
  items: RssAdminData["sources"][number]["queuePreview"]
  pagination: RssPaginationMeta
}

export interface RssSourceRunPageData {
  sourceId: string
  sourceName: string
  items: RssAdminData["sources"][number]["recentRuns"]
  pagination: RssPaginationMeta
}

export interface RssGlobalRunPageData {
  items: RssAdminData["recentRuns"]
  pagination: RssPaginationMeta
}

export interface RssGlobalLogPageData {
  items: RssAdminData["recentLogs"]
  pagination: RssPaginationMeta
}

export interface RssWorkerCycleResult {
  workerId: string
  recoveredCount: number
  scheduledCount: number
  claimedCount: number
  processedCount: number
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return new Date(value).toISOString()
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1_000)
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds)
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  if (value === null || typeof value === "undefined") {
    return [] as T[]
  }

  return [value]
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = decodeBasicXmlEntities(value).trim()
    return trimmed || null
  }

  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Record<string, unknown>
  const textValue = record["#text"] ?? record._ ?? record.value
  if (typeof textValue === "string") {
    const trimmed = decodeBasicXmlEntities(textValue).trim()
    return trimmed || null
  }

  return null
}

function decodeBasicXmlEntities(value: string) {
  const decodeCodePoint = (rawCode: string, radix: number, original: string) => {
    const parsed = Number.parseInt(rawCode, radix)
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 0x10ffff) {
      return original
    }

    try {
      return String.fromCodePoint(parsed)
    } catch {
      return original
    }
  }

  return value
    .replace(/&#(\d+);/g, (match, code) => decodeCodePoint(code, 10, match))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => decodeCodePoint(code, 16, match))
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const resolved = textFromUnknown(value)
    if (resolved) {
      return resolved
    }
  }

  return null
}

function stripHtmlTags(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = decodeBasicXmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || null
}

function parseOptionalDate(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDetailJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function buildDedupeKey(item: {
  guid: string | null
  linkUrl: string | null
  title: string
  contentText: string | null
  publishedAt: Date | null
}) {
  const base = item.guid || item.linkUrl || `${item.title}\n${item.contentText ?? ""}\n${item.publishedAt?.toISOString() ?? ""}`
  return createHash("sha256").update(base).digest("hex")
}

function assertPositiveInteger(value: number, min: number, max: number, message: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    apiError(400, message)
  }
}

function normalizeAbsoluteHttpUrl(rawValue: unknown, fieldLabel: string) {
  const value = normalizeText(rawValue)
  if (!value) {
    apiError(400, `${fieldLabel}不能为空`)
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    apiError(400, `${fieldLabel}格式不正确`)
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    apiError(400, `${fieldLabel}只支持 http 或 https`)
  }

  if (parsed.username || parsed.password) {
    apiError(400, `${fieldLabel}不允许包含账号密码`)
  }

  parsed.hash = ""

  return parsed.toString()
}

function normalizeSettingsInput(input: Record<string, unknown>) {
  const schedulerIntervalSec = Math.trunc(normalizeNumber(input.schedulerIntervalSec, 30, { min: 5, max: 300 }))
  const maxConcurrentJobs = Math.trunc(normalizeNumber(input.maxConcurrentJobs, 2, { min: MIN_CONCURRENCY, max: MAX_CONCURRENCY }))
  const maxRetryCount = Math.trunc(normalizeNumber(input.maxRetryCount, 3, { min: MIN_RETRY_COUNT, max: MAX_RETRY_COUNT }))
  const retryBackoffSec = Math.trunc(normalizeNumber(input.retryBackoffSec, 300, { min: 10, max: 3600 }))
  const fetchTimeoutMs = Math.trunc(normalizeNumber(input.fetchTimeoutMs, 15_000, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))
  const maxResponseBytes = Math.trunc(normalizeNumber(input.maxResponseBytes, 1_048_576, { min: MIN_RESPONSE_BYTES, max: MAX_RESPONSE_BYTES }))
  const maxRedirects = Math.trunc(normalizeNumber(input.maxRedirects, 3, { min: MIN_REDIRECTS, max: MAX_REDIRECTS }))
  const failurePauseThreshold = Math.trunc(normalizeNumber(input.failurePauseThreshold, 5, { min: MIN_FAILURE_PAUSE_THRESHOLD, max: MAX_FAILURE_PAUSE_THRESHOLD }))
  const homePageSize = Math.trunc(normalizeNumber(input.homePageSize, 20, { min: MIN_HOME_PAGE_SIZE, max: MAX_HOME_PAGE_SIZE }))
  const userAgent = normalizeTrimmedText(input.userAgent, 180, "bbs-rss-worker/1.0")

  return {
    workerEnabled: normalizeBoolean(input.workerEnabled, true),
    schedulerIntervalSec,
    maxConcurrentJobs,
    maxRetryCount,
    retryBackoffSec,
    fetchTimeoutMs,
    maxResponseBytes,
    maxRedirects,
    failurePauseThreshold,
    homeDisplayEnabled: normalizeBoolean(input.homeDisplayEnabled, false),
    homePageSize,
    userAgent,
  }
}

function normalizeSourceInput(input: Record<string, unknown>) {
  const siteName = normalizeTrimmedText(input.siteName, 80)
  if (!siteName) {
    apiError(400, "站点名称不能为空")
  }

  const feedUrl = normalizeAbsoluteHttpUrl(input.feedUrl, "RSS 地址")
  const intervalMinutes = Math.trunc(normalizeNumber(input.intervalMinutes, 30, { min: MIN_INTERVAL_MINUTES, max: MAX_INTERVAL_MINUTES }))
  assertPositiveInteger(intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, `抓取频率必须在 ${MIN_INTERVAL_MINUTES} 到 ${MAX_INTERVAL_MINUTES} 分钟之间`)

  const timeoutValue = input.requestTimeoutMs === "" || input.requestTimeoutMs === null || typeof input.requestTimeoutMs === "undefined"
    ? null
    : Math.trunc(normalizeNumber(input.requestTimeoutMs, 15_000, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))
  const retryValue = input.maxRetryCount === "" || input.maxRetryCount === null || typeof input.maxRetryCount === "undefined"
    ? null
    : Math.trunc(normalizeNumber(input.maxRetryCount, 3, { min: MIN_RETRY_COUNT, max: MAX_RETRY_COUNT }))

  return {
    siteName,
    feedUrl,
    logoPath: normalizeTrimmedText(input.logoPath, 300) || null,
    intervalMinutes,
    requiresReview: normalizeBoolean(input.requiresReview, true),
    status: normalizeBoolean(input.enabled, true) ? "ACTIVE" as const : "PAUSED" as const,
    requestTimeoutMs: timeoutValue,
    maxRetryCount: retryValue,
  }
}

function serializeSettings(record: RssSettingRecord) {
  return {
    id: record.id,
    workerEnabled: record.workerEnabled,
    schedulerIntervalSec: record.schedulerIntervalSec,
    maxConcurrentJobs: record.maxConcurrentJobs,
    maxRetryCount: record.maxRetryCount,
    retryBackoffSec: record.retryBackoffSec,
    fetchTimeoutMs: record.fetchTimeoutMs,
    maxResponseBytes: record.maxResponseBytes,
    maxRedirects: record.maxRedirects,
    failurePauseThreshold: record.failurePauseThreshold,
    homeDisplayEnabled: record.homeDisplayEnabled,
    homePageSize: record.homePageSize,
    userAgent: record.userAgent,
    workerHeartbeatAt: toIsoString(record.workerHeartbeatAt),
    workerLastCycleAt: toIsoString(record.workerLastCycleAt),
    workerLastWorkerId: record.workerLastWorkerId,
    workerLastSummaryJson: stringifyLogDetail(record.workerLastSummaryJson),
    workerLastErrorAt: toIsoString(record.workerLastErrorAt),
    workerLastErrorMessage: record.workerLastErrorMessage,
  }
}

function getWorkerStatus(record: RssSettingRecord) {
  const heartbeatAt = record.workerHeartbeatAt ? new Date(record.workerHeartbeatAt) : null
  const timeoutMs = Math.max(record.schedulerIntervalSec * 3_000, 90_000)
  const online = Boolean(
    record.workerEnabled
    && heartbeatAt
    && Date.now() - heartbeatAt.getTime() <= timeoutMs,
  )

  const stateLabel = !record.workerEnabled
    ? "已关闭"
    : online
      ? "在线"
      : heartbeatAt
        ? "离线"
        : "未上报"

  return {
    enabled: record.workerEnabled,
    online,
    stateLabel,
    heartbeatAt: toIsoString(record.workerHeartbeatAt),
    lastCycleAt: toIsoString(record.workerLastCycleAt),
    lastWorkerId: record.workerLastWorkerId,
    lastSummaryText: stringifyLogDetail(record.workerLastSummaryJson),
    lastErrorAt: toIsoString(record.workerLastErrorAt),
    lastErrorMessage: record.workerLastErrorMessage,
  }
}

function serializeRunRecord(run: RssRunRecord) {
  return {
    id: run.id,
    sourceId: run.sourceId,
    sourceName: run.source.siteName,
    status: run.status,
    triggerType: run.triggerType,
    startedAt: run.startedAt.toISOString(),
    finishedAt: toIsoString(run.finishedAt),
    durationMs: run.durationMs,
    fetchedCount: run.fetchedCount,
    insertedCount: run.insertedCount,
    duplicateCount: run.duplicateCount,
    httpStatus: run.httpStatus,
    errorMessage: run.errorMessage,
  }
}

function stringifyLogDetail(detailJson: Prisma.JsonValue | null) {
  if (!detailJson) {
    return null
  }

  try {
    return JSON.stringify(detailJson)
  } catch {
    return null
  }
}

function serializePagination(pagination: PaginationResult): RssPaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

function serializeQueuePreviewItem(item: Awaited<ReturnType<typeof listRssQueueItemsBySource>>[number]) {
  return {
    id: item.id,
    status: item.status,
    triggerType: item.triggerType,
    attemptCount: item.attemptCount,
    maxAttempts: item.maxAttempts,
    scheduledAt: item.scheduledAt.toISOString(),
    startedAt: toIsoString(item.startedAt),
    errorMessage: item.errorMessage,
  }
}

async function buildSourceAdminItem(source: RssSourceAdminRecord) {
  const [runCount, entryCount, queueCount, queuePreview, recentRuns] = await Promise.all([
    countRssRunsBySource(source.id),
    countRssEntriesForSource(source.id),
    countRssQueueItemsBySource(source.id),
    listRssQueueItemsBySource(source.id, 1),
    findRssRunsForSource(source.id, 1),
  ])

  return {
    id: source.id,
    siteName: source.siteName,
    feedUrl: source.feedUrl,
    logoPath: source.logoPath ?? null,
    intervalMinutes: source.intervalMinutes,
    requiresReview: source.requiresReview,
    status: source.status,
    requestTimeoutMs: source.requestTimeoutMs,
    maxRetryCount: source.maxRetryCount,
    nextRunAt: toIsoString(source.nextRunAt),
    lastRunAt: toIsoString(source.lastRunAt),
    lastSuccessAt: toIsoString(source.lastSuccessAt),
    lastErrorAt: toIsoString(source.lastErrorAt),
    lastErrorMessage: source.lastErrorMessage,
    failureCount: source.failureCount,
    lastRunDurationMs: source.lastRunDurationMs,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    runCount,
    entryCount,
    queueCount,
    queuePreview: queuePreview.map(serializeQueuePreviewItem),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      status: run.status,
      triggerType: run.triggerType,
      startedAt: run.startedAt.toISOString(),
      finishedAt: toIsoString(run.finishedAt),
      durationMs: run.durationMs,
      fetchedCount: run.fetchedCount,
      insertedCount: run.insertedCount,
      duplicateCount: run.duplicateCount,
      httpStatus: run.httpStatus,
      errorMessage: run.errorMessage,
    })),
  }
}

function serializeLogRecord(log: Awaited<ReturnType<typeof listRecentRssLogsPage>>[number]) {
  return {
    id: log.id,
    runId: log.runId,
    sourceId: log.run.source.id,
    sourceName: log.run.source.siteName,
    level: log.level,
    stage: log.stage,
    message: log.message,
    detailText: stringifyLogDetail(log.detailJson),
    createdAt: log.createdAt.toISOString(),
  }
}

export async function getRssAdminData(options?: {
  sourcePage?: number
  recentRunsPage?: number
  recentLogsPage?: number
}): Promise<RssAdminData> {
  const [settings, queueSummary, sourceTotal, recentRunTotal, recentLogTotal] = await Promise.all([
    getOrCreateRssSettingRecord(),
    countRssQueueSummary(),
    countRssSources(),
    countRssRuns(),
    countRssLogs(),
  ])

  const sourcePagination = resolvePagination({ page: options?.sourcePage, pageSize: RSS_SOURCE_PAGE_SIZE }, sourceTotal, [RSS_SOURCE_PAGE_SIZE], RSS_SOURCE_PAGE_SIZE)
  const recentRunsPagination = resolvePagination({ page: options?.recentRunsPage, pageSize: RSS_MODAL_PAGE_SIZE }, recentRunTotal, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const recentLogsPagination = resolvePagination({ page: options?.recentLogsPage, pageSize: RSS_MODAL_PAGE_SIZE }, recentLogTotal, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)

  const [sources, recentRuns, recentLogs] = await Promise.all([
    listRssSourcesPage(sourcePagination.skip, sourcePagination.pageSize),
    listRecentRssRunsPage(recentRunsPagination.skip, recentRunsPagination.pageSize),
    listRecentRssLogsPage(recentLogsPagination.skip, recentLogsPagination.pageSize),
  ])

  const sourceItems = await Promise.all(sources.map((source) => buildSourceAdminItem(source)))

  return {
    settings: serializeSettings(settings),
    workerStatus: getWorkerStatus(settings),
    queueSummary: {
      pending: queueSummary[0],
      processing: queueSummary[1],
      failed: queueSummary[2],
    },
    sourcePagination: serializePagination(sourcePagination),
    sources: sourceItems,
    recentRunsPagination: serializePagination(recentRunsPagination),
    recentRuns: recentRuns.map(serializeRunRecord),
    recentLogsPagination: serializePagination(recentLogsPagination),
    recentLogs: recentLogs.map(serializeLogRecord),
  }
}

export async function getRssSourceQueuePage(sourceId: string, options?: { page?: number }): Promise<RssSourceQueuePageData> {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const total = await countRssQueueItemsBySource(sourceId)
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRssQueueItemsPageBySource(sourceId, pagination.skip, pagination.pageSize)

  return {
    sourceId: source.id,
    sourceName: source.siteName,
    items: items.map(serializeQueuePreviewItem),
    pagination: serializePagination(pagination),
  }
}

export async function getRssSourceRunPage(sourceId: string, options?: { page?: number }): Promise<RssSourceRunPageData> {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const total = await countRssRunsBySource(sourceId)
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await findRssRunsPageForSource(sourceId, pagination.skip, pagination.pageSize)

  return {
    sourceId: source.id,
    sourceName: source.siteName,
    items: items.map((run) => ({
      id: run.id,
      status: run.status,
      triggerType: run.triggerType,
      startedAt: run.startedAt.toISOString(),
      finishedAt: toIsoString(run.finishedAt),
      durationMs: run.durationMs,
      fetchedCount: run.fetchedCount,
      insertedCount: run.insertedCount,
      duplicateCount: run.duplicateCount,
      httpStatus: run.httpStatus,
      errorMessage: run.errorMessage,
    })),
    pagination: serializePagination(pagination),
  }
}

export async function getRssRecentRunPage(options?: { page?: number }): Promise<RssGlobalRunPageData> {
  const total = await countRssRuns()
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRecentRssRunsPage(pagination.skip, pagination.pageSize)

  return {
    items: items.map(serializeRunRecord),
    pagination: serializePagination(pagination),
  }
}

export async function getRssRecentLogPage(options?: { page?: number }): Promise<RssGlobalLogPageData> {
  const total = await countRssLogs()
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRecentRssLogsPage(pagination.skip, pagination.pageSize)

  return {
    items: items.map(serializeLogRecord),
    pagination: serializePagination(pagination),
  }
}

export async function saveRssSettings(input: Record<string, unknown>) {
  const current = await getOrCreateRssSettingRecord()
  const normalized = normalizeSettingsInput(input)

  return updateRssSettingRecord(current.id, normalized)
}

export async function getRssHomeDisplaySettings() {
  const settings = await getOrCreateRssSettingRecord()

  return {
    homeDisplayEnabled: settings.homeDisplayEnabled,
    homePageSize: settings.homePageSize,
  }
}

export async function testRssSourceConnection(input: Record<string, unknown>) {
  const settings = await getOrCreateRssSettingRecord()
  const feedUrl = normalizeAbsoluteHttpUrl(input.feedUrl, "RSS 地址")
  const fetchTimeoutMs = input.requestTimeoutMs === "" || input.requestTimeoutMs === null || typeof input.requestTimeoutMs === "undefined"
    ? settings.fetchTimeoutMs
    : Math.trunc(normalizeNumber(input.requestTimeoutMs, settings.fetchTimeoutMs, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))

  const fetchResult = await fetchFeedXml({
    feedUrl,
    fetchTimeoutMs,
    maxResponseBytes: settings.maxResponseBytes,
    maxRedirects: settings.maxRedirects,
    userAgent: settings.userAgent,
    onLog: () => {},
  })
  const feed = parseFeedXml(fetchResult.body, fetchResult.finalUrl)
  const firstItem = feed.items[0]

  return {
    feedUrl,
    finalUrl: fetchResult.finalUrl,
    httpStatus: fetchResult.httpStatus,
    contentType: fetchResult.contentType,
    responseBytes: fetchResult.responseBytes,
    feedTitle: feed.title,
    itemCount: feed.items.length,
    firstItemTitle: firstItem?.title ?? null,
    message: `测试成功：抓取到 ${feed.items.length} 条，源标题 ${feed.title ?? "未提供"}。`,
  }
}

export async function createRssSource(input: Record<string, unknown>) {
  const normalized = normalizeSourceInput(input)
  const existing = await findRssSourceByFeedUrl(normalized.feedUrl)

  if (existing) {
    apiError(400, "该 RSS 地址已经存在")
  }

  return createRssSourceRecord({
    siteName: normalized.siteName,
    feedUrl: normalized.feedUrl,
    logoPath: normalized.logoPath,
    intervalMinutes: normalized.intervalMinutes,
    requiresReview: normalized.requiresReview,
    status: normalized.status,
    requestTimeoutMs: normalized.requestTimeoutMs,
    maxRetryCount: normalized.maxRetryCount,
    nextRunAt: normalized.status === "ACTIVE" ? new Date() : null,
  })
}

export async function updateRssSource(id: string, input: Record<string, unknown>) {
  const source = await findRssSourceById(id)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const normalized = normalizeSourceInput(input)
  const duplicate = await findRssSourceByFeedUrl(normalized.feedUrl)
  if (duplicate && duplicate.id !== source.id) {
    apiError(400, "该 RSS 地址已经存在")
  }

  return updateRssSourceRecord(id, {
    siteName: normalized.siteName,
    feedUrl: normalized.feedUrl,
    logoPath: normalized.logoPath,
    intervalMinutes: normalized.intervalMinutes,
    requiresReview: normalized.requiresReview,
    status: normalized.status,
    requestTimeoutMs: normalized.requestTimeoutMs,
    maxRetryCount: normalized.maxRetryCount,
    nextRunAt: normalized.status === "ACTIVE"
      ? source.nextRunAt ?? new Date()
      : null,
  })
}

async function enqueueRssSourceJobInternal(params: {
  source: RssSourceAdminRecord
  triggerType: RssTriggerType
  priority: number
  scheduledAt: Date
}) {
  const settings = await getOrCreateRssSettingRecord()
  const activeQueueCount = await countActiveQueueItemsForSource(params.source.id)

  if (activeQueueCount > 0) {
    return {
      queued: false,
      message: "当前任务已经在队列中或执行中",
    }
  }

  await createRssQueueRecord({
    sourceId: params.source.id,
    triggerType: params.triggerType,
    priority: params.priority,
    scheduledAt: params.scheduledAt,
    maxAttempts: params.source.maxRetryCount ?? settings.maxRetryCount,
  })

  return {
    queued: true,
    message: "任务已加入抓取队列",
  }
}

export async function enqueueRssSourceRunNow(sourceId: string) {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  return enqueueRssSourceJobInternal({
    source,
    triggerType: "MANUAL",
    priority: 100,
    scheduledAt: new Date(),
  })
}

export async function startRssSource(sourceId: string) {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  return updateRssSourceRecord(sourceId, {
    status: "ACTIVE",
    nextRunAt: new Date(),
  })
}

export async function stopRssSource(sourceId: string) {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  await Promise.all([
    updateRssSourceRecord(sourceId, {
      status: "PAUSED",
      nextRunAt: null,
    }),
    cancelPendingQueueItemsForSource(sourceId),
  ])

  return { id: sourceId }
}

export async function clearRssLogsHistory() {
  const result = await clearRssLogRecords()
  return {
    count: result.count,
  }
}

export async function clearRssSourceQueueHistory(sourceId: string) {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const result = await clearRssQueueHistoryBySource(sourceId)
  return {
    sourceId,
    sourceName: source.siteName,
    count: result.count,
  }
}

export async function clearRssSourceRunHistory(sourceId: string) {
  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const result = await clearRssRunHistoryBySource(sourceId)
  return {
    sourceId,
    sourceName: source.siteName,
    count: result.count,
  }
}

export async function clearRssRunHistoryRecords() {
  const result = await clearRssRunHistory()
  return {
    count: result.count,
  }
}

async function createRunLogBuffer(runId: string) {
  const buffer: LogBufferItem[] = []

  function push(level: RssLogLevel, stage: string, message: string, detail?: unknown) {
    buffer.push({
      level,
      stage,
      message,
      detailJson: toDetailJson(detail),
    })
  }

  async function flush() {
    await createRssLogBatch(buffer.map((item) => ({
      runId,
      level: item.level,
      stage: item.stage,
      message: item.message,
      detailJson: item.detailJson,
    })))
  }

  return {
    push,
    flush,
  }
}

function isPrivateIpv4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map((item) => Number(item))

  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase()

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true

  return false
}

async function assertSafeOutboundUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅允许抓取 http 或 https 地址")
  }

  if (url.username || url.password) {
    throw new Error("抓取地址不允许包含账号密码")
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new Error("抓取地址缺少主机名")
  }

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("禁止抓取本地或局域网地址")
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    if (isPrivateIpv4(hostname)) {
      throw new Error("禁止抓取内网 IPv4 地址")
    }
    return
  }

  if (ipVersion === 6) {
    if (isPrivateIpv6(hostname)) {
      throw new Error("禁止抓取内网 IPv6 地址")
    }
    return
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new Error("主机名解析失败")
  }

  for (const address of addresses) {
    if ((address.family === 4 && isPrivateIpv4(address.address)) || (address.family === 6 && isPrivateIpv6(address.address))) {
      throw new Error("目标主机解析到了内网地址，已拒绝访问")
    }
  }
}

async function readResponseText(response: Response, maxResponseBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    return { body: "", responseBytes: 0 }
  }

  let total = 0
  let body = ""
  const decoder = new TextDecoder()

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    total += chunk.value.byteLength
    if (total > maxResponseBytes) {
      throw new Error(`响应体超过上限 ${maxResponseBytes} 字节`)
    }

    body += decoder.decode(chunk.value, { stream: true })
  }

  body += decoder.decode()

  return {
    body,
    responseBytes: total,
  }
}

async function fetchFeedXml(params: {
  feedUrl: string
  fetchTimeoutMs: number
  maxResponseBytes: number
  maxRedirects: number
  userAgent: string
  onLog: (level: RssLogLevel, stage: string, message: string, detail?: unknown) => void
}): Promise<FetchFeedResult> {
  let currentUrl = params.feedUrl

  for (let redirectCount = 0; redirectCount <= params.maxRedirects; redirectCount += 1) {
    await assertSafeOutboundUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), params.fetchTimeoutMs)

    try {
      params.onLog("INFO", "fetch", "开始抓取 RSS 源", { url: currentUrl })

      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: RSS_ACCEPT_HEADER,
          "User-Agent": params.userAgent,
        },
      })

      const status = response.status
      const location = response.headers.get("location")

      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`收到 ${status} 重定向但缺少 Location`)
        }

        currentUrl = new URL(location, currentUrl).toString()
        params.onLog("INFO", "fetch", "检测到重定向，继续校验并抓取", {
          status,
          nextUrl: currentUrl,
        })
        continue
      }

      if (!response.ok) {
        throw new Error(`抓取失败，HTTP ${status}`)
      }

      const contentType = response.headers.get("content-type")
      const { body, responseBytes } = await readResponseText(response, params.maxResponseBytes)

      params.onLog("INFO", "fetch", "RSS 响应读取完成", {
        status,
        contentType,
        responseBytes,
      })

      return {
        finalUrl: currentUrl,
        httpStatus: status,
        contentType,
        responseBytes,
        body,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error(`重定向次数超过上限 ${params.maxRedirects}`)
}

function resolveRssItemLink(rawValue: unknown, baseUrl: string) {
  const value = firstText(rawValue)
  if (!value) {
    return null
  }

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function resolveAtomLink(rawValue: unknown, baseUrl: string) {
  const candidates = asArray(rawValue as Record<string, unknown> | Array<Record<string, unknown>>)

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue
    }

    const href = typeof candidate.href === "string" ? candidate.href.trim() : ""
    const rel = typeof candidate.rel === "string" ? candidate.rel.trim() : ""
    if (!href) {
      continue
    }

    if (rel && rel !== "alternate") {
      continue
    }

    try {
      return new URL(href, baseUrl).toString()
    } catch {
      continue
    }
  }

  return null
}

function mapRssItem(item: Record<string, unknown>, baseUrl: string): ParsedFeedItem | null {
  const title = firstText(item.title) ?? firstText(item.link)
  if (!title) {
    return null
  }

  const contentHtml = firstText(item["content:encoded"], item.description, item.content)
  const contentText = stripHtmlTags(contentHtml)
  const guid = firstText(item.guid)
  const linkUrl = resolveRssItemLink(item.link, baseUrl)
  const publishedAt = parseOptionalDate(firstText(item.pubDate, item["dc:date"], item.published))

  return {
    guid,
    linkUrl,
    title,
    author: firstText(item.author, item["dc:creator"], item.creator),
    summary: firstText(item.description, item.summary) ?? contentText,
    contentHtml,
    contentText,
    publishedAt,
    dedupeKey: buildDedupeKey({
      guid,
      linkUrl,
      title,
      contentText,
      publishedAt,
    }),
    rawJson: toDetailJson(item) ?? {},
  }
}

function mapAtomEntry(entry: Record<string, unknown>, baseUrl: string): ParsedFeedItem | null {
  const title = firstText(entry.title) ?? resolveAtomLink(entry.link, baseUrl)
  if (!title) {
    return null
  }

  const contentHtml = firstText(entry.content, entry.summary)
  const contentText = stripHtmlTags(contentHtml)
  const guid = firstText(entry.id)
  const linkUrl = resolveAtomLink(entry.link, baseUrl)
  const authorValue = typeof entry.author === "object" && entry.author
    ? firstText((entry.author as Record<string, unknown>).name, entry.author)
    : firstText(entry.author)
  const publishedAt = parseOptionalDate(firstText(entry.updated, entry.published))

  return {
    guid,
    linkUrl,
    title,
    author: authorValue,
    summary: firstText(entry.summary) ?? contentText,
    contentHtml,
    contentText,
    publishedAt,
    dedupeKey: buildDedupeKey({
      guid,
      linkUrl,
      title,
      contentText,
      publishedAt,
    }),
    rawJson: toDetailJson(entry) ?? {},
  }
}

function parseFeedXml(xml: string, baseUrl: string): ParsedFeed {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>

  if (parsed.rss && typeof parsed.rss === "object") {
    const channel = (parsed.rss as Record<string, unknown>).channel as Record<string, unknown> | undefined
    if (!channel) {
      throw new Error("RSS 文档缺少 channel")
    }

    return {
      title: firstText(channel.title),
      items: asArray(channel.item as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((item) => mapRssItem(item, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  if (parsed.feed && typeof parsed.feed === "object") {
    const feed = parsed.feed as Record<string, unknown>
    return {
      title: firstText(feed.title),
      items: asArray(feed.entry as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((entry) => mapAtomEntry(entry, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  if (parsed["rdf:RDF"] && typeof parsed["rdf:RDF"] === "object") {
    const feed = parsed["rdf:RDF"] as Record<string, unknown>
    const channel = typeof feed.channel === "object" && feed.channel ? feed.channel as Record<string, unknown> : null

    return {
      title: firstText(channel?.title),
      items: asArray(feed.item as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((item) => mapRssItem(item, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  throw new Error("无法识别 RSS/Atom 文档结构")
}

async function handleProcessSuccess(params: {
  item: RssQueueWithSourceRecord
  runId: string
  logs: Awaited<ReturnType<typeof createRunLogBuffer>>
  feed: ParsedFeed
  fetchResult: FetchFeedResult
  startedAt: Date
}) {
  const finishedAt = new Date()
  const inserted = await createManyRssEntries(params.feed.items.map((item) => ({
    sourceId: params.item.sourceId,
    guid: item.guid,
    linkUrl: item.linkUrl,
    title: item.title,
    author: item.author,
    summary: item.summary,
    contentHtml: item.contentHtml,
    contentText: item.contentText,
    publishedAt: item.publishedAt,
    reviewStatus: params.item.source.requiresReview ? "PENDING" : "APPROVED",
    reviewNote: null,
    reviewedById: null,
    reviewedAt: params.item.source.requiresReview ? null : finishedAt,
    dedupeKey: item.dedupeKey,
    rawJson: item.rawJson,
  })))

  const durationMs = finishedAt.getTime() - params.startedAt.getTime()
  const duplicateCount = Math.max(0, params.feed.items.length - inserted.count)
  const nextRunAt = params.item.source.status === "ACTIVE"
    ? addMinutes(finishedAt, params.item.source.intervalMinutes)
    : null

  params.logs.push("INFO", "store", "RSS 数据已写入数据库", {
    sourceTitle: params.feed.title,
    fetchedCount: params.feed.items.length,
    insertedCount: inserted.count,
    duplicateCount,
    nextRunAt: nextRunAt?.toISOString() ?? null,
  })
  await params.logs.flush()

  await prisma.$transaction([
    updateRssRunRecord(params.runId, {
      status: "SUCCEEDED",
      finishedAt,
      durationMs,
      httpStatus: params.fetchResult.httpStatus,
      contentType: params.fetchResult.contentType,
      responseBytes: params.fetchResult.responseBytes,
      fetchedCount: params.feed.items.length,
      insertedCount: inserted.count,
      duplicateCount,
      errorMessage: null,
    }),
    updateRssQueueRecord(params.item.id, {
      status: "SUCCEEDED",
      leaseExpiresAt: null,
      finishedAt,
      errorMessage: null,
    }),
    updateRssSourceRecord(params.item.sourceId, {
      lastRunAt: params.startedAt,
      lastSuccessAt: finishedAt,
      lastErrorAt: null,
      lastErrorMessage: null,
      failureCount: 0,
      lastRunDurationMs: durationMs,
      nextRunAt,
    }),
  ])
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "RSS 抓取失败"
}

async function handleProcessFailure(params: {
  item: RssQueueWithSourceRecord
  settings: RssSettingRecord
  runId: string
  logs: Awaited<ReturnType<typeof createRunLogBuffer>>
  startedAt: Date
  error: unknown
}) {
  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - params.startedAt.getTime()
  const errorMessage = resolveErrorMessage(params.error)
  const failureCount = params.item.source.failureCount + 1
  const shouldPauseSource = failureCount >= params.settings.failurePauseThreshold
  const shouldRetry = !shouldPauseSource && params.item.source.status === "ACTIVE" && params.item.attemptCount < params.item.maxAttempts

  params.logs.push("ERROR", "run", "RSS 抓取执行失败", {
    errorMessage,
    shouldRetry,
    shouldPauseSource,
    attemptCount: params.item.attemptCount,
    maxAttempts: params.item.maxAttempts,
  })
  await params.logs.flush()

  const queueUpdate = shouldRetry
    ? updateRssQueueRecord(params.item.id, {
        status: "PENDING",
        scheduledAt: addSeconds(finishedAt, params.settings.retryBackoffSec),
        leaseExpiresAt: null,
        startedAt: null,
        workerId: null,
        errorMessage,
      })
    : updateRssQueueRecord(params.item.id, {
        status: "FAILED",
        leaseExpiresAt: null,
        finishedAt,
        errorMessage,
      })

  await prisma.$transaction([
    updateRssRunRecord(params.runId, {
      status: "FAILED",
      finishedAt,
      durationMs,
      errorMessage,
    }),
    queueUpdate,
    updateRssSourceRecord(params.item.sourceId, {
      status: shouldPauseSource ? "PAUSED" : params.item.source.status,
      lastRunAt: params.startedAt,
      lastErrorAt: finishedAt,
      lastErrorMessage: errorMessage,
      failureCount,
      lastRunDurationMs: durationMs,
      nextRunAt: shouldPauseSource
        ? null
        : shouldRetry
          ? addSeconds(finishedAt, params.settings.retryBackoffSec)
          : params.item.source.status === "ACTIVE"
            ? addMinutes(finishedAt, params.item.source.intervalMinutes)
            : null,
    }),
  ])
}

export async function processRssQueueItem(item: RssQueueWithSourceRecord, settings: RssSettingRecord) {
  const startedAt = new Date()
  const run = await createRssRunRecord({
    sourceId: item.sourceId,
    queueId: item.id,
    triggerType: item.triggerType,
    status: "RUNNING",
    startedAt,
  })
  const logs = await createRunLogBuffer(run.id)

  try {
    logs.push("INFO", "run", "开始执行 RSS 抓取任务", {
      sourceId: item.sourceId,
      sourceName: item.source.siteName,
      triggerType: item.triggerType,
      workerId: item.workerId,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
    })

    const fetchTimeoutMs = item.source.requestTimeoutMs ?? settings.fetchTimeoutMs
    const fetchResult = await fetchFeedXml({
      feedUrl: item.source.feedUrl,
      fetchTimeoutMs,
      maxResponseBytes: settings.maxResponseBytes,
      maxRedirects: settings.maxRedirects,
      userAgent: settings.userAgent,
      onLog: logs.push,
    })

    const feed = parseFeedXml(fetchResult.body, fetchResult.finalUrl)
    logs.push("INFO", "parse", "RSS 文档解析完成", {
      finalUrl: fetchResult.finalUrl,
      itemCount: feed.items.length,
      feedTitle: feed.title,
    })

    await handleProcessSuccess({
      item,
      runId: run.id,
      logs,
      feed,
      fetchResult,
      startedAt,
    })
  } catch (error) {
    logError({
      scope: "rss-harvest",
      action: "process-queue-item",
      targetId: item.id,
      metadata: {
        sourceId: item.sourceId,
        sourceName: item.source.siteName,
      },
    }, error)

    await handleProcessFailure({
      item,
      settings,
      runId: run.id,
      logs,
      startedAt,
      error,
    })
  }
}

export async function scheduleDueRssSources(settings?: RssSettingRecord) {
  const resolvedSettings = settings ?? await getOrCreateRssSettingRecord()
  const now = new Date()
  const dueSources = await findDueRssSources(now, DEFAULT_MAX_SOURCE_FETCH)
  let scheduledCount = 0

  for (const source of dueSources) {
    const result = await enqueueRssSourceJobInternal({
      source,
      triggerType: "SCHEDULED",
      priority: 0,
      scheduledAt: now,
    })

    await updateRssSourceRecord(source.id, {
      nextRunAt: addMinutes(now, source.intervalMinutes),
    })

    if (result.queued) {
      scheduledCount += 1
    }
  }

  if (scheduledCount > 0) {
    logInfo({
      scope: "rss-harvest",
      action: "schedule",
      metadata: {
        scheduledCount,
        schedulerIntervalSec: resolvedSettings.schedulerIntervalSec,
      },
    })
  }

  return scheduledCount
}

export async function runRssWorkerCycle(workerId: string = randomUUID()): Promise<RssWorkerCycleResult> {
  const settings = await getOrCreateRssSettingRecord()
  if (!settings.workerEnabled) {
    return {
      workerId,
      recoveredCount: 0,
      scheduledCount: 0,
      claimedCount: 0,
      processedCount: 0,
    }
  }

  const now = new Date()
  const recovered = await recoverExpiredRssQueueItems(now)
  const scheduledCount = await scheduleDueRssSources(settings)
  const claimed = await claimPendingRssQueueItems({
    now,
    limit: settings.maxConcurrentJobs,
    workerId,
    leaseExpiresAt: addMilliseconds(now, settings.fetchTimeoutMs + 60_000),
  })

  if (claimed.length > 0) {
    await Promise.allSettled(claimed.map((item) => processRssQueueItem(item, settings)))
  }

  return {
    workerId,
    recoveredCount: recovered.count,
    scheduledCount,
    claimedCount: claimed.length,
    processedCount: claimed.length,
  }
}

export async function startRssWorkerLoop(options?: {
  workerId?: string
  signal?: AbortSignal
}) {
  const workerId = options?.workerId ?? randomUUID()

  while (!options?.signal?.aborted) {
    try {
      const settings = await getOrCreateRssSettingRecord()
      const cycle = await runRssWorkerCycle(workerId)
      const cycleAt = new Date()
      await updateRssSettingRecord(settings.id, {
        workerHeartbeatAt: cycleAt,
        workerLastCycleAt: cycleAt,
        workerLastWorkerId: workerId,
        workerLastSummaryJson: toDetailJson(cycle),
        workerLastErrorAt: null,
        workerLastErrorMessage: null,
      })
      logInfo({
        scope: "rss-harvest",
        action: "worker-cycle",
        metadata: { ...cycle },
      })

      await sleep(Math.max(settings.schedulerIntervalSec * 1_000, DEFAULT_IDLE_SLEEP_MS))
    } catch (error) {
      const cycleAt = new Date()
      try {
        const settings = await getOrCreateRssSettingRecord()
        await updateRssSettingRecord(settings.id, {
          workerHeartbeatAt: cycleAt,
          workerLastCycleAt: cycleAt,
          workerLastWorkerId: workerId,
          workerLastErrorAt: cycleAt,
          workerLastErrorMessage: resolveErrorMessage(error),
        })
      } catch {
        // Ignore persistence errors here and keep the worker loop alive.
      }

      logError({
        scope: "rss-harvest",
        action: "worker-loop",
        targetId: workerId,
      }, error)
      await sleep(DEFAULT_IDLE_SLEEP_MS)
    }
  }
}

export async function formatRssRunLogs(runIds: string[]) {
  const logs = await findRssLogsForRunIds(runIds)
  return logs.map((log) => `${formatDateTime(log.createdAt)} [${log.level}] ${log.stage}: ${log.message}`)
}
