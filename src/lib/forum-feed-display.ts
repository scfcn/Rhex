import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipNameClass, isVipActive } from "@/lib/vip-status"

export interface FeedDisplayItem {
  id: string
  slug: string
  title: string
  type: ForumFeedItem["type"]
  typeLabel: string
  pinScope?: string | null
  pinLabel?: string | null
  hasRedPacket: boolean
  rewardMode?: PostRewardPoolMode
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean
  boardName: string
  boardSlug: string
  boardIcon: string
  authorName: string
  authorUsername: string
  authorAvatarPath: string | null
  authorStatus?: ForumFeedItem["authorStatus"]
  authorIsVip: boolean
  authorVipLevel?: number | null
  authorNameClassName: string
  metaPrimary: string
  metaPrimaryRaw?: string
  metaSecondary?: string | null
  commentCount: number
  commentAccentColor: string
  coverImage?: string | null
  excerpt: string
}

type FeedDisplaySettings = Pick<
  Awaited<ReturnType<typeof getSiteSettings>>,
  "heatViewWeight" | "heatCommentWeight" | "heatLikeWeight" | "heatTipCountWeight" | "heatTipPointsWeight" | "heatStageThresholds" | "heatStageColors"
>

export function getFeedPinLabel(pinScope?: string | null) {
  if (pinScope === "GLOBAL") {
    return "全局置顶"
  }

  return null
}

export function mapForumFeedItemsToDisplayItems(
  items: ForumFeedItem[],
  currentSort: FeedSort,
  settings: FeedDisplaySettings,
): FeedDisplayItem[] {
  return items.map((item) => {
    const commentHeat = resolvePostHeatStyle({
      views: item.viewCount,
      comments: item.commentCount,
      likes: item.likeCount,
      tipCount: item.tipCount,
      tipPoints: item.tipTotalPoints,
    }, settings)
    const authorIsVip = isVipActive({ vipLevel: item.authorVipLevel, vipExpiresAt: item.authorVipExpiresAt })

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      type: item.type,
      typeLabel: item.typeLabel,
      pinScope: item.pinScope,
      pinLabel: getFeedPinLabel(item.pinScope),
      hasRedPacket: item.hasRedPacket,
      rewardMode: item.rewardMode,
      minViewLevel: item.minViewLevel ?? undefined,
      minViewVipLevel: item.minViewVipLevel ?? undefined,
      isFeatured: item.isFeatured,
      boardName: item.boardName,
      boardSlug: item.boardSlug,
      boardIcon: item.boardIcon,
      authorName: item.authorName,
      authorUsername: item.authorUsername,
      authorAvatarPath: item.authorAvatarPath,
      authorStatus: item.authorStatus,
      authorIsVip,
      authorVipLevel: item.authorVipLevel,
      authorNameClassName: getVipNameClass(authorIsVip, item.authorVipLevel, { emphasize: true }),
      metaPrimary: currentSort === "new" ? item.publishedAt : item.lastRepliedAt,
      metaPrimaryRaw: currentSort === "new" ? item.publishedAtRaw : item.lastRepliedAtRaw,
      metaSecondary: (currentSort === "latest" || currentSort === "following") && item.latestReplyAuthorName ? `最新回复 ${item.latestReplyAuthorName}` : null,
      commentCount: item.commentCount,
      commentAccentColor: commentHeat.color,
      coverImage: item.coverImage,
      excerpt: item.summary,
    }
  })
}
