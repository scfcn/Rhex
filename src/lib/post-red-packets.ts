import { randomInt } from "crypto"

import { prisma } from "@/db/client"
import { upsertCommentEffectFeedback } from "@/db/comment-effect-feedback-queries"
import { PostRedPacketClaimOrderMode, PostRedPacketGrantMode, PostRedPacketStatus, PostRedPacketTriggerType, Prisma } from "@/db/types"
import { claimPostRedPacketInTransaction, findCurrentUserPostRedPacketClaim, findPostRedPacketSummaryData } from "@/db/post-red-packet-queries"
import { applyPointDelta, prepareScopedPointDelta, prepareScopedProbability } from "@/lib/point-center"
import { getBusinessDayRange, formatRelativeTime } from "@/lib/formatters"
import { getPostContentMeta } from "@/lib/post-content"
import { buildJackpotEffectFeedback } from "@/lib/post-reward-effect-feedback-builders"
import type { PostRewardPoolEffectFeedback } from "@/lib/post-reward-effect-feedback"
import { getPostRewardPoolModeLabel, parseStoredPostRewardPoolConfig, toPositiveInteger, type PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getSiteSettings } from "@/lib/site-settings"
import { addSafeIntegers, clampSafeInteger, dividePositiveSafeIntegers, floorSafeInteger, multiplyPositiveSafeIntegers, subtractSafeIntegers } from "@/lib/shared/safe-integer"

interface NormalizedJackpotConfig {
  enabled: true
  mode: "JACKPOT"
  triggerType: "REPLY"
  initialPoints: number
  replyIncrementPoints: number
  hitProbability: number
}

interface NormalizedStandardRedPacketConfig {
  enabled: true
  mode: "RED_PACKET"
  grantMode: PostRedPacketGrantMode
  claimOrderMode: PostRedPacketClaimOrderMode
  triggerType: PostRedPacketTriggerType
  totalPoints: number
  packetCount: number
  unitPoints: number
}

export type NormalizedPostRedPacketConfig =
  | NormalizedJackpotConfig
  | NormalizedStandardRedPacketConfig

export interface PostRewardPoolClaimResult {
  claimed: boolean
  amount?: number
  pointName?: string
  rewardMode?: PostRewardPoolMode
  reason?: string
  effectFeedback?: PostRewardPoolEffectFeedback | null
}

interface RewardPoolStoredState {
  totalPoints: number
  packetCount: number
  remainingPoints: number
  remainingCount: number
  grantMode: PostRedPacketGrantMode
  claimOrderMode: PostRedPacketClaimOrderMode
}

interface JackpotReplyOutcome {
  depositedPoints: number
  hitProbability: number
}

const JACKPOT_REPEAT_REPLY_PROBABILITY_FACTOR = 0.35
const JACKPOT_REPEAT_WINNER_PROBABILITY_FACTOR = 0.5

export interface PostRedPacketClaimRecord {
  id: string
  userId: number
  username: string
  nickname: string | null
  avatarPath: string | null
  amount: number
  triggerType: PostRedPacketTriggerType
  triggerLabel: string
  createdAt: string
}

export interface PostRedPacketSummary {
  enabled: boolean
  pointName: string
  rewardMode?: PostRewardPoolMode
  rewardModeLabel?: string
  senderId?: number
  senderName?: string
  grantMode?: PostRedPacketGrantMode
  claimOrderMode?: PostRedPacketClaimOrderMode
  claimOrderLabel?: string
  triggerType?: PostRedPacketTriggerType
  triggerLabel?: string
  totalPoints: number
  packetCount: number
  remainingPoints: number
  remainingCount: number
  claimedCount: number
  claimedPoints: number
  status?: PostRedPacketStatus
  jackpotInitialPoints?: number
  jackpotReplyIncrementPoints?: number
  jackpotHitProbability?: number
  currentUserPoints: number
  currentUserClaimed: boolean
  currentUserClaimAmount?: number
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  records: PostRedPacketClaimRecord[]
}


const RED_PACKET_TRIGGER_LABELS: Record<PostRedPacketTriggerType, string> = {
  REPLY: "回复帖子",
  LIKE: "点赞帖子",
  FAVORITE: "收藏帖子",
}

