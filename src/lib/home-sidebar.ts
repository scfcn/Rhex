import type { SidebarUserCardData } from "@/components/sidebar-user-card"
import { countSidebarUserBoardFollows, countSidebarUserFavorites, findHomeSidebarHotTopics, findSidebarCurrentUser, findSidebarUserCheckInRecord } from "@/db/home-sidebar-queries"
import type { getCurrentUser } from "@/lib/auth"
import { getLocalDateKey } from "@/lib/date-key"
import { formatMonthDayTime } from "@/lib/formatters"
import { getLevelBadgeData } from "@/lib/level-badge"
import type { SiteSettingsData } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export async function getHomeSidebarHotTopics(limit = 5) {
  const posts = await findHomeSidebarHotTopics(limit)

  return posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    authorName: getUserDisplayName(post.author),
    authorAvatarPath: post.author.avatarPath,
    lastReplyAuthorName: getUserDisplayName(post.comments[0]?.user ?? post.author),
    lastRepliedAt: formatMonthDayTime(post.lastCommentedAt ?? post.createdAt),
  }))
}

export async function getSidebarCurrentUserStats(username: string) {
  const user = await findSidebarCurrentUser(username)

  if (!user) {
    return {
      boardCount: 0,
      favoriteCount: 0,
      followerCount: 0,
      postCount: 0,
      receivedLikeCount: 0,
      points: 0,
      checkedInToday: false,
    }
  }

  const [boardCount, favoriteCount, checkInRecord] = await Promise.all([
    countSidebarUserBoardFollows(user.id),
    countSidebarUserFavorites(user.id),
    findSidebarUserCheckInRecord(user.id, getLocalDateKey()),
  ])

  return {
    boardCount,
    favoriteCount,
    followerCount: user._count.followedByUsers,
    postCount: user.postCount,
    receivedLikeCount: user.likeReceivedCount,
    points: user.points,
    checkedInToday: Boolean(checkInRecord),
  }
}

type SidebarUserSource = Awaited<ReturnType<typeof getCurrentUser>> | null

type SidebarUserStats = Awaited<ReturnType<typeof getSidebarCurrentUserStats>> | null

export async function buildSidebarUser(user: SidebarUserSource, stats: SidebarUserStats, settings: SiteSettingsData): Promise<SidebarUserCardData | null> {
  if (!user) {
    return null
  }

  const checkInReward = isVipActive(user)
    ? getVipLevel(user) >= 3
      ? settings.checkInVip3Reward
      : getVipLevel(user) === 2
        ? settings.checkInVip2Reward
        : settings.checkInVip1Reward
    : settings.checkInReward
  const level = Math.max(1, user.level ?? 1)
  const levelBadge = await getLevelBadgeData(level)

  return {
    username: user.username,
    nickname: user.nickname,
    avatarPath: user.avatarPath,
    role: user.role ?? "USER",
    status: user.status ?? "ACTIVE",
    level,
    levelName: levelBadge.name,
    levelColor: levelBadge.color,
    levelIcon: levelBadge.icon,
    vipLevel: user.vipLevel ?? 0,
    vipExpiresAt: user.vipExpiresAt?.toString?.() ?? null,
    boardCount: stats?.boardCount ?? 0,
    favoriteCount: stats?.favoriteCount ?? 0,
    followerCount: stats?.followerCount ?? 0,
    postCount: stats?.postCount ?? 0,
    receivedLikeCount: stats?.receivedLikeCount ?? 0,
    points: stats?.points ?? user.points ?? 0,
    pointName: settings.pointName,
    checkInEnabled: settings.checkInEnabled,
    checkInReward,
    checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
    checkInVip1MakeUpCardPrice: settings.checkInVip1MakeUpCardPrice,
    checkInVip2MakeUpCardPrice: settings.checkInVip2MakeUpCardPrice,
    checkInVip3MakeUpCardPrice: settings.checkInVip3MakeUpCardPrice,
    checkedInToday: stats?.checkedInToday ?? false,
  }
}

export async function resolveSidebarUser(user: SidebarUserSource, settings: SiteSettingsData) {
  if (!user) {
    return null
  }

  const stats = await getSidebarCurrentUserStats(user.username)
  return buildSidebarUser(user, stats, settings)
}

