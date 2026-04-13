import { prisma } from "@/db/client"

import { apiError, type JsonObject } from "@/lib/api-route"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

const AI_REPLY_APP_KEY = "app.ai-reply"
const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"
const AI_REPLY_SENSITIVE_KEY = "aiReplyConfig"

const AI_REPLY_DEFAULTS = {
  enabled: false,
  baseUrl: "https://api.openai.com/v1",
  model: "",
  agentUserId: null as number | null,
  respondToPostMentions: true,
  respondToCommentMentions: true,
  temperature: 0.7,
  maxOutputTokens: 500,
  timeoutMs: 30_000,
  systemPrompt: [
    "你是论坛里的 AI 助手账号，负责以普通用户评论的形式参与讨论。",
    "请直接输出可发布的评论正文，不要输出标题、解释、JSON、代码块或多余前后缀。",
    "默认使用简体中文，语气自然、克制、友好，优先解决问题或推进讨论。",
    "不确定时明确说明不确定，并提出一个有价值的澄清问题。",
    "不要编造外部事实、站点规则或未提供的上下文。",
  ].join("\n"),
  postReplyPrompt: "当有人在帖子正文里 @你 时，请结合整帖语义进行评论回复，优先回应楼主的主要诉求。",
  commentReplyPrompt: "当有人在评论里 @你 时，请结合主楼和当前评论链语义，在楼中楼直接回应当前评论。",
} as const

type AiReplyStateRecord = {
  AppId: string
  enabled: boolean
  installedAt: string | null
  uninstalledAt: string | null
  config: Record<string, unknown>
  status: string
  version: string | null
  sourceDir: string | null
  lastActivatedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  failureCount: number
}

export interface AiReplyConfigData {
  enabled: boolean
  baseUrl: string
  model: string
  agentUserId: number | null
  respondToPostMentions: boolean
  respondToCommentMentions: boolean
  temperature: number
  maxOutputTokens: number
  timeoutMs: number
  systemPrompt: string
  postReplyPrompt: string
  commentReplyPrompt: string
  apiKeyConfigured: boolean
}

export interface ServerAiReplyConfigData extends Omit<AiReplyConfigData, "apiKeyConfigured"> {
  apiKey: string | null
}