const RED_PACKET_GRANT_MODE_LABELS: Record<PostRedPacketGrantMode, string> = {
  FIXED: "固定红包",
  RANDOM: "拼手气红包",
}

const RED_PACKET_CLAIM_ORDER_MODE_LABELS: Record<PostRedPacketClaimOrderMode, string> = {
  FIRST_COME_FIRST_SERVED: "先到先得",
  RANDOM: "随机机会",
}

function parseRewardPoolConfigFromMeta(value: unknown) {
  return parseStoredPostRewardPoolConfig(value)
}

export function parsePostRewardPoolConfigFromContent(rawContent: string) {
  return parseRewardPoolConfigFromMeta(getPostContentMeta(rawContent)?.rewardPool)
}

interface PostRedPacketAllocationSnapshot {
  remainingPoints: number
  remainingCount: number
  totalPoints: number
  packetCount: number
}

export function getPostRedPacketTriggerLabel(triggerType: PostRedPacketTriggerType) {
  return RED_PACKET_TRIGGER_LABELS[triggerType]
}

export function getPostRedPacketGrantModeLabel(grantMode: PostRedPacketGrantMode) {
  return RED_PACKET_GRANT_MODE_LABELS[grantMode]
}

export function getPostRedPacketClaimOrderModeLabel(claimOrderMode: PostRedPacketClaimOrderMode) {
  return RED_PACKET_CLAIM_ORDER_MODE_LABELS[claimOrderMode]
}

