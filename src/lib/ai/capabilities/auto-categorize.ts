import "server-only"

import { prisma } from "@/db/client"
import { PostStatus } from "@/db/types"
import { logError, logInfo } from "@/lib/logger"
import { AiProviderError, resolveAiProvider, type AiProviderConfig } from "@/lib/ai/provider"
import { runAiTask } from "@/lib/ai/service"
import { getServerAiReplyConfig } from "@/lib/ai-reply-config"

import { getAutoCategorizeConfig } from "./auto-categorize-config"

/**
 * 能力 1.b：auto 板块 / 标签选择 + 可选等审核
 * 挂在 app.ai-reply 下（与 ai-reply 共享 provider/apiKey），开关独立。
 * 所有失败均 catch 打日志，不 throw —— 调用方是 post.create.after 的
 * fire-and-forget，不应影响发帖主流程。
 */

const LOG_SCOPE = "ai.auto-categorize"
const MAX_CONTENT_CHARS = 4000
const MAX_BOARD_CANDIDATES = 100
const MAX_TAG_CANDIDATES = 200
const MAX_TOKENS = 512

interface SuggestionPayload {
  boardSlug?: string
  tags: string[]
  reasoning?: string
}

function stripFence(raw: string): string {
  const trimmed = raw.trim()
  const fence = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```$/u)
  return fence?.[1]?.trim() ?? trimmed
}

function parseSuggestion(raw: string): SuggestionPayload | null {
  const body = stripFence(raw)
  if (!body) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>

  const boardRaw = typeof obj.board === "string"
    ? obj.board
    : typeof obj.boardSlug === "string"
      ? obj.boardSlug
      : ""
  const boardSlug = boardRaw.trim() || undefined

  const tagsRaw = Array.isArray(obj.tags) ? obj.tags : []
  const tags = tagsRaw
    .filter((t): t is string => typeof t === "string")
    .map((s) => s.trim())
    .filter(Boolean)

  const reasoning = typeof obj.reasoning === "string"
    ? obj.reasoning.trim().slice(0, 500) || undefined
    : undefined

  return { boardSlug, tags, reasoning }
}

export async function runAutoCategorize({ postId }: { postId: string }): Promise<void> {
  try {
    const autoCfg = await getAutoCategorizeConfig()
    if (!autoCfg.enabled) return

    const aiCfg = await getServerAiReplyConfig()
    const apiKey = (aiCfg.apiKey ?? "").trim()
    const baseUrl = aiCfg.baseUrl.trim()
    const model = aiCfg.model.trim()
    if (!apiKey || !baseUrl || !model) {
      logInfo({ scope: LOG_SCOPE, action: "skip_provider_not_configured", targetId: postId })
      return
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        appendedContent: true,
        status: true,
        boardId: true,
      },
    })
    if (!post) {
      logInfo({ scope: LOG_SCOPE, action: "skip_post_missing", targetId: postId })
      return
    }

    const boardWhere: { status: "ACTIVE"; slug?: { in: string[] } } = { status: "ACTIVE" }
    if (autoCfg.boardWhitelistSlugs.length > 0) {
      boardWhere.slug = { in: autoCfg.boardWhitelistSlugs }
    }
    const boards = await prisma.board.findMany({
      where: boardWhere,
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: "asc" },
      take: MAX_BOARD_CANDIDATES,
    })
    if (boards.length === 0) {
      logInfo({ scope: LOG_SCOPE, action: "skip_no_candidate_boards", targetId: postId })
      return
    }

    const tags = await prisma.tag.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: [{ postCount: "desc" }, { createdAt: "desc" }],
      take: MAX_TAG_CANDIDATES,
    })

    const boardList = boards.map((b) => `- ${b.slug}: ${b.name}`).join("\n")
    const tagList = tags.length > 0
      ? tags.map((t) => `- ${t.slug}: ${t.name}`).join("\n")
      : "（暂无预定义 tag，可返回 tags: []）"

    const fullContent = [post.content, post.appendedContent].filter(Boolean).join("\n\n")
    const truncatedContent = fullContent.slice(0, MAX_CONTENT_CHARS)

    const userPrompt = [
      `帖子标题：${post.title}`,
      `帖子正文：\n${truncatedContent || "（无正文）"}`,
      `候选板块（slug: 名称）：\n${boardList}`,
      `候选标签（slug: 名称）：\n${tagList}`,
      `最多可返回 ${autoCfg.maxTagCount} 个 tag；只能从候选中选。`,
      '请严格输出单个 JSON 对象，字段：{"board": "<slug>", "tags": ["<slug>", ...], "reasoning": "<简述>"}，不要额外说明。',
    ].join("\n\n")

    const providerConfig: AiProviderConfig = {
      kind: "openai-compatible",
      baseUrl,
      apiKey,
    }
    const provider = resolveAiProvider(providerConfig)

    let result: { text: string }
    try {
      result = await runAiTask({
        kind: "auto-categorize",
        appKey: "app.ai-reply",
        provider,
        messages: [
          { role: "system", content: autoCfg.promptTemplate },
          { role: "user", content: userPrompt },
        ],
        options: {
          model,
          temperature: aiCfg.temperature,
          maxTokens: MAX_TOKENS,
          timeoutMs: aiCfg.timeoutMs,
        },
      })
    } catch (err) {
      if (err instanceof AiProviderError) {
        logError({ scope: LOG_SCOPE, action: "provider_error", targetId: postId }, err, { kind: err.kind })
      } else {
        logError({ scope: LOG_SCOPE, action: "provider_call_failed", targetId: postId }, err)
      }
      return
    }

    const payload = parseSuggestion(result.text)
    if (!payload) {
      logInfo({
        scope: LOG_SCOPE,
        action: "skip_invalid_json",
        targetId: postId,
      }, { rawPreview: result.text.slice(0, 200) })
      return
    }

    const boardBySlug = new Map(boards.map((b) => [b.slug, b.id]))
    const suggestedBoardId = payload.boardSlug && boardBySlug.has(payload.boardSlug)
      ? boardBySlug.get(payload.boardSlug) ?? null
      : null

    const tagBySlug = new Map(tags.map((t) => [t.slug, t.id]))
    const seen = new Set<string>()
    const suggestedTagIds: string[] = []
    for (const slug of payload.tags) {
      const id = tagBySlug.get(slug)
      if (id && !seen.has(id)) {
        seen.add(id)
        suggestedTagIds.push(id)
        if (suggestedTagIds.length >= autoCfg.maxTagCount) break
      }
    }

    if (!suggestedBoardId && suggestedTagIds.length === 0) {
      logInfo({ scope: LOG_SCOPE, action: "skip_empty_suggestion", targetId: postId })
      return
    }

    await prisma.aiModerationSuggestion.create({
      data: {
        postId: post.id,
        suggestedBoardId,
        suggestedTagIds,
        reasoning: payload.reasoning ?? null,
        modelKey: model,
        status: "PENDING",
      },
    })

    if (autoCfg.holdForReview && post.status !== PostStatus.PENDING) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: PostStatus.PENDING },
      })
    }

    logInfo({
      scope: LOG_SCOPE,
      action: "suggestion_created",
      targetId: postId,
    }, {
      board: payload.boardSlug ?? null,
      tagCount: suggestedTagIds.length,
      holdForReview: autoCfg.holdForReview,
    })
  } catch (err) {
    logError({ scope: LOG_SCOPE, action: "unhandled" }, err, { postId })
  }
}