import "server-only"

import { getAiAppConfig, isRecord, updateAiAppConfig } from "@/lib/ai/config"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

/**
 * auto-categorize 的配置挂在 `app.ai-reply` 同一条 appStateJson 记录下，
 * 以独立子 key `autoCategorize` 存放，完全不影响已有 ai-reply 字段。
 *
 * 敏感信息（apiKey / baseUrl / model）复用 ai-reply 的 provider 配置，
 * 本模块不再重复保存，避免敏感数据散落。
 */
const AI_REPLY_APP_KEY = "app.ai-reply"
const AI_REPLY_SENSITIVE_KEY = "aiReplyConfig"
const AUTO_CATEGORIZE_ENTRY_KEY = "autoCategorize"

export interface AutoCategorizeConfig {
  enabled: boolean
  /** true = 只建议，不直接落地；false = 生成后立即应用 board / tags */
  holdForReview: boolean
  promptTemplate: string
  /** 为空则放行所有 ACTIVE 板块；否则只允许这些 slug 作为候选 */
  boardWhitelistSlugs: string[]
  /** 限制 AI 最多建议多少个 tag slug */
  maxTagCount: number
}

const AUTO_CATEGORIZE_DEFAULTS: AutoCategorizeConfig = {
  enabled: false,
  holdForReview: true,
  promptTemplate: [
    "你是论坛的板块/标签分类助手。",
    "根据帖子的标题与正文，从候选板块里选出最合适的板块 slug；",
    "并从候选标签里挑出若干最相关的标签 slug（宁缺毋滥，不强制选满）。",
    "如果实在无法判断，board 字段输出空字符串。",
    "只输出 JSON，且不要附加任何解释或 markdown，形如：",
    "{\"board\":\"<slug>\",\"tags\":[\"<slug>\",...],\"reasoning\":\"<一句话理由>\"}",
  ].join("\n"),
  boardWhitelistSlugs: [],
  maxTagCount: 5,
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(v)) return true
    if (["0", "false", "no", "off"].includes(v)) return false
  }
  return fallback
}

function normalizeStringList(value: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== "string") continue
    const t = raw.trim().slice(0, maxItemLen)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= maxItems) break
  }
  return out
}

function normalizeRequiredString(value: unknown, fallback: string, maxLen: number): string {
  const raw = typeof value === "string" ? value : ""
  const trimmed = raw.trim().slice(0, maxLen)
  return trimmed || fallback
}

function normalizeAutoCategorize(entry: unknown): AutoCategorizeConfig {
  const cfg = isRecord(entry) ? entry : {}
  const parsedMaxTags = parsePositiveSafeInteger(cfg.maxTagCount)
  return {
    enabled: normalizeBoolean(cfg.enabled, AUTO_CATEGORIZE_DEFAULTS.enabled),
    holdForReview: normalizeBoolean(cfg.holdForReview, AUTO_CATEGORIZE_DEFAULTS.holdForReview),
    promptTemplate: normalizeRequiredString(cfg.promptTemplate, AUTO_CATEGORIZE_DEFAULTS.promptTemplate, 4_000),
    boardWhitelistSlugs: normalizeStringList(cfg.boardWhitelistSlugs, 100, 100),
    maxTagCount: Math.min(
      20,
      Math.max(1, typeof parsedMaxTags === "number" ? parsedMaxTags : AUTO_CATEGORIZE_DEFAULTS.maxTagCount),
    ),
  }
}

export async function getAutoCategorizeConfig(): Promise<AutoCategorizeConfig> {
  const { appStateEntry } = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const raw = appStateEntry && isRecord(appStateEntry[AUTO_CATEGORIZE_ENTRY_KEY])
    ? appStateEntry[AUTO_CATEGORIZE_ENTRY_KEY]
    : null
  return normalizeAutoCategorize(raw)
}

export interface UpdateAutoCategorizeInput {
  enabled?: unknown
  holdForReview?: unknown
  promptTemplate?: unknown
  boardWhitelistSlugs?: unknown
  maxTagCount?: unknown
}

export async function updateAutoCategorizeConfig(
  input: UpdateAutoCategorizeInput,
): Promise<AutoCategorizeConfig> {
  const snap = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const existingEntry: Record<string, unknown> = snap.appStateEntry ? { ...snap.appStateEntry } : {}
  const currentAuto = isRecord(existingEntry[AUTO_CATEGORIZE_ENTRY_KEY])
    ? (existingEntry[AUTO_CATEGORIZE_ENTRY_KEY] as Record<string, unknown>)
    : {}

  const merged: Record<string, unknown> = { ...currentAuto }
  if (input.enabled !== undefined) merged.enabled = input.enabled
  if (input.holdForReview !== undefined) merged.holdForReview = input.holdForReview
  if (input.promptTemplate !== undefined) merged.promptTemplate = input.promptTemplate
  if (input.boardWhitelistSlugs !== undefined) merged.boardWhitelistSlugs = input.boardWhitelistSlugs
  if (input.maxTagCount !== undefined) merged.maxTagCount = input.maxTagCount

  const normalized = normalizeAutoCategorize(merged)
  existingEntry[AUTO_CATEGORIZE_ENTRY_KEY] = {
    enabled: normalized.enabled,
    holdForReview: normalized.holdForReview,
    promptTemplate: normalized.promptTemplate,
    boardWhitelistSlugs: normalized.boardWhitelistSlugs,
    maxTagCount: normalized.maxTagCount,
  }

  await updateAiAppConfig(AI_REPLY_APP_KEY, {
    record: snap.record,
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
    appStateEntry: existingEntry,
  })
  return normalized
}

export { AUTO_CATEGORIZE_DEFAULTS }