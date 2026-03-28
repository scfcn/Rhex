import { notFound } from "next/navigation"

import { generateZoneRssXml } from "@/lib/rss"
import { getZoneBySlug } from "@/lib/zones"

export const dynamic = "force-dynamic"

interface ZoneRssRouteProps {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, { params }: ZoneRssRouteProps) {
  const zone = await getZoneBySlug(params.slug)

  if (!zone) {
    notFound()
  }

  const xml = await generateZoneRssXml(zone)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