export async function normalizePostRedPacketConfig(input: unknown): Promise<{
  success: boolean
  message?: string
  data: NormalizedPostRedPacketConfig | null
}> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: true, data: null }
  }

  const settings = await getSiteSettings()
  const config = input as Record<string, unknown>
  const enabled = Boolean(config.enabled)
  const mode = config.mode === "JACKPOT" ? "JACKPOT" : "RED_PACKET"

  if (!enabled) {
    return { success: true, data: null }
  }

  if (mode === "JACKPOT") {
    if (!settings.postJackpotEnabled) {
      return { success: false, message: "当前站点未开启聚宝盆功能", data: null }
    }

    const initialPoints = toPositiveInteger(config.initialPoints)
    if (!initialPoints) {
      return { success: false, message: "聚宝盆初始积分必须是正整数", data: null }
    }

    if (initialPoints < settings.postJackpotMinInitialPoints) {
      return { success: false, message: `聚宝盆初始${settings.pointName}不能低于 ${settings.postJackpotMinInitialPoints}`, data: null }
    }

    if (initialPoints > settings.postJackpotMaxInitialPoints) {
      return { success: false, message: `聚宝盆初始${settings.pointName}不能高于 ${settings.postJackpotMaxInitialPoints}`, data: null }
    }

    return {
      success: true,
      data: {
        enabled: true,
        mode: "JACKPOT",
        triggerType: "REPLY",
        initialPoints,
        replyIncrementPoints: settings.postJackpotReplyIncrementPoints,
        hitProbability: settings.postJackpotHitProbability,
      },
    }
  }

  if (!settings.postRedPacketEnabled) {
    return { success: false, message: "当前站点未开启帖子红包功能", data: null }
  }

  const grantMode = String(config.grantMode ?? "FIXED").trim().toUpperCase()
  const claimOrderMode = String(config.claimOrderMode ?? "FIRST_COME_FIRST_SERVED").trim().toUpperCase()
  const triggerType = String(config.triggerType ?? "REPLY").trim().toUpperCase()
  const packetCount = toPositiveInteger(config.packetCount)
  const configuredTotalPoints = toPositiveInteger(config.totalPoints)
  const unitPoints = toPositiveInteger(config.unitPoints ?? config.totalPoints)
  const totalPoints = grantMode === "FIXED"
    ? multiplyPositiveSafeIntegers(unitPoints, packetCount)
    : configuredTotalPoints



  if (!(grantMode in RED_PACKET_GRANT_MODE_LABELS)) {
    return { success: false, message: "红包发放方式不合法", data: null }
  }

  if (!(claimOrderMode in RED_PACKET_CLAIM_ORDER_MODE_LABELS)) {
    return { success: false, message: "红包领取规则不合法", data: null }
  }

  if (!(triggerType in RED_PACKET_TRIGGER_LABELS)) {
    return { success: false, message: "红包领取条件不合法", data: null }
  }

  if (!totalPoints || !packetCount) {
    return { success: false, message: "红包总积分和份数必须为正整数", data: null }
  }

  if (grantMode === "FIXED" && (!unitPoints || unitPoints > settings.postRedPacketMaxPoints)) {
    return { success: false, message: `固定红包单个${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }


  if (grantMode === "RANDOM" && totalPoints > settings.postRedPacketMaxPoints) {
    return { success: false, message: `拼手气红包总${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }


  if (packetCount > totalPoints) {
    return { success: false, message: `红包份数不能超过总${settings.pointName}，必须保证每人至少获得 1 ${settings.pointName}`, data: null }
  }

  const normalizedUnitPoints = unitPoints ?? totalPoints

  return {

    success: true,
    data: {
      enabled: true,
      mode: "RED_PACKET",
      grantMode: grantMode as PostRedPacketGrantMode,
      claimOrderMode: claimOrderMode as PostRedPacketClaimOrderMode,
      triggerType: triggerType as PostRedPacketTriggerType,
      totalPoints,
      packetCount,
      unitPoints: normalizedUnitPoints,
    },
  }


}

export async function assertPostRedPacketDailyLimit(params: { senderId: number; totalPoints: number }) {
  const settings = await getSiteSettings()
  const { start, end } = getBusinessDayRange()

  const aggregate = await import("@/db/post-red-packet-queries").then(({ sumTodayPostRedPacketPoints }) => sumTodayPostRedPacketPoints(params.senderId, start, end))


  const usedPoints = aggregate._sum.totalPoints ?? 0
  const totalUsedPoints = addSafeIntegers(usedPoints, params.totalPoints)
  if (totalUsedPoints === null || totalUsedPoints > settings.postRedPacketDailyLimit) {
    throw new Error(`今日发红包累计${settings.pointName}已超上限（${settings.postRedPacketDailyLimit}）`)
  }
}

export async function buildPostRedPacketCreateInput(params: {
  postId: string
  senderId: number
  config: NormalizedPostRedPacketConfig | null
}): Promise<Prisma.PostRedPacketUncheckedCreateInput | undefined> {
  if (!params.config?.enabled) {
    return undefined
  }

  const rewardPoolState = buildRewardPoolStoredState(params.config)

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: rewardPoolState.totalPoints })

  return {
    postId: params.postId,
    senderId: params.senderId,
    grantMode: rewardPoolState.grantMode,
    claimOrderMode: rewardPoolState.claimOrderMode,
    triggerType: params.config.triggerType,
    totalPoints: rewardPoolState.totalPoints,
    packetCount: rewardPoolState.packetCount,
    remainingPoints: rewardPoolState.remainingPoints,
    remainingCount: rewardPoolState.remainingCount,
    status: "ACTIVE",
  }
}

function allocateRandomAmount(remainingPoints: number, remainingCount: number) {
  if (remainingCount <= 1) {
    return remainingPoints
  }

  const guaranteedReserve = subtractSafeIntegers(remainingCount, 1)
  const distributionLimit = guaranteedReserve === null ? null : subtractSafeIntegers(remainingPoints, guaranteedReserve)
  if (distributionLimit === null || distributionLimit <= 0) {
    return 1
  }

  const doubledRemainingPoints = multiplyPositiveSafeIntegers(remainingPoints, 2)
  const averagedTwice = doubledRemainingPoints === null ? null : dividePositiveSafeIntegers(doubledRemainingPoints, remainingCount)
  const doubledMeanLimitRaw = averagedTwice === null ? null : subtractSafeIntegers(averagedTwice, 1)
  const doubledMeanLimit = doubledMeanLimitRaw === null || doubledMeanLimitRaw < 1 ? 1 : doubledMeanLimitRaw
  const safeMax = distributionLimit < doubledMeanLimit ? distributionLimit : doubledMeanLimit
  const exclusiveMax = addSafeIntegers(safeMax, 1)
  return randomInt(1, exclusiveMax ?? 2)
}



