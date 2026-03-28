import { notFound } from "next/navigation"

import { generateBoardRssXml } from "@/lib/rss"
import { getBoardBySlug } from "@/lib/boards"

export const dynamic = "force-dynamic"

interface BoardRssRouteProps {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, { params }: BoardRssRouteProps) {
  const board = await getBoardBySlug(params.slug)

  if (!board) {
    notFound()
  }

  const xml = await generateBoardRssXml(board)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
