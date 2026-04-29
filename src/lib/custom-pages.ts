import { listPublishedCustomPagePathsWithoutFooter, findPublishedCustomPageByRoutePath, type CustomPageRow } from "@/db/custom-page-queries"
import { formatMonthDayTime, serializeDateTime } from "@/lib/formatters"
import { stripCustomPageHtmlToText } from "@/lib/custom-page-types"

export interface CustomPageItem {
  id: string
  title: string
  routePath: string
  htmlContent: string
  status: string
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
  createdAt: string
  publishedAt: string | null
  publishedAtText: string | null
  creatorName: string
  summaryText: string
}

function mapCustomPage(item: CustomPageRow): CustomPageItem {
  const publishedAt = serializeDateTime(item.publishedAt)

  return {
    id: item.id,
    title: item.title,
    routePath: item.routePath,
    htmlContent: item.htmlContent,
    status: item.status,
    includeHeader: item.includeHeader,
    includeFooter: item.includeFooter,
    includeLeftSidebar: item.includeLeftSidebar,
    includeRightSidebar: item.includeRightSidebar,
    createdAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
    publishedAt,
    publishedAtText: publishedAt ? formatMonthDayTime(publishedAt) : null,
    creatorName: item.creator.nickname ?? item.creator.username,
    summaryText: stripCustomPageHtmlToText(item.htmlContent),
  }
}

export async function getPublishedCustomPageByPath(routePath: string) {
  const item = await findPublishedCustomPageByRoutePath(routePath)
  return item ? mapCustomPage(item) : null
}

export async function getPublishedCustomPageFooterHiddenPaths() {
  return listPublishedCustomPagePathsWithoutFooter()
}