function allocateRedPacketAmount(packet: {
  grantMode: PostRedPacketGrantMode
} & PostRedPacketAllocationSnapshot) {
  if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
    throw new Error("红包已领完")
  }

  if (packet.grantMode === "FIXED") {
    const fixedAmount = dividePositiveSafeIntegers(packet.totalPoints, packet.packetCount)
    if (!fixedAmount) {
      throw new Error("固定红包金额配置不合法")
    }

    return fixedAmount
  }

  return allocateRandomAmount(packet.remainingPoints, packet.remainingCount)
}

function buildRedPacketClaimReason(params: {
  amount: number
  pointName: string
  postId: string
  triggerType: PostRedPacketTriggerType
}) {
  return `[post-red-packet] 领取帖子红包（${getPostRedPacketTriggerLabel(params.triggerType)}，${params.amount}${params.pointName}） post=${params.postId}`
}

function buildRedPacketSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `[post-red-packet] 发布帖子红包（${params.amount}${params.pointName}） post=${params.postId}`
}

function buildJackpotSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `[post-jackpot] 发布聚宝盆（初始 ${params.amount}${params.pointName}） post=${params.postId}`
}

function buildJackpotClaimReason(params: { amount: number; pointName: string; postId: string }) {
  return `[post-jackpot] 命中聚宝盆（${params.amount}${params.pointName}） post=${params.postId}`
}

function clampJackpotProbability(value: number) {
  const normalized = floorSafeInteger(value)
  if (normalized === null) {
    return 1
  }

  return clampSafeInteger(normalized, 1, 100) ?? 1
}

function shouldHitJackpot(probability: number) {
  return randomInt(1, 101) <= probability
}

function allocateJackpotAmount(poolPoints: number) {
  if (poolPoints <= 1) {
    return poolPoints
  }

  const exclusiveMax = addSafeIntegers(poolPoints, 1)
  return randomInt(1, exclusiveMax ?? 2)
}

function settleJackpotStatus(remainingPoints: number): PostRedPacketStatus {
  return remainingPoints <= 0 ? "COMPLETED" : "ACTIVE"
}

function resolveJackpotReplyOutcome(params: {
  replyCount: number
  priorWinCount: number
  baseIncrementPoints: number
  baseHitProbability: number
}): JackpotReplyOutcome {
  const isFirstReply = params.replyCount <= 1
  const depositedPoints = isFirstReply
    ? params.baseIncrementPoints
    : params.baseIncrementPoints > 1
      ? randomInt(1, params.baseIncrementPoints)
      : 0

  let hitProbability = isFirstReply
    ? params.baseHitProbability
    : params.baseHitProbability * JACKPOT_REPEAT_REPLY_PROBABILITY_FACTOR

  if (params.priorWinCount > 0) {
    hitProbability *= JACKPOT_REPEAT_WINNER_PROBABILITY_FACTOR ** params.priorWinCount
  }

  return {
    depositedPoints,
    hitProbability: clampJackpotProbability(hitProbability),
  }
}

function buildRewardPoolStoredState(config: NormalizedPostRedPacketConfig): RewardPoolStoredState {
  if (config.mode === "JACKPOT") {
    return {
      totalPoints: config.initialPoints,
      packetCount: 0,
      remainingPoints: config.initialPoints,
      remainingCount: 0,
      grantMode: "RANDOM",
      claimOrderMode: "RANDOM",
    }
  }

  return {
    totalPoints: config.totalPoints,
    packetCount: config.packetCount,
    remainingPoints: config.totalPoints,
    remainingCount: config.packetCount,
    grantMode: config.grantMode,
    claimOrderMode: config.claimOrderMode,
  }
}

