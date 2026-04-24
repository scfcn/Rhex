"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ForumPostStreamView } from "@/components/forum/forum-post-stream-view"
import type { TaxonomyPostSortLinks } from "@/lib/forum-taxonomy-sort"
import type { PostStreamDisplayItem } from "@/lib/forum-post-stream-display"
import type { PostListDisplayMode } from "@/lib/post-list-display"

interface InfiniteForumPostStreamProps {
  apiPath: string
  initialItems: PostStreamDisplayItem[]
  initialPage: number
  initialHasNextPage: boolean
  listDisplayMode?: PostListDisplayMode
  showBoard?: boolean
  showPinnedDivider?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
  sortLinks?: TaxonomyPostSortLinks
}

interface PostStreamApiPayload {
  items: PostStreamDisplayItem[]
  page: number
  hasNextPage: boolean
}

export function InfiniteForumPostStream({
  apiPath,
  initialItems,
  initialPage,
  initialHasNextPage,
  listDisplayMode,
  showBoard = true,
  showPinnedDivider = false,
  postLinkDisplayMode = "SLUG",
  sortLinks,
}: InfiniteForumPostStreamProps) {
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(initialPage)
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasNextPage) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const nextUrl = new URL(apiPath, window.location.origin)
      nextUrl.searchParams.set("page", String(page + 1))

      const response = await fetch(nextUrl.toString(), {
        credentials: "same-origin",
      })
      const result = await response.json().catch(() => null) as { data?: PostStreamApiPayload; message?: string } | null

      if (!response.ok || !result?.data) {
        setError(result?.message || "加载更多帖子失败")
        return
      }

      setItems((current) => [...current, ...result.data!.items])
      setPage(result.data.page)
      setHasNextPage(result.data.hasNextPage)
    } catch {
      setError("加载更多帖子失败")
    } finally {
      setIsLoading(false)
    }
  }, [apiPath, hasNextPage, isLoading, page])

  useEffect(() => {
    setItems(initialItems)
    setPage(initialPage)
    setHasNextPage(initialHasNextPage)
    setIsLoading(false)
    setError("")
  }, [apiPath, initialHasNextPage, initialItems, initialPage])

  useEffect(() => {
    if (!hasNextPage || !sentinelRef.current) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore()
      }
    }, { rootMargin: "240px 0px" })

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [hasNextPage, loadMore])

  return (
    <div className="space-y-4">
      <ForumPostStreamView
        items={items}
        listDisplayMode={listDisplayMode}
        showBoard={showBoard}
        showPinnedDivider={showPinnedDivider}
        postLinkDisplayMode={postLinkDisplayMode}
        sortLinks={sortLinks}
      />
      {hasNextPage ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
          <button type="button" onClick={() => void loadMore()} disabled={isLoading} className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? "加载中..." : "继续加载"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
