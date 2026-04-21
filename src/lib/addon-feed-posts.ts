import "server-only"

import {
  executeAddonAsyncWaterfallHook,
} from "@/addons-host/runtime/hooks"
import { queryAddonPosts } from "@/addons-host/runtime/posts"
import type { AddonPostRecord } from "@/addons-host/types"
import { formatRelativeTime } from "@/lib/formatters"
import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import type { FeedDisplayItem } from "@/lib/forum-feed-display"
import { getFeedPinLabel } from "@/lib/forum-feed-display"
import type { PostStreamDisplayItem } from "@/lib/forum-post-stream-display"
import { getVisiblePinLabel } from "@/lib/forum-post-stream-display"
import { resolvePostCoverImage } from "@/lib/post-cover"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { getPostTypeLabel } from "@/lib/post-types"
import { parsePostRewardPoolConfigFromContent } from "@/lib/post-red-packets"
import type { SitePostItem } from "@/lib/posts"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipNameClass } from "@/lib/vip-status"

type FeedHeatSettings = Pick<
  Awaited<ReturnType<typeof getSiteSettings>>,
  "heatViewWeight"
  | "heatCommentWeight"
  | "heatLikeWeight"
  | "heatTipCountWeight"
  | "heatTipPointsWeight"
  | "heatStageThresholds"
  | "heatStageColors"
>

interface AddonFeedHookInput {
  pathname?: string
  request?: Request
  searchParams?: URLSearchParams
}

export function buildAddonHookSearchParams(
  input?: Record<string, string | string[] | undefined>,
) {
  const searchParams = new URLSearchParams()

  if (!input) {
    return searchParams
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      searchParams.set(key, value)
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
    }
  }

  return searchParams
}

function resolveAuthorIsVip(input: {
  legacyVipExpiresAt?: string | null
  fallbackVipLevel?: number | null
}) {
  if (typeof input.legacyVipExpiresAt === "string" && input.legacyVipExpiresAt.trim()) {
    return new Date(input.legacyVipExpiresAt).getTime() > Date.now()
  }

  return (input.fallbackVipLevel ?? 0) > 0
}

function resolveAddonPostDate(value?: string | null, fallback?: string | null) {
  const resolved = value?.trim() || fallback?.trim() || null
  if (!resolved) {
    return null
  }

  const parsed = new Date(resolved)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function resolveHookedFeedPosts(
  postIds: string[],
  input?: AddonFeedHookInput,
) {
  const uniquePostIds = [...new Set(postIds.map((item) => item.trim()).filter(Boolean))]
  if (uniquePostIds.length === 0) {
    return [] as AddonPostRecord[]
  }

  const queried = await queryAddonPosts({
    ids: uniquePostIds,
    includeTotal: false,
    limit: uniquePostIds.length,
  })
  const queriedById = new Map(queried.items.map((item) => [item.id, item]))
  const ordered = uniquePostIds
    .map((postId) => queriedById.get(postId) ?? null)
    .filter((item): item is AddonPostRecord => Boolean(item))
  const hooked = await executeAddonAsyncWaterfallHook("feed.posts.items", ordered, input)

  return Array.isArray(hooked.value) ? hooked.value : ordered
}

export async function buildHookedFeedDisplayItems(input: {
  items: ForumFeedItem[]
  sort: Exclude<FeedSort, "weekly">
  settings: FeedHeatSettings
  pathname?: string
  request?: Request
  searchParams?: URLSearchParams
}) {
  const legacyItemsById = new Map(input.items.map((item) => [item.id, item]))
  const hookedPosts = await resolveHookedFeedPosts(
    input.items.map((item) => item.id),
    {
      pathname: input.pathname,
      request: input.request,
      searchParams: input.searchParams,
    },
  )

  return hookedPosts.map((post) => {
    const legacy = legacyItemsById.get(post.id)
    const rewardConfig = parsePostRewardPoolConfigFromContent(post.content)
    const publishedAtRaw = resolveAddonPostDate(post.publishedAt, post.createdAt) ?? post.createdAt
    const lastRepliedAtRaw = resolveAddonPostDate(post.lastCommentedAt, post.publishedAt ?? post.createdAt) ?? publishedAtRaw
    const commentHeat = resolvePostHeatStyle({
      views: post.viewCount,
      comments: post.commentCount,
      likes: post.likeCount,
      tipCount: post.tipCount,
      tipPoints: post.tipTotalPoints,
    }, input.settings)
    const authorVipLevel = legacy?.authorVipLevel ?? post.author.vipLevel ?? 0
    const authorIsVip = resolveAuthorIsVip({
      legacyVipExpiresAt: legacy?.authorVipExpiresAt ?? null,
      fallbackVipLevel: authorVipLevel,
    })
    const latestReplyAuthorName = legacy?.latestReplyAuthorName ?? null
    const latestReplyAuthorUsername = legacy?.latestReplyAuthorUsername ?? null

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      type: post.type,
      typeLabel: legacy?.typeLabel ?? getPostTypeLabel(post.type),
      pinScope: post.pinScope,
      pinLabel: getFeedPinLabel(post.pinScope),
      hasRedPacket: legacy?.hasRedPacket ?? Boolean(rewardConfig),
      hasAttachments: legacy?.hasAttachments ?? false,
      rewardMode: legacy?.rewardMode ?? rewardConfig?.mode,
      minViewLevel: post.minViewLevel,
      minViewVipLevel: post.minViewVipLevel,
      isFeatured: post.isFeatured,
      boardName: legacy?.boardName ?? post.board.name,
      boardSlug: legacy?.boardSlug ?? post.board.slug,
      boardIcon: legacy?.boardIcon ?? post.board.iconPath ?? "💬",
      authorName: legacy?.authorName ?? post.author.displayName,
      authorUsername: legacy?.authorUsername ?? post.author.username,
      authorAvatarPath: legacy?.authorAvatarPath ?? post.author.avatarPath,
      authorStatus: legacy?.authorStatus ?? post.author.status,
      authorIsVip,
      authorVipLevel,
      authorNameClassName: getVipNameClass(authorIsVip, authorVipLevel, { emphasize: true }),
      metaPrimary: input.sort === "new"
        ? formatRelativeTime(publishedAtRaw)
        : formatRelativeTime(lastRepliedAtRaw),
      metaPrimaryRaw: input.sort === "new" ? publishedAtRaw : lastRepliedAtRaw,
      metaSecondary: (
        input.sort === "latest"
        || input.sort === "new"
        || input.sort === "hot"
        || input.sort === "following"
      ) && latestReplyAuthorName
        ? `最新回复 ${latestReplyAuthorName}`
        : null,
      latestReplyAuthorName,
      latestReplyAuthorUsername,
      commentCount: post.commentCount,
      commentAccentColor: commentHeat.color,
      coverImage: legacy?.coverImage ?? resolvePostCoverImage(post.content, post.coverPath),
      excerpt: legacy?.summary ?? post.summary ?? post.title,
    } satisfies FeedDisplayItem
  })
}