export async function tryClaimPostRedPacket(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult> {
  const settings = await getSiteSettings()

  return claimPostRedPacketInTransaction({
    postId: input.postId,
    userId: input.userId,
    triggerType: input.triggerType,
    triggerCommentId: input.triggerCommentId,
    pointName: settings.pointName,
    buildClaimReason: buildRedPacketClaimReason,
    allocateAmount: (packet) => allocateRedPacketAmount({
      grantMode: packet.grantMode as PostRedPacketGrantMode,
      remainingPoints: packet.remainingPoints,
      remainingCount: packet.remainingCount,
      totalPoints: packet.totalPoints,
      packetCount: packet.packetCount,
    }),
  })
}

async function tryClaimPostJackpot(input: {
  postId: string
  userId: number
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult> {
  const settings = await getSiteSettings()

  return prisma.$transaction(async (tx) => {
    const [user, post] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, points: true, status: true },
      }),
      tx.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          status: true,
          authorId: true,
          content: true,
          redPacket: true,
        },
      }),
    ])

    if (!user || !post || post.status !== "NORMAL") {
      return { claimed: false as const, reason: "帖子不存在或暂不可抽奖" }
    }

    if (user.status === "MUTED" || user.status === "BANNED") {
      return { claimed: false as const, reason: "当前账号状态不可参与聚宝盆" }
    }

    const rewardConfig = parsePostRewardPoolConfigFromContent(post.content)
    if (!rewardConfig || rewardConfig.mode !== "JACKPOT" || !post.redPacket || post.redPacket.status !== "ACTIVE") {
      return { claimed: false as const, reason: "当前帖子没有可参与的聚宝盆" }
    }

    const packet = post.redPacket
    if (packet.remainingPoints <= 0) {
      await tx.postRedPacket.update({
        where: { id: packet.id },
        data: {
          status: "COMPLETED",
        },
      })
      return { claimed: false as const, reason: "聚宝盆已结束" }
    }

    if (post.authorId === user.id) {
      return { claimed: false as const, reason: "楼主回复不会触发聚宝盆" }
    }

    const [replyCount, priorWinSummary] = await Promise.all([
      tx.comment.count({
        where: {
          postId: post.id,
          userId: user.id,
        },
      }),
      tx.postRedPacketClaim.aggregate({
        where: {
          redPacketId: packet.id,
          userId: user.id,
        },
        _count: {
          _all: true,
        },
      }),
    ])

    const replyOutcome = resolveJackpotReplyOutcome({
      replyCount,
      priorWinCount: priorWinSummary._count._all,
      baseIncrementPoints: rewardConfig.replyIncrementPoints,
      baseHitProbability: rewardConfig.hitProbability,
    })
    const preparedIncrement = await prepareScopedPointDelta({
      scopeKey: "JACKPOT_REPLY_INCREMENT",
      baseDelta: replyOutcome.depositedPoints,
      userId: user.id,
    })
    const preparedProbability = await prepareScopedProbability({
      scopeKey: "JACKPOT_HIT_PROBABILITY",
      baseProbability: replyOutcome.hitProbability,
      userId: user.id,
    })
    const depositedPoolPoints = packet.remainingPoints + preparedIncrement.finalDelta
    if (!Number.isFinite(depositedPoolPoints) || depositedPoolPoints < 0) {
      return { claimed: false as const, reason: "聚宝盆积分池计算失败" }
    }

    const deposited = await tx.postRedPacket.updateMany({
      where: {
        id: packet.id,
        status: "ACTIVE",
        remainingPoints: packet.remainingPoints,
      },
      data: {
        remainingPoints: depositedPoolPoints,
      },
    })

    if (deposited.count === 0) {
      return { claimed: false as const, reason: "聚宝盆正在更新中，请稍后重试" }
    }

    const missEffectFeedback = buildJackpotEffectFeedback({
      preparedProbability,
      claimed: false,
      pointName: settings.pointName,
    })

    if (!shouldHitJackpot(preparedProbability.finalProbability)) {
      if (input.triggerCommentId && missEffectFeedback) {
        await upsertCommentEffectFeedback({
          tx,
          postId: post.id,
          commentId: input.triggerCommentId,
          userId: user.id,
          scene: "JACKPOT_REPLY",
          feedback: missEffectFeedback,
        })
      }

      return {
        claimed: false as const,
        reason: "本次未命中聚宝盆",
        effectFeedback: missEffectFeedback,
      }
    }

    const amount = allocateJackpotAmount(depositedPoolPoints)
    const preparedReward = await prepareScopedPointDelta({
      scopeKey: "JACKPOT_CLAIM",
      baseDelta: amount,
      userId: user.id,
    })
    const successEffectFeedback = buildJackpotEffectFeedback({
      preparedProbability,
      preparedReward,
      claimed: true,
      pointName: settings.pointName,
    })
    const nextRemainingPoints = subtractSafeIntegers(depositedPoolPoints, amount)
    if (nextRemainingPoints === null) {
      return { claimed: false as const, reason: "聚宝盆结算失败" }
    }
    const nextStatus = settleJackpotStatus(nextRemainingPoints)

    const updatedPacket = await tx.postRedPacket.updateMany({
      where: {
        id: packet.id,
        status: "ACTIVE",
        remainingPoints: depositedPoolPoints,
      },
      data: {
        remainingPoints: nextRemainingPoints,
        claimedCount: { increment: 1 },
        claimedPoints: { increment: amount },
        status: nextStatus,
      },
    })

    if (updatedPacket.count === 0) {
      return { claimed: false as const, reason: "聚宝盆正在结算中，请稍后重试" }
    }

    try {
      const rewardClaim = await tx.postRedPacketClaim.create({
        data: {
          redPacketId: packet.id,
          postId: post.id,
          userId: user.id,
          triggerType: "REPLY",
          triggerCommentId: input.triggerCommentId,
          amount,
        },
      })

      if (input.triggerCommentId && successEffectFeedback) {
        await upsertCommentEffectFeedback({
          tx,
          postId: post.id,
          commentId: input.triggerCommentId,
          userId: user.id,
          scene: "JACKPOT_REPLY",
          rewardClaimId: rewardClaim.id,
          feedback: successEffectFeedback,
        })
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
        await tx.postRedPacket.update({
          where: { id: packet.id },
          data: {
            remainingPoints: depositedPoolPoints,
            claimedCount: { decrement: 1 },
            claimedPoints: { decrement: amount },
            status: settleJackpotStatus(depositedPoolPoints),
          },
        })

        return { claimed: false as const, reason: "本次聚宝盆奖励已结算，请稍后重试" }
      }

      throw error
    }

    await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: user.points,
      prepared: preparedReward,
      pointName: settings.pointName,
      insufficientMessage: `${settings.pointName}不足，无法完成聚宝盆结算`,
      reason: buildJackpotClaimReason({ amount, pointName: settings.pointName, postId: post.id }),
      relatedType: "POST",
      relatedId: post.id,
    })

    return {
      claimed: true as const,
      amount: Math.abs(preparedReward.finalDelta),
      pointName: settings.pointName,
      rewardMode: "JACKPOT" as const,
      effectFeedback: successEffectFeedback,
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function tryTriggerPostRewardPool(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult | null> {
  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: {
      content: true,
    },
  })

  const rewardConfig = post ? parsePostRewardPoolConfigFromContent(post.content) : null
  if (!rewardConfig) {
    return null
  }

  if (rewardConfig.mode === "JACKPOT") {
    if (input.triggerType !== "REPLY") {
      return null
    }

    return tryClaimPostJackpot({
      postId: input.postId,
      userId: input.userId,
      triggerCommentId: input.triggerCommentId,
    })
  }

  return tryClaimPostRedPacket(input)
}


