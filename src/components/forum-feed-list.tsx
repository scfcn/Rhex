import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { mapForumFeedItemsToDisplayItems } from "@/lib/forum-feed-display"
import { type PostListDisplayMode } from "@/lib/post-list-display"
import { getSiteSettings } from "@/lib/site-settings"

import { ForumFeedView } from "@/components/forum-feed-view"

interface ForumFeedListProps {
  items: ForumFeedItem[]
  currentSort: Exclude<FeedSort, "weekly">
  showUniverse?: boolean
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

export async function ForumFeedList({ items, currentSort, showUniverse = false, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedListProps) {
  const settings = await getSiteSettings()
  const displayItems = mapForumFeedItemsToDisplayItems(items, currentSort, settings)

  return (
    <ForumFeedView
      items={displayItems}
      currentSort={currentSort}
      showUniverse={showUniverse}
      listDisplayMode={listDisplayMode}
      postLinkDisplayMode={postLinkDisplayMode}
    />
  )
}
