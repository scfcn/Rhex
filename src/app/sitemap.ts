import type { MetadataRoute } from "next"

import { getBoards } from "@/lib/boards"
import { getPostPath } from "@/lib/post-links"
import { getHomepagePosts } from "@/lib/posts"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"



export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [boards, posts, zones, settings] = await Promise.all([getBoards(), getHomepagePosts(), getZones(), getSiteSettings()])

  const boardUrls = await Promise.all(boards.map(async (board) => ({
    url: await toAbsoluteSiteUrl(`/boards/${board.slug}`),
    changeFrequency: "daily" as const,
    priority: 0.8,
  })))

  const zoneUrls = await Promise.all(zones.map(async (zone) => ({
    url: await toAbsoluteSiteUrl(`/zones/${zone.slug}`),
    changeFrequency: "daily" as const,
    priority: 0.85,
  })))

  const postUrls = await Promise.all(posts.map(async (post) => ({
    url: await toAbsoluteSiteUrl(getPostPath(post, { mode: settings.postLinkDisplayMode })),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  })))


  return [
    {
      url: await toAbsoluteSiteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },

    ...zoneUrls,
    ...boardUrls,
    ...postUrls,
  ]
}