export async function getPostRedPacketSummary(postId: string, currentUserId?: number, page = 1, pageSize = 20): Promise<PostRedPacketSummary | undefined> {
  const settings = await getSiteSettings()
  const normalizedPageSize = clampSafeInteger(toPositiveInteger(pageSize) ?? 20, 10, 100) ?? 20
  const normalizedPage = clampSafeInteger(toPositiveInteger(page) ?? 1, 1) ?? 1

  const [packet, currentUser] = await findPostRedPacketSummaryData(postId, currentUserId)
  if (!packet) {
    return undefined
  }

  const rewardConfig = parsePostRewardPoolConfigFromContent(packet.post.content)
  if (!rewardConfig) {
    return undefined
  }

  const totalRecords = packet.claimedCount
  const totalPages = dividePositiveSafeIntegers(totalRecords, normalizedPageSize, "ceil") ?? 1
  const safePage = normalizedPage > totalPages ? totalPages : normalizedPage
  const currentUserClaim = currentUserId
    ? await findCurrentUserPostRedPacketClaim(packet.id, currentUserId)
    : undefined


  return {

    enabled: true,
    pointName: settings.pointName,
    rewardMode: rewardConfig.mode,
    rewardModeLabel: getPostRewardPoolModeLabel(rewardConfig.mode),
    senderId: packet.sender.id,
    senderName: packet.sender.nickname ?? packet.sender.username,
    grantMode: rewardConfig.mode === "RED_PACKET" ? packet.grantMode : undefined,
    claimOrderMode: rewardConfig.mode === "RED_PACKET" ? packet.claimOrderMode : undefined,
    claimOrderLabel: rewardConfig.mode === "RED_PACKET" ? getPostRedPacketClaimOrderModeLabel(packet.claimOrderMode) : undefined,
    triggerType: packet.triggerType,
    triggerLabel: rewardConfig.mode === "JACKPOT" ? "回复帖子后概率中奖" : getPostRedPacketTriggerLabel(packet.triggerType),
    totalPoints: rewardConfig.mode === "JACKPOT" ? (rewardConfig.initialPoints ?? packet.totalPoints) : packet.totalPoints,
    packetCount: rewardConfig.mode === "JACKPOT" ? packet.claimedCount : packet.packetCount,
    remainingPoints: packet.remainingPoints,
    remainingCount: rewardConfig.mode === "JACKPOT" ? 0 : packet.remainingCount,
    claimedCount: packet.claimedCount,
    claimedPoints: packet.claimedPoints,
    status: packet.status,
    jackpotInitialPoints: rewardConfig.mode === "JACKPOT" ? rewardConfig.initialPoints : undefined,
    jackpotReplyIncrementPoints: rewardConfig.mode === "JACKPOT" ? rewardConfig.replyIncrementPoints : undefined,
    jackpotHitProbability: rewardConfig.mode === "JACKPOT" ? rewardConfig.hitProbability : undefined,
    currentUserPoints: currentUser?.points ?? 0,
    currentUserClaimed: Boolean(currentUserClaim?._count._all),
    currentUserClaimAmount: currentUserClaim?._sum.amount ?? undefined,
    page: safePage,
    pageSize: normalizedPageSize,
    totalRecords,
    totalPages,
    hasPrevPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    records: packet.claims.map((item) => ({

      id: item.id,
      userId: item.user.id,
      username: item.user.username,
      nickname: item.user.nickname,
      avatarPath: item.user.avatarPath,
      amount: item.amount,
      triggerType: item.triggerType,
      triggerLabel: getPostRedPacketTriggerLabel(item.triggerType),
      createdAt: formatRelativeTime(item.createdAt),
    })),
  }
}

