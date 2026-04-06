"use client"

import { ForumPostListItem } from "@/components/forum-post-list-item"
import { PostGalleryGrid } from "@/components/post-gallery-grid"
import type { PostStreamDisplayItem } from "@/lib/forum-post-stream-display"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"

interface ForumPostStreamViewProps {
  items: PostStreamDisplayItem[]
  listDisplayMode?: PostListDisplayMode
  showBoard?: boolean
  showPinnedDivider?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function ForumPostStreamView({
  items,
  listDisplayMode,
  showBoard = true,
  showPinnedDivider = false,
  postLinkDisplayMode = "SLUG",
}: ForumPostStreamViewProps) {
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const pinnedPosts = items.filter((post) => Boolean(post.pinLabel))
  const normalPosts = items.filter((post) => !post.pinLabel)
  const shouldShowPinnedDivider = showPinnedDivider && pinnedPosts.length > 0 && normalPosts.length > 0

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="lg:pl-4">
        {pinnedPosts.map((post, index) => (
          <div key={post.id}>
            <ForumPostListItem
              item={post}
              showBoard={showBoard}
              compactFirstItem={index === 0}
              postLinkDisplayMode={postLinkDisplayMode}
            />
          </div>
        ))}
        {shouldShowPinnedDivider ? (
          <div className="mb-2 mt-4 flex items-center gap-3 px-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : null}
        {resolvedListDisplayMode === "GALLERY" ? (
          <PostGalleryGrid items={normalPosts} showBoard={showBoard} postLinkDisplayMode={postLinkDisplayMode} />
        ) : normalPosts.map((post, index) => (
          <ForumPostListItem
            key={post.id}
            item={post}
            showBoard={showBoard}
            compactFirstItem={pinnedPosts.length === 0 && index === 0}
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ))}
      </div>
    </div>
  )
}
