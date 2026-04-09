"use client"

import { ForumPostListItem } from "@/components/forum-post-list-item"
import { HomeFeedTabs } from "@/components/home-feed-tabs"
import { PostGalleryGrid } from "@/components/post-gallery-grid"
import type { FeedDisplayItem } from "@/lib/forum-feed-display"
import type { HomeFeedSort } from "@/lib/home-feed-route"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"

interface ForumFeedViewProps {
  items: FeedDisplayItem[]
  currentSort: HomeFeedSort
  showUniverse: boolean
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function ForumFeedView({ items, currentSort, showUniverse, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedViewProps) {
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const pinnedItems = items.filter((item) => item.pinScope === "GLOBAL")
  const normalItems = items.filter((item) => item.pinScope !== "GLOBAL")

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <HomeFeedTabs currentSort={currentSort} showUniverse={showUniverse} />

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
