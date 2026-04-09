import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

const rssPublicFeedSelect = {
  id: true,
  sourceId: true,
  title: true,
  author: true,
  linkUrl: true,
  publishedAt: true,
  createdAt: true,
  source: {
    select: {
      id: true,
      siteName: true,
      logoPath: true,
    },
  },
} satisfies Prisma.RssEntrySelect

export type RssPublicFeedRecord = Prisma.RssEntryGetPayload<{ select: typeof rssPublicFeedSelect }>

const rssPublicSourceSelect = {
  id: true,
  siteName: true,
  logoPath: true,
} satisfies Prisma.RssSourceSelect

export type RssPublicSourceRecord = Prisma.RssSourceGetPayload<{ select: typeof rssPublicSourceSelect }>

function buildPublicRssFeedWhere(sourceIds: string[] = []) {
  return {
    reviewStatus: "APPROVED",
    ...(sourceIds.length > 0
      ? {
          sourceId: {
            in: sourceIds,
          },
        }
      : {}),
  } satisfies Prisma.RssEntryWhereInput
}

export function countPublicRssEntries(sourceIds: string[] = []) {
  return prisma.rssEntry.count({
    where: buildPublicRssFeedWhere(sourceIds),
  })
}

export function listPublicRssEntries(skip: number, take: number, sourceIds: string[] = []) {
  return prisma.rssEntry.findMany({
    where: buildPublicRssFeedWhere(sourceIds),
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: rssPublicFeedSelect,
  })
}

export function listPublicRssSources() {
  return prisma.rssSource.findMany({
    where: {
      entries: {
        some: {
          reviewStatus: "APPROVED",
        },
      },
    },
    orderBy: [
      { siteName: "asc" },
      { id: "asc" },
    ],
    select: rssPublicSourceSelect,
  })
}