export interface ResolvedAiReplyConfigDraft {
  record: {
    id: string
    appStateJson: string | null
    sensitiveStateJson: string | null
  }
  config: ServerAiReplyConfigData
  agentUser: {
    id: number
    username: string
    nickname: string | null
    status: string
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseJsonRoot(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readAiReplyStateRecord(appStateJson: string | null | undefined): AiReplyStateRecord | null {
  const root = parseJsonRoot(appStateJson)
  const record = root[AI_REPLY_APP_KEY]

  if (!isRecord(record)) {
    return null
  }

  return {
    AppId: typeof record.AppId === "string" ? record.AppId : AI_REPLY_APP_KEY,
    enabled: typeof record.enabled === "boolean" ? record.enabled : Boolean(record.enabled),
    installedAt: typeof record.installedAt === "string" ? record.installedAt : null,
    uninstalledAt: typeof record.uninstalledAt === "string" ? record.uninstalledAt : null,
    config: isRecord(record.config) ? record.config : {},
    status: typeof record.status === "string" ? record.status : "active",
    version: typeof record.version === "string" ? record.version : null,
    sourceDir: typeof record.sourceDir === "string" ? record.sourceDir : null,
    lastActivatedAt: typeof record.lastActivatedAt === "string" ? record.lastActivatedAt : null,
    lastErrorAt: typeof record.lastErrorAt === "string" ? record.lastErrorAt : null,
    lastErrorMessage: typeof record.lastErrorMessage === "string" ? record.lastErrorMessage : null,
    failureCount: parseNonNegativeSafeInteger(record.failureCount) ?? 0,
  }
}

function readSensitiveState(raw: string | null | undefined) {
  const root = parseJsonRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false
    }
  }

  return fallback
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeString(value: unknown, fallback: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : fallback
  const sliced = normalized.slice(0, maxLength)
  return sliced || fallback
}

function normalizeOptionalString(value: unknown, fallback: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : fallback
  return normalized.slice(0, maxLength)
}

function normalizeBaseUrl(value: unknown, fallback: string) {
  const normalized = normalizeString(value, fallback, 500)
  return normalized.replace(/\/+$/, "") || fallback
}

function normalizeTemperature(value: unknown, fallback: number) {
  const parsed = typeof value === "number"
    ? value
    : Number.parseFloat(typeof value === "string" ? value.trim() : "")

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(2, Math.max(0, Number(parsed.toFixed(2))))
}

function normalizeAgentUserId(value: unknown, fallback: number | null) {
  const parsed = parsePositiveSafeInteger(value)
  return typeof parsed === "number" ? parsed : fallback
}

function normalizeAiReplyConfig(record: AiReplyStateRecord | null, apiKey: string | null): ServerAiReplyConfigData {
  const config = record?.config ?? {}

  return {
    enabled: normalizeBoolean(record?.enabled, AI_REPLY_DEFAULTS.enabled),
    baseUrl: normalizeBaseUrl(config.baseUrl, AI_REPLY_DEFAULTS.baseUrl),
    model: normalizeOptionalString(config.model, AI_REPLY_DEFAULTS.model, 200),
    agentUserId: normalizeAgentUserId(config.agentUserId, AI_REPLY_DEFAULTS.agentUserId),
    respondToPostMentions: normalizeBoolean(config.respondToPostMentions, AI_REPLY_DEFAULTS.respondToPostMentions),
    respondToCommentMentions: normalizeBoolean(config.respondToCommentMentions, AI_REPLY_DEFAULTS.respondToCommentMentions),
    temperature: normalizeTemperature(config.temperature, AI_REPLY_DEFAULTS.temperature),
    maxOutputTokens: Math.min(4_000, Math.max(64, parsePositiveSafeInteger(config.maxOutputTokens) ?? AI_REPLY_DEFAULTS.maxOutputTokens)),
    timeoutMs: Math.min(120_000, Math.max(5_000, parsePositiveSafeInteger(config.timeoutMs) ?? AI_REPLY_DEFAULTS.timeoutMs)),
    systemPrompt: normalizeOptionalString(config.systemPrompt, AI_REPLY_DEFAULTS.systemPrompt, 4_000),
    postReplyPrompt: normalizeOptionalString(config.postReplyPrompt, AI_REPLY_DEFAULTS.postReplyPrompt, 2_000),
    commentReplyPrompt: normalizeOptionalString(config.commentReplyPrompt, AI_REPLY_DEFAULTS.commentReplyPrompt, 2_000),
    apiKey,
  }
}

function toPublicAiReplyConfig(config: ServerAiReplyConfigData): AiReplyConfigData {
  const { apiKey, ...rest } = config

  return {
    ...rest,
    apiKeyConfigured: Boolean(apiKey),
  }
}

async function getOrCreateAiReplySettingsRecord() {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: {
      id: true,
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })
}

export async function getServerAiReplyConfig(): Promise<ServerAiReplyConfigData> {
  const record = await getOrCreateAiReplySettingsRecord()
  const stateRecord = readAiReplyStateRecord(record.appStateJson)
  const sensitiveState = readSensitiveState(record.sensitiveStateJson)
  const aiReplySensitiveState = isRecord(sensitiveState[AI_REPLY_SENSITIVE_KEY])
    ? sensitiveState[AI_REPLY_SENSITIVE_KEY]
    : {}
  const apiKey = normalizeNullableString(aiReplySensitiveState.apiKey)

  return normalizeAiReplyConfig(stateRecord, apiKey)
}

export async function getAiReplyConfig(): Promise<AiReplyConfigData> {
  return toPublicAiReplyConfig(await getServerAiReplyConfig())
}

export function isAiReplyConfigRunnable(config: ServerAiReplyConfigData) {
  return Boolean(
    config.enabled
    && config.agentUserId
    && config.model.trim()
    && config.baseUrl.trim()
    && config.apiKey?.trim(),
  )
}

export function isAiReplyConfigTestable(config: ServerAiReplyConfigData) {
  return Boolean(
    config.agentUserId
    && config.model.trim()
    && config.baseUrl.trim()
    && config.apiKey?.trim(),
  )
}

function buildNextAiReplyStateRecord(existing: AiReplyStateRecord | null, config: ServerAiReplyConfigData): AiReplyStateRecord {
  const installedAt = existing?.installedAt ?? new Date().toISOString()

  return {
    AppId: AI_REPLY_APP_KEY,
    enabled: config.enabled,
    installedAt,
    uninstalledAt: null,
    config: {
      baseUrl: config.baseUrl,
      model: config.model,
      agentUserId: config.agentUserId,
      respondToPostMentions: config.respondToPostMentions,
      respondToCommentMentions: config.respondToCommentMentions,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      timeoutMs: config.timeoutMs,
      systemPrompt: config.systemPrompt,
      postReplyPrompt: config.postReplyPrompt,
      commentReplyPrompt: config.commentReplyPrompt,
    },
    status: "active",
    version: existing?.version ?? "hosted",
    sourceDir: existing?.sourceDir ?? "src",
    lastActivatedAt: new Date().toISOString(),
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }
}

function mergeAiReplyAppState(appStateJson: string | null | undefined, config: ServerAiReplyConfigData) {
  const root = parseJsonRoot(appStateJson)
  const existing = readAiReplyStateRecord(appStateJson)
  root[AI_REPLY_APP_KEY] = buildNextAiReplyStateRecord(existing, config)
  return JSON.stringify(root)
}

function mergeAiReplySensitiveState(
  sensitiveStateJson: string | null | undefined,
  params: { apiKey: string | null },
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveState(sensitiveStateJson)

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [AI_REPLY_SENSITIVE_KEY]: {
      apiKey: normalizeNullableString(params.apiKey),
    },
  }

