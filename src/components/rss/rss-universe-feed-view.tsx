import Image from "next/image"

import { getAvatarUrl } from "@/lib/avatar"
import { formatRelativeTime } from "@/lib/formatters"

import { HomeFeedTabs } from "@/components/home/home-feed-tabs"
import type { RssUniverseFeedPageData } from "@/lib/rss-public-feed"

export function RssUniverseFeedView({
  items,
  showUniverse,
}: {
  items: RssUniverseFeedPageData["items"]
  showUniverse: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md bg-background">
      <HomeFeedTabs currentSort="universe" showUniverse={showUniverse} />

      <div className="divide-y divide-border/70 lg:px-4">
        {items.map((item) => {
          const timestamp = item.publishedAt ?? item.createdAt
          const logoUrl = getAvatarUrl(item.sourceLogoPath, item.sourceName)

          return (
            <article key={item.id} className="flex items-start gap-3 px-1 py-3 sm:px-3">
              <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                <Image src={logoUrl} alt={`${item.sourceName} logo`} fill sizes="40px" className="object-cover" unoptimized />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                {item.linkUrl ? (
                  <a href={item.linkUrl} target="_blank" rel="noreferrer" className="block truncate whitespace-nowrap text-[15px] leading-6 text-foreground transition hover:text-primary">
                    {item.title}
                  </a>
                ) : (
                  <h2 className="truncate whitespace-nowrap text-[15px] leading-6 text-foreground">{item.title}</h2>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-foreground">{item.sourceName}</span>
                  <span>{formatRelativeTime(timestamp)}</span>
                  {item.author ? <span>作者 {item.author}</span> : null}
                  {item.linkUrl ? (
                    <a href={item.linkUrl} target="_blank" rel="noreferrer" className="transition hover:text-foreground">
                      原文
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
