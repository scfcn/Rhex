"use client"

import Image from "next/image"
import { Globe2, Loader2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { RssUniverseFeedView } from "@/components/rss/rss-universe-feed-view"
import { getAvatarUrl } from "@/lib/avatar"
import { buildHomeFeedHref } from "@/lib/home-feed-route"
import type { RssUniverseFeedPageData } from "@/lib/rss-public-feed"
import { cn } from "@/lib/utils"

const RSS_UNIVERSE_SOURCE_FILTER_STORAGE_KEY = "bbs:rss-universe-source-filter"

function buildPageTokens(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: Array<number | "ellipsis"> = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? result.at(-1) as number : null
    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }
    result.push(current)
  }

  return result
}

function parseStoredSourceIds(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return null
    }

    const normalized = Array.from(new Set(
      parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ))

    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

function normalizeSelectedSourceIds(sourceIds: string[] | null | undefined, availableSourceIds: string[]) {
  if (availableSourceIds.length === 0) {
    return []
  }

  if (!sourceIds?.length) {
    return [...availableSourceIds]
  }

  const availableSet = new Set(availableSourceIds)
  const normalized = Array.from(new Set(
    sourceIds
      .map((value) => value.trim())
      .filter((value) => value && availableSet.has(value)),
  ))

  return normalized.length > 0 ? normalized : [...availableSourceIds]
}

function buildUniverseApiUrl(page: number, selectedSourceIds: string[]) {
  const searchParams = new URLSearchParams({
    page: String(Math.max(1, Math.trunc(page))),
  })

  if (selectedSourceIds.length > 0) {
    searchParams.set("sourceIds", selectedSourceIds.join(","))
  }

  return `/api/rss-universe?${searchParams.toString()}`
}

async function readUniverseFeedPage(page: number, selectedSourceIds: string[]) {
  const response = await fetch(buildUniverseApiUrl(page, selectedSourceIds), {
    method: "GET",
    cache: "no-store",
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message ?? "宇宙栏目加载失败")
  }

  return result.data as RssUniverseFeedPageData
}

function syncUniversePageUrl(page: number) {
  if (typeof window === "undefined") {
    return
  }

  window.history.replaceState(window.history.state, "", buildHomeFeedHref("universe", page))
}

