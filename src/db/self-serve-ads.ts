import { prisma } from "@/db/client"

import type { SelfServeAdOrderStatus, SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"


const selfServeAdDelegate = prisma as typeof prisma & {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>
}

export interface SelfServeAdOrderRecord {
  id: string
  appCode: string
  userId: number
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string | null
  linkUrl: string
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number
  pricePoints: number
  status: SelfServeAdOrderStatus
  reviewNote: string | null
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function mapRow(row: Record<string, unknown>): SelfServeAdOrderRecord {
  return {
    id: String(row.id),
    appCode: String(row.appCode),

    userId: Number(row.userId),
    slotType: String(row.slotType) as SelfServeAdSlotType,
    slotIndex: Number(row.slotIndex),
    title: row.title == null ? null : String(row.title),
    linkUrl: String(row.linkUrl),
    imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
    textColor: row.textColor == null ? null : String(row.textColor),
    backgroundColor: row.backgroundColor == null ? null : String(row.backgroundColor),
    durationMonths: Number(row.durationMonths),
    pricePoints: Number(row.pricePoints),
    status: String(row.status) as SelfServeAdOrderStatus,
    reviewNote: row.reviewNote == null ? null : String(row.reviewNote),
    startsAt: row.startsAt instanceof Date ? row.startsAt : row.startsAt ? new Date(String(row.startsAt)) : null,
    endsAt: row.endsAt instanceof Date ? row.endsAt : row.endsAt ? new Date(String(row.endsAt)) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  }
}

export async function findSelfServeApprovedAds(appCode: string) {
  const rows = await selfServeAdDelegate.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "SelfServeAdOrder" WHERE "appCode" = $1 AND "status" = 'APPROVED' AND ("startsAt" IS NULL OR "startsAt" <= NOW()) AND ("endsAt" IS NULL OR "endsAt" >= NOW()) ORDER BY "slotType" ASC, "slotIndex" ASC, "updatedAt" DESC`,
    appCode,
  )
  return rows.map(mapRow)
}

export async function findSelfServeOrdersForAdmin(appCode: string) {
  const rows = await selfServeAdDelegate.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "SelfServeAdOrder" WHERE "appCode" = $1 ORDER BY CASE WHEN "status" = 'PENDING' THEN 0 ELSE 1 END ASC, "createdAt" DESC`,
    appCode,
  )
  return rows.map(mapRow)
}

export async function findSelfServeOrderById(id: string) {
  const rows = await selfServeAdDelegate.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "SelfServeAdOrder" WHERE "id" = $1 LIMIT 1`,
    id,
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function countPendingSelfServeOrders(appCode: string) {
  const rows = await selfServeAdDelegate.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT COUNT(*)::bigint AS count FROM "SelfServeAdOrder" WHERE "appCode" = $1 AND "status" = 'PENDING'`,
    appCode,
  )
  const count = rows[0]?.count ?? 0
  return typeof count === "bigint" ? Number(count) : Number(count)
}

export async function createSelfServeOrder(data: {
  id: string
  appCode: string
  userId: number
  slotType: SelfServeAdSlotType
  slotIndex: number
  title?: string | null
  linkUrl: string
  imageUrl?: string | null
  textColor?: string | null
  backgroundColor?: string | null
  durationMonths: number
  pricePoints: number
  status: SelfServeAdOrderStatus
  reviewNote?: string | null
}) {
  await selfServeAdDelegate.$executeRawUnsafe(
    `INSERT INTO "SelfServeAdOrder" ("id", "appCode", "userId", "slotType", "slotIndex", "title", "linkUrl", "imageUrl", "textColor", "backgroundColor", "durationMonths", "pricePoints", "status", "reviewNote", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4::"SelfServeAdSlotType",$5,$6,$7,$8,$9,$10,$11,$12,$13::"SelfServeAdOrderStatus",$14,NOW(),NOW())`,

    data.id,
    data.appCode,
    data.userId,
    data.slotType,
    data.slotIndex,
    data.title ?? null,
    data.linkUrl,
    data.imageUrl ?? null,
    data.textColor ?? null,
    data.backgroundColor ?? null,
    data.durationMonths,
    data.pricePoints,
    data.status,
    data.reviewNote ?? null,
  )

  return findSelfServeOrderById(data.id)
}

export async function updateSelfServeOrder(id: string, data: {
  title?: string | null
  linkUrl?: string
  imageUrl?: string | null
  textColor?: string | null
  backgroundColor?: string | null
  durationMonths?: number
  pricePoints?: number
  status?: SelfServeAdOrderStatus
  reviewNote?: string | null
  startsAt?: Date | null
  endsAt?: Date | null
  slotIndex?: number
}) {
  const existing = await findSelfServeOrderById(id)
  if (!existing) {
    return null
  }

  await selfServeAdDelegate.$executeRawUnsafe(
    `UPDATE "SelfServeAdOrder" SET "title" = $2, "linkUrl" = $3, "imageUrl" = $4, "textColor" = $5, "backgroundColor" = $6, "durationMonths" = $7, "pricePoints" = $8, "status" = $9::"SelfServeAdOrderStatus", "reviewNote" = $10, "startsAt" = $11, "endsAt" = $12, "slotIndex" = $13, "updatedAt" = NOW() WHERE "id" = $1`,
    id,
    data.title ?? existing.title,
    data.linkUrl ?? existing.linkUrl,
    data.imageUrl ?? existing.imageUrl,
    data.textColor ?? existing.textColor,
    data.backgroundColor ?? existing.backgroundColor,
    data.durationMonths ?? existing.durationMonths,
    data.pricePoints ?? existing.pricePoints,
    data.status ?? existing.status,
    data.reviewNote ?? existing.reviewNote,
    data.startsAt ?? existing.startsAt,
    data.endsAt ?? existing.endsAt,
    data.slotIndex ?? existing.slotIndex,
  )

  return findSelfServeOrderById(id)
}