export async function createPostRedPacketAfterPostCreated(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  senderBalanceBeforeChange: number
  config: NormalizedPostRedPacketConfig | null
  pointName: string
}) {
  if (!params.config?.enabled) {
    return 0
  }

  const rewardPoolState = buildRewardPoolStoredState(params.config)
  const preparedPublish = await prepareScopedPointDelta({
    scopeKey: params.config.mode === "JACKPOT" ? "JACKPOT_PUBLISH" : "RED_PACKET_PUBLISH",
    baseDelta: -rewardPoolState.totalPoints,
    userId: params.senderId,
  })
  const totalPoolPoints = Math.abs(preparedPublish.finalDelta)

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: totalPoolPoints })

  await params.tx.postRedPacket.create({
    data: {
      postId: params.postId,
      senderId: params.senderId,
      grantMode: rewardPoolState.grantMode,
      claimOrderMode: rewardPoolState.claimOrderMode,
      triggerType: params.config.triggerType,
      totalPoints: totalPoolPoints,
      packetCount: params.config.mode === "JACKPOT" ? 0 : rewardPoolState.packetCount,
      remainingPoints: totalPoolPoints,
      remainingCount: rewardPoolState.remainingCount,
      status: "ACTIVE",
    },
  })

  await applyPointDelta({
    tx: params.tx,
    userId: params.senderId,
    beforeBalance: params.senderBalanceBeforeChange,
    prepared: preparedPublish,
    pointName: params.pointName,
    insufficientMessage: `${params.pointName}不足，无法发布当前奖励池`,
    reason: params.config.mode === "JACKPOT"
      ? buildJackpotSendReason({ amount: rewardPoolState.totalPoints, pointName: params.pointName, postId: params.postId })
      : buildRedPacketSendReason({ amount: rewardPoolState.totalPoints, pointName: params.pointName, postId: params.postId }),
    relatedType: "POST",
    relatedId: params.postId,
  })

  return totalPoolPoints
}
