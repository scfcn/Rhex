import { notFound } from "next/navigation"

import { generateUserRssXml } from "@/lib/rss"
import { getUserProfile } from "@/lib/users"

export const dynamic = "force-dynamic"

interface UserRssRouteProps {
  params: {
    username: string
  }
}

export async function GET(_request: Request, { params }: UserRssRouteProps) {
  const user = await getUserProfile(params.username)

  if (!user) {
    notFound()
  }

  const xml = await generateUserRssXml(user)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