export async function buildHookedPostStreamDisplayItems(input: {
  posts: SitePostItem[]
  settings: FeedHeatSettings
  visiblePinScopes: Array<"GLOBAL" | "ZONE" | "BOARD">
  pathname?: string
  request?: Request
  searchParams?: URLSearchParams
}) {
  const legacyPostsById = new Map(input.posts.map((post) => [post.id, post]))
  const hookedPosts = await resolveHookedFeedPosts(
    input.posts.map((post) => post.id),
    {
      pathname: input.pathname,
      request: input.request,
      searchParams: input.searchParams,
    },
  )

  return hookedPosts.map((post) => {
    const legacy = legacyPostsById.get(post.id)
    const rewardConfig = parsePostRewardPoolConfigFromContent(post.content)
    const publishedAtRaw = resolveAddonPostDate(post.publishedAt, post.createdAt) ?? post.createdAt
    const commentHeat = resolvePostHeatStyle({
      views: post.viewCount,
      comments: post.commentCount,
      likes: post.likeCount,
      tipCount: post.tipCount,
      tipPoints: post.tipTotalPoints,
    }, input.settings)
    const authorVipLevel = legacy?.authorVipLevel ?? post.author.vipLevel ?? 0
    const authorIsVip = resolveAuthorIsVip({
      fallbackVipLevel: authorVipLevel,
    })
    const latestReplyAuthorName = legacy?.latestReplyAuthorName ?? null
    const latestReplyAuthorUsername = legacy?.latestReplyAuthorUsername ?? null

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: legacy?.excerpt ?? post.summary ?? post.title,
      coverImage: legacy?.coverImage ?? resolvePostCoverImage(post.content, post.coverPath),
      type: post.type,
      typeLabel: legacy?.typeLabel ?? getPostTypeLabel(post.type),
      pinScope: post.pinScope,
      pinLabel: getVisiblePinLabel(post.pinScope, input.visiblePinScopes),
      hasRedPacket: legacy?.hasRedPacket ?? Boolean(rewardConfig),
      hasAttachments: legacy?.hasAttachments ?? false,
      rewardMode: legacy?.rewardMode ?? rewardConfig?.mode,
      minViewLevel: post.minViewLevel,
      minViewVipLevel: post.minViewVipLevel,
      isFeatured: post.isFeatured,
      boardName: legacy?.board ?? post.board.name,
      boardSlug: legacy?.boardSlug ?? post.board.slug,
      boardIcon: legacy?.boardIcon ?? post.board.iconPath ?? "💬",
      authorName: legacy?.author ?? post.author.displayName,
      authorUsername: legacy?.authorUsername ?? post.author.username,
      authorAvatarPath: legacy?.authorAvatarPath ?? post.author.avatarPath,
      authorStatus: legacy?.authorStatus ?? post.author.status,
      authorIsVip,
      authorVipLevel,
      authorNameClassName: getVipNameClass(authorIsVip, authorVipLevel, { emphasize: true }),
      authorDisplayedBadges: legacy?.authorDisplayedBadges,
      metaPrimary: legacy?.publishedAt ?? formatRelativeTime(publishedAtRaw),
      metaPrimaryRaw: legacy?.publishedAtRaw ?? publishedAtRaw,
      metaSecondary: latestReplyAuthorName ? `最新回复 ${latestReplyAuthorName}` : null,
      latestReplyAuthorName,
      latestReplyAuthorUsername,
      commentCount: post.commentCount,
      commentAccentColor: commentHeat.color,
    } satisfies PostStreamDisplayItem
  })
}
