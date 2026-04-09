import { resolvePagination } from "@/db/helpers"
import { countPublicRssEntries, listPublicRssEntries, listPublicRssSources } from "@/db/rss-public-feed-queries"

function normalizeExternalUrl(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export interface RssUniverseFeedPageData {
  items: Array<{
    id: string
    sourceId: string
    sourceName: string
    sourceLogoPath: string | null
    title: string
    author: string | null
    linkUrl: string | null
    publishedAt: string | null
    createdAt: string
  }>
  availableSources: Array<{
    id: string
    siteName: string
    logoPath: string | null
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

function normalizeSourceIds(sourceIds: string[] | null | undefined, availableSourceIds: Set<string>) {
  if (!sourceIds?.length) {
    return []
  }

  return Array.from(new Set(sourceIds.map((value) => value.trim()).filter((value) => value && availableSourceIds.has(value))))
}

export async function getRssUniverseFeedPage(
  page: number,
  pageSize: number,
  sourceIds?: string[] | null,
): Promise<RssUniverseFeedPageData> {
  const availableSources = await listPublicRssSources()
  const normalizedSourceIds = normalizeSourceIds(sourceIds, new Set(availableSources.map((source) => source.id)))
  const total = await countPublicRssEntries(normalizedSourceIds)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
  const records = await listPublicRssEntries(pagination.skip, pagination.pageSize, normalizedSourceIds)

  return {
    items: records.map((record) => ({
      id: record.id,
      sourceId: record.sourceId,
      sourceName: record.source.siteName,
      sourceLogoPath: record.source.logoPath ?? null,
      title: record.title,
      author: record.author ?? null,
      linkUrl: normalizeExternalUrl(record.linkUrl ?? null),
      publishedAt: record.publishedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    })),
    availableSources: availableSources.map((source) => ({
      id: source.id,
      siteName: source.siteName,
      logoPath: source.logoPath ?? null,
    })),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
  }
}