function RssUniverseFeedLoading({ showUniverse }: { showUniverse: boolean }) {
  return (
    <div className="overflow-hidden rounded-md bg-background">
      <RssUniverseFeedView items={[]} showUniverse={showUniverse} />
      <div className="space-y-3 px-1 py-4 lg:px-4" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在读取宇宙源筛选...</span>
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 px-3 py-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-muted/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-4/5 rounded-full bg-muted/80" />
              <div className="h-3 w-3/5 rounded-full bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface LoadPageOptions {
  scrollToTop?: boolean
}

export function RssUniversePageClient({
  initialPage,
  showUniverse,
}: {
  initialPage: number
  showUniverse: boolean
}) {
  const [data, setData] = useState<RssUniverseFeedPageData | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const availableSourceIds = useMemo(() => data?.availableSources.map((source) => source.id) ?? [], [data])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [draftSourceIds, setDraftSourceIds] = useState<string[]>([])
  const initializedRef = useRef(false)
  const selectedCount = selectedSourceIds.length
  const allSelected = availableSourceIds.length === 0 || selectedCount === availableSourceIds.length

  const loadPage = useCallback(async (
    page: number,
    requestedSourceIds: string[],
    options?: LoadPageOptions,
  ) => {
    setLoading(true)
    setErrorMessage("")
    try {
      const nextData = await readUniverseFeedPage(page, requestedSourceIds)
      const nextAvailableSourceIds = nextData.availableSources.map((source) => source.id)
      const normalizedSelection = normalizeSelectedSourceIds(requestedSourceIds, nextAvailableSourceIds)
      setData(nextData)
      setSelectedSourceIds(normalizedSelection)
      setDraftSourceIds(normalizedSelection)
      syncUniversePageUrl(nextData.pagination.page)
      if (options?.scrollToTop !== false && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "宇宙栏目加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  const initializePage = useCallback(async () => {
    const storedSourceIds = parseStoredSourceIds(
      typeof window === "undefined" ? null : window.localStorage.getItem(RSS_UNIVERSE_SOURCE_FILTER_STORAGE_KEY),
    )
    await loadPage(initialPage, storedSourceIds ?? [], { scrollToTop: false })
  }, [initialPage, loadPage])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }

    initializedRef.current = true
    void initializePage()
  }, [initializePage])

  function persistSelectedSourceIds(nextSelectedSourceIds: string[]) {
    if (typeof window === "undefined") {
      return
    }

    if (nextSelectedSourceIds.length === 0 || nextSelectedSourceIds.length === availableSourceIds.length) {
      window.localStorage.removeItem(RSS_UNIVERSE_SOURCE_FILTER_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(RSS_UNIVERSE_SOURCE_FILTER_STORAGE_KEY, JSON.stringify(nextSelectedSourceIds))
  }

  function toggleDraftSource(sourceId: string) {
    setDraftSourceIds((current) => current.includes(sourceId)
      ? current.filter((value) => value !== sourceId)
      : [...current, sourceId])
  }

  async function applyFilters() {
    if (draftSourceIds.length === 0) {
      return
    }

    const normalized = availableSourceIds.filter((sourceId) => draftSourceIds.includes(sourceId))
    persistSelectedSourceIds(normalized)
    setPanelOpen(false)
    await loadPage(1, normalized)
  }

  function resetFilters() {
    const normalized = [...availableSourceIds]
    persistSelectedSourceIds(normalized)
    setPanelOpen(false)
    void loadPage(1, normalized)
  }

  if (!data) {
    return (
      <>
        <RssUniverseFeedLoading showUniverse={showUniverse} />
        {errorMessage ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => void initializePage()}
              className="rounded-full border border-red-200 bg-background px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100"
            >
              重新加载
            </button>
          </div>
        ) : null}
      </>
    )
  }

  const pageTokens = buildPageTokens(data.pagination.page, data.pagination.totalPages)

  return (
    <>
      <div className={cn("transition-opacity duration-200", loading ? "opacity-70" : "opacity-100")}>
        <RssUniverseFeedView items={data.items} showUniverse={showUniverse} />
      </div>

      {data.items.length === 0 ? (
        <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">
          {allSelected ? "宇宙栏目还没有可展示的采集内容。" : "当前源筛选条件下还没有可展示的采集内容。"}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {data.pagination.totalPages > 1 ? (
        <nav className="flex flex-col items-center gap-3 pt-2" aria-label="pagination">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void loadPage(data.pagination.page - 1, selectedSourceIds)}
              disabled={!data.pagination.hasPrevPage || loading}
              className={data.pagination.hasPrevPage && !loading ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
            >
              上一页
            </button>

            {pageTokens.map((token, index) => token === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => void loadPage(token, selectedSourceIds)}
                disabled={loading || token === data.pagination.page}
                aria-current={token === data.pagination.page ? "page" : undefined}
                className={cn(
                  "inline-flex min-w-10 items-center justify-center rounded-full border px-3 py-2 text-sm transition-colors",
                  token === data.pagination.page
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:bg-accent/40",
                  loading ? "pointer-events-none opacity-60" : "",
                )}
              >
                {token}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadPage(data.pagination.page + 1, selectedSourceIds)}
              disabled={!data.pagination.hasNextPage || loading}
              className={data.pagination.hasNextPage && !loading ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
            >
              下一页
            </button>
          </div>
        </nav>
      ) : null}

      {panelOpen ? (
        <button
          type="button"
          aria-label="关闭 RSS 源筛选面板"
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setPanelOpen(false)
            setDraftSourceIds(selectedSourceIds)
          }}
        />
      ) : null}

      {availableSourceIds.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end sm:bottom-5 sm:right-5">
          {panelOpen ? (
            <div className="fixed inset-x-3 bottom-20 z-50 overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_rgba(15,23,42,0.18)] sm:absolute sm:inset-x-auto sm:bottom-[calc(100%+0.75rem)] sm:right-0 sm:w-[min(30rem,calc(100vw-2.5rem))] lg:w-136">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Globe2 className="h-4 w-4" />
                    <span>宇宙源筛选</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">筛选结果保存在当前浏览器，只影响宇宙栏目页面。</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    setPanelOpen(false)
                    setDraftSourceIds(selectedSourceIds)
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[11px] text-muted-foreground">
                <span>已选 {draftSourceIds.length} / {availableSourceIds.length}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-border bg-card px-2.5 py-1 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => setDraftSourceIds([...availableSourceIds])}
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-border bg-card px-2.5 py-1 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={resetFilters}
                  >
                    恢复默认
                  </button>
                </div>
              </div>

              <div className="max-h-[min(48vh,20rem)] overflow-y-auto px-3 pb-3 sm:max-h-[min(54vh,22rem)]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {data.availableSources.map((source) => {
                    const checked = draftSourceIds.includes(source.id)
                    const logoUrl = getAvatarUrl(source.logoPath, source.siteName)

                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => toggleDraftSource(source.id)}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-[14px] border px-2 py-1.5 text-left transition-colors",
                          checked
                            ? "border-foreground/20 bg-accent/60"
                            : "border-border bg-card hover:bg-accent/30",
                        )}
                      >
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                          <Image src={logoUrl} alt={`${source.siteName} logo`} fill sizes="24px" className="object-cover" unoptimized />
                        </div>
                        <div className="min-w-0 flex-1 truncate text-[11px] leading-4 text-foreground">{source.siteName}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {draftSourceIds.length === availableSourceIds.length ? "当前包含全部 RSS 源。" : `当前将包含 ${draftSourceIds.length} 个 RSS 源。`}
                </p>
                <button
                  type="button"
                  disabled={draftSourceIds.length === 0 || loading}
                  onClick={() => void applyFilters()}
                  className={draftSourceIds.length > 0 && !loading ? "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-90 sm:w-auto" : "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-muted px-3.5 text-xs font-medium text-muted-foreground opacity-60 sm:w-auto"}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
                  <span>{loading ? "更新中..." : "应用筛选"}</span>
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setDraftSourceIds(selectedSourceIds)
              setPanelOpen((current) => !current)
            }}
            className="group inline-flex h-14 items-center gap-3 rounded-full border border-foreground/10 bg-foreground px-4 text-background shadow-[0_18px_48px_rgba(15,23,42,0.28)] transition-transform duration-200 hover:-translate-y-0.5"
            aria-label="打开宇宙 RSS 源筛选"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/12">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[11px] uppercase tracking-[0.22em] text-background/65">Universe</span>
              <span className="mt-1 text-sm">{allSelected ? "全部源" : `${selectedCount} 个源`}</span>
            </span>
          </button>
        </div>
      ) : null}
    </>
  )
}
