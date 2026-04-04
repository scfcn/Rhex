import { prisma } from "@/db/client"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

const PURCHASE_REASON_PREFIX = "[purchase:block]"

function buildReasonPrefix(postId: string, blockId: string) {
  return `${PURCHASE_REASON_PREFIX} post=${postId} block=${blockId}`
}

function buildReason(postId: string, blockId: string, pointName: string, price: number) {
  return `${buildReasonPrefix(postId, blockId)} 购买帖子隐藏内容（${price}${pointName}）`
}

export async function purchasePostBlock(options: { userId: number; postId: string; blockId: string; price: number; sellerId: number }) {
  const settings = await getSiteSettings()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pointLog.findFirst({
      where: {
        userId: options.userId,
        reason: {
          startsWith: buildReasonPrefix(options.postId, options.blockId),
        },
      },
      select: { id: true },
    })

    if (existing) {
      return { alreadyOwned: true }
    }

    const user = await tx.user.findUnique({
      where: { id: options.userId },
      select: { id: true, points: true },
    })

    const seller = await tx.user.findUnique({
      where: { id: options.sellerId },
      select: { id: true, points: true },
    })

    const buyerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_OUTGOING",
      baseDelta: -options.price,
      userId: options.userId,
    })
    const sellerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_INCOMING",
      baseDelta: options.price,
      userId: options.sellerId,
    })

    if (!user || !seller || (buyerPreparedDelta.finalDelta < 0 && user.points < Math.abs(buyerPreparedDelta.finalDelta))) {
      throw new Error(`当前${settings.pointName}不足`)
    }

    await applyPointDelta({
      tx,
      userId: options.userId,
      beforeBalance: user.points,
      prepared: buyerPreparedDelta,
      pointName: settings.pointName,
      insufficientMessage: `当前${settings.pointName}不足`,
      reason: buildReason(options.postId, options.blockId, settings.pointName, options.price),
      relatedType: "POST",
      relatedId: options.postId,
    })

    await applyPointDelta({
      tx,
      userId: options.sellerId,
      beforeBalance: seller.points,
      prepared: sellerPreparedDelta,
      pointName: settings.pointName,
      reason: "帖子隐藏内容被购买",
      relatedType: "POST",
      relatedId: options.postId,
    })

    return { alreadyOwned: false }
  })
}

export async function getPurchasedPostBlockIds(postId: string, userId?: number) {
  if (!userId) {
    return new Set<string>()
  }

  const rows = await prisma.pointLog.findMany({
    where: {
      userId,
      relatedType: "POST",
      relatedId: postId,
      reason: {
        startsWith: PURCHASE_REASON_PREFIX,
      },
    },
    select: {
      reason: true,
    },
  })

  return new Set<string>(
    rows
      .map((row) => row.reason.match(/block=([^\s]+)/)?.[1])
      .filter((value): value is string => Boolean(value)),
  )
}