  return JSON.stringify(root)
}

export async function resolveAiReplyConfigDraftFromAdminInput(body: JsonObject) {
  const record = await getOrCreateAiReplySettingsRecord()
  const current = await getServerAiReplyConfig()
  const rawConfig = body.config
  const rawSecret = body.secret

  const configInput = isRecord(rawConfig) ? rawConfig : {}
  const secretInput = isRecord(rawSecret) ? rawSecret : {}

  const agentUsernameInput = typeof configInput.agentUsername === "string"
    ? configInput.agentUsername.trim()
    : undefined

  let nextAgentUserId = current.agentUserId

  if (typeof agentUsernameInput === "string") {
    if (!agentUsernameInput) {
      nextAgentUserId = null
    } else {
      const agentUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: agentUsernameInput },
            { nickname: agentUsernameInput },
          ],
        },
        select: {
          id: true,
        },
      })

      if (!agentUser) {
        apiError(400, "AI 代理账号不存在，请填写正确的用户名或昵称")
      }

      nextAgentUserId = agentUser.id
    }
  }

  const resolvedAgentUser = nextAgentUserId
    ? await prisma.user.findUnique({
        where: { id: nextAgentUserId },
        select: {
          id: true,
          username: true,
          nickname: true,
          status: true,
        },
      })
    : null

  const nextConfig: ServerAiReplyConfigData = {
    enabled: normalizeBoolean(configInput.enabled, current.enabled),
    baseUrl: normalizeBaseUrl(configInput.baseUrl, current.baseUrl),
    model: normalizeOptionalString(configInput.model, current.model, 200),
    agentUserId: nextAgentUserId,
    respondToPostMentions: normalizeBoolean(configInput.respondToPostMentions, current.respondToPostMentions),
    respondToCommentMentions: normalizeBoolean(configInput.respondToCommentMentions, current.respondToCommentMentions),
    temperature: normalizeTemperature(configInput.temperature, current.temperature),
    maxOutputTokens: Math.min(4_000, Math.max(64, parsePositiveSafeInteger(configInput.maxOutputTokens) ?? current.maxOutputTokens)),
    timeoutMs: Math.min(120_000, Math.max(5_000, parsePositiveSafeInteger(configInput.timeoutMs) ?? current.timeoutMs)),
    systemPrompt: normalizeOptionalString(configInput.systemPrompt, current.systemPrompt, 4_000),
    postReplyPrompt: normalizeOptionalString(configInput.postReplyPrompt, current.postReplyPrompt, 2_000),
    commentReplyPrompt: normalizeOptionalString(configInput.commentReplyPrompt, current.commentReplyPrompt, 2_000),
    apiKey: current.apiKey,
  }

  const clearApiKey = normalizeBoolean(secretInput.clearApiKey, false)
  const nextApiKeyInput = typeof secretInput.apiKey === "string"
    ? secretInput.apiKey.trim()
    : ""

  if (clearApiKey) {
    nextConfig.apiKey = null
  } else if (nextApiKeyInput) {
    nextConfig.apiKey = nextApiKeyInput
  }

  return {
    record,
    config: nextConfig,
    agentUser: resolvedAgentUser,
  } satisfies ResolvedAiReplyConfigDraft
}

export async function updateAiReplyConfigFromAdminInput(body: JsonObject) {
  const resolved = await resolveAiReplyConfigDraftFromAdminInput(body)

  await prisma.siteSetting.update({
    where: { id: resolved.record.id },
    data: {
      appStateJson: mergeAiReplyAppState(resolved.record.appStateJson, resolved.config),
      sensitiveStateJson: mergeAiReplySensitiveState(resolved.record.sensitiveStateJson, {
        apiKey: resolved.config.apiKey,
      }),
    },
  })

  return getAiReplyConfig()
}
