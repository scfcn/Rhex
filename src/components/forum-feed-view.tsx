"use client"

import Link from "next/link"
import { Clock3, Flame, Sparkles, Users2 } from "lucide-react"

import { ForumPostListItem } from "@/components/forum-post-list-item"
import { PostGalleryGrid } from "@/components/post-gallery-grid"
import type { FeedSort } from "@/lib/forum-feed"
import type { FeedDisplayItem } from "@/lib/forum-feed-display"
import { buildHomeFeedHref } from "@/lib/home-feed-route"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"

interface ForumFeedViewProps {
  items: FeedDisplayItem[]
  currentSort: FeedSort
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

const tabs: Array<{ key: Exclude<FeedSort, "weekly">; label: string; icon: typeof Clock3 }> = [
  { key: "latest", label: "最新", icon: Clock3 },
  { key: "new", label: "新贴", icon: Sparkles },
  { key: "hot", label: "热门", icon: Flame },
  { key: "following", label: "关注", icon: Users2 },
]

export function ForumFeedView({ items, currentSort, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedViewProps) {
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const pinnedItems = items.filter((item) => item.pinScope === "GLOBAL")
  const normalItems = items.filter((item) => item.pinScope !== "GLOBAL")

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="flex items-center justify-between gap-1 border-b py-2 lg:justify-start lg:gap-2 lg:px-4 lg:py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentSort === tab.key

          return (
            <Link
              key={tab.key}
              href={buildHomeFeedHref(tab.key)}
              className={active ? "flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-foreground sm:px-4 sm:py-2 sm:text-sm lg:gap-2" : "flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 sm:px-4 sm:py-2 sm:text-sm lg:gap-2"}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="lg:pl-4">
        {pinnedItems.map((item) => (
          <ForumPostListItem
            key={item.id}
            item={item}
            showBoard
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ))}
        {pinnedItems.length > 0 && normalItems.length > 0 && resolvedListDisplayMode === "GALLERY" ? (
          <div className="mb-2 mt-4 flex items-center gap-3 px-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : null}
        {resolvedListDisplayMode === "GALLERY" ? (
          <PostGalleryGrid items={normalItems} showBoard postLinkDisplayMode={postLinkDisplayMode} />
        ) : normalItems.map((item) => (
          <ForumPostListItem
            key={item.id}
            item={item}
            showBoard
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ))}
      </div>
    </div>
  )
}
