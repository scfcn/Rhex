"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"

interface FavoriteCollectionDialogProps {
  open: boolean
  postId: string
  favored: boolean
  openMode: "newly-favored" | "manage"
  onClose: () => void
  onFavoriteChanged: (favored: boolean) => void
}

interface FavoriteCollectionModalData {
  favored: boolean
  keyword: string
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  collections: Array<{
    id: string
    title: string
    description: string | null
    visibility: "PUBLIC" | "PRIVATE"
    allowOtherUsersToContribute: boolean
    requireContributionApproval: boolean
    ownerId: number
    ownerName: string
    postCount: number
    alreadyIncluded: boolean
    pendingSubmission: boolean
    pendingOwnedByCurrentUser: boolean
    isOwner: boolean
    canContribute: boolean
  }>
}

const EMPTY_MODAL_DATA: FavoriteCollectionModalData = {
  favored: false,
  keyword: "",
  pagination: {
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  },
  collections: [],
}

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

export function FavoriteCollectionDialog({
  open,
  postId,
  favored,
  openMode,
  onClose,
  onFavoriteChanged,
}: FavoriteCollectionDialogProps) {
  const [data, setData] = useState<FavoriteCollectionModalData>(EMPTY_MODAL_DATA)
  const [loading, setLoading] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftVisibility, setDraftVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE")
  const [draftAllowOtherUsersToContribute, setDraftAllowOtherUsersToContribute] = useState(false)
  const [draftRequireContributionApproval, setDraftRequireContributionApproval] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null)
  const [searchDraft, setSearchDraft] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [activeTab, setActiveTab] = useState<"existing" | "create">("existing")
  const [isPending, startTransition] = useTransition()

  const publicCreateEnabled = draftVisibility === "PUBLIC"

  const loadModalData = useCallback(async (page = 1, keyword = "") => {
    setLoading(true)
    const searchParams = new URLSearchParams({
      postId,
      page: String(page),
    })
    if (keyword.trim()) {
      searchParams.set("q", keyword.trim())
    }

    try {
      const response = await fetch(`/api/favorite-collections?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message ?? "合集数据加载失败")
      }
      setData(result.data as FavoriteCollectionModalData)
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "合集数据加载失败",
      })
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    if (!open) {
      return
    }

    setFeedback(openMode === "newly-favored"
      ? { tone: "success", message: "收藏成功，可选择加入合集；也可以直接关闭，仅保留默认收藏。" }
      : null)
    setActiveTab(openMode === "newly-favored" ? "create" : "existing")
    setSearchDraft("")
    setSearchKeyword("")
    void loadModalData(1, "")
  }, [loadModalData, open, openMode, postId])

  function resetCreateDraft() {
    setDraftTitle("")
    setDraftDescription("")
    setDraftVisibility("PRIVATE")
    setDraftAllowOtherUsersToContribute(false)
    setDraftRequireContributionApproval(false)
  }

  async function runFavoriteToggle() {
    const response = await fetch("/api/posts/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "收藏操作失败")
    }

    const nextFavored = Boolean(result.data?.favored)
    onFavoriteChanged(nextFavored)
    setData((current) => ({
      ...current,
      favored: nextFavored,
    }))
    return {
      nextFavored,
      message: String(result.message ?? (nextFavored ? "收藏成功" : "已取消收藏")),
    }
  }

  function addToCollection(collectionId: string) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/favorite-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-post",
            collectionId,
            postId,
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message ?? "加入合集失败")
        }

        const message = String(result.message ?? "帖子已加入合集")
        setFeedback({
          tone: "success",
          message,
        })
        setData((current) => ({
          ...current,
          collections: current.collections.map((item) => item.id === collectionId
            ? {
                ...item,
                alreadyIncluded: result.data?.status === "APPROVED",
                pendingSubmission: result.data?.status === "PENDING",
                pendingOwnedByCurrentUser: result.data?.status === "PENDING",
                postCount: result.data?.status === "APPROVED" ? item.postCount + 1 : item.postCount,
              }
            : item),
        }))
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "加入合集失败",
        })
      }
    })
  }

  function createAndAdd() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/favorite-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            postId,
            collection: {
              title: draftTitle,
              description: draftDescription,
              visibility: draftVisibility,
              allowOtherUsersToContribute: publicCreateEnabled ? draftAllowOtherUsersToContribute : false,
              requireContributionApproval: publicCreateEnabled && draftAllowOtherUsersToContribute ? draftRequireContributionApproval : false,
            },
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message ?? "创建合集失败")
        }

        setFeedback({
          tone: "success",
          message: String(result.message ?? "合集已创建"),
        })
        resetCreateDraft()
        setSearchDraft("")
        setSearchKeyword("")
        await loadModalData(1, "")
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "创建合集失败",
        })
      }
    })
  }

  function cancelFavorite() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await runFavoriteToggle()
        setFeedback({
          tone: "info",
          message: result.message,
        })
        onClose()
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "取消收藏失败",
        })
      }
    })
  }

  function submitSearch() {
    const nextKeyword = searchDraft.trim()
    setSearchKeyword(nextKeyword)
    setFeedback(null)
    void loadModalData(1, nextKeyword)
  }

  const pageTokens = buildPageTokens(data.pagination.page, data.pagination.totalPages)

  return (
    <DialogPortal open={open} onClose={isPending ? undefined : onClose} closeOnEscape={!isPending}>
      <div className="fixed inset-0 z-[140]">
        <DialogBackdrop className="bg-black/55" closeLabel="关闭合集弹窗" onClick={isPending ? undefined : onClose} />
        <DialogPositioner className="items-start px-3 py-3 sm:px-4 sm:py-6">
          <DialogPanel className="flex w-[min(100%,56rem)] max-w-3xl flex-col overflow-hidden p-0 max-sm:h-[calc(100dvh-1.5rem)] max-sm:max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">加入收藏合集</h3>
                  <p className="mt-1 text-sm text-muted-foreground">默认收藏保留不变，你可以额外把帖子加入合集里归档。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {favored ? (
                    <Button type="button" variant="ghost" className="h-9 px-3 text-sm" disabled={isPending} onClick={cancelFavorite}>
                      取消收藏
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className="h-9 px-3 text-sm" disabled={isPending} onClick={onClose}>
                    关闭
                  </Button>
                </div>
              </div>
            </div>

            {feedback ? (
              <div className={feedback.tone === "error" ? "border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700" : feedback.tone === "success" ? "border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700" : "border-b border-sky-200 bg-sky-50 px-5 py-3 text-sm text-sky-700"}>
                {feedback.message}
              </div>
            ) : null}

            <div className="border-b border-border px-4 py-3 lg:hidden">
              <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-secondary/40 p-1">
                <button
                  type="button"
                  className={activeTab === "existing" ? "h-9 rounded-[12px] bg-background px-3 text-sm font-medium text-foreground shadow-sm" : "h-9 rounded-[12px] px-3 text-sm text-muted-foreground"}
                  onClick={() => setActiveTab("existing")}
                >
                  选择现有合集
                </button>
                <button
                  type="button"
                  className={activeTab === "create" ? "h-9 rounded-[12px] bg-background px-3 text-sm font-medium text-foreground shadow-sm" : "h-9 rounded-[12px] px-3 text-sm text-muted-foreground"}
                  onClick={() => setActiveTab("create")}
                >
                  新建合集并加入
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className={activeTab === "existing" ? "order-2 border-b border-border p-4 sm:p-5 lg:order-1 lg:border-b-0 lg:border-r" : "hidden order-2 border-b border-border p-4 sm:p-5 lg:block lg:order-1 lg:border-b-0 lg:border-r"}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">选择现有合集</h4>
                
                  </div>
                  <Link href="/collections" className="text-xs text-muted-foreground transition hover:text-foreground">
                    查看合集页
                  </Link>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        submitSearch()
                      }
                    }}
                    placeholder="搜索合集名称或说明"
                    className="h-10 min-w-0 flex-1 rounded-[16px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30"
                  />
                  <Button type="button" variant="outline" className="h-10 px-4 text-sm sm:shrink-0" disabled={loading || isPending} onClick={submitSearch}>
                    搜索
                  </Button>
                  {searchKeyword ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 px-3 text-sm"
                      disabled={loading || isPending}
                      onClick={() => {
                        setSearchDraft("")
                        setSearchKeyword("")
                        setFeedback(null)
                        void loadModalData(1, "")
                      }}
                    >
                      清除
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {loading ? <div className="rounded-[20px] border border-border bg-secondary/20 px-4 py-5 text-sm text-muted-foreground">加载合集中...</div> : null}
                  {!loading && data.collections.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-border bg-secondary/10 px-4 py-5 text-sm text-muted-foreground">
                      {searchKeyword ? "没有找到匹配的合集，可以调整关键词或在右侧直接新建一个。" : "你当前还没有可用合集，右侧可以直接新建一个。"}
                    </div>
                  ) : null}
                  {!loading ? data.collections.map((collection) => (
                    <div key={collection.id} className="rounded-[20px] border border-border bg-secondary/10 px-3 py-3 sm:px-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-medium">{collection.title}</h5>
                            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{collection.visibility === "PUBLIC" ? "公开" : "私有"}</span>
                            {collection.isOwner ? <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">我创建的</span> : <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">创建者 {collection.ownerName}</span>}
                            {collection.allowOtherUsersToContribute ? <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{collection.requireContributionApproval ? "允许投稿 / 需审核" : "允许投稿 / 免审核"}</span> : null}
                          </div>
                          {collection.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{collection.description}</p> : null}
                          <p className="mt-2 text-xs text-muted-foreground">已收录 {collection.postCount} 帖</p>
                        </div>
                        <div className="sm:shrink-0">
                          {collection.alreadyIncluded ? (
                            <Button type="button" variant="outline" className="h-9 w-full px-3 text-sm sm:w-auto" disabled>
                              已加入
                            </Button>
                          ) : collection.pendingSubmission ? (
                            <Button type="button" variant="outline" className="h-9 w-full px-3 text-sm sm:w-auto" disabled>
                              待审核
                            </Button>
                          ) : (
                            <Button type="button" className="h-9 w-full px-3 text-sm sm:w-auto" disabled={isPending || !collection.canContribute} onClick={() => addToCollection(collection.id)}>
                              加入
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : null}

                  {!loading && data.pagination.totalPages > 1 ? (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <Button type="button" variant="outline" className="h-8 px-3 text-xs" disabled={!data.pagination.hasPrevPage || isPending} onClick={() => void loadModalData(data.pagination.page - 1, searchKeyword)}>
                        上一页
                      </Button>
                      {pageTokens.map((token, index) => token === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={token}
                          type="button"
                          variant={token === data.pagination.page ? "default" : "outline"}
                          className="h-8 min-w-8 px-2 text-xs"
                          disabled={isPending || token === data.pagination.page}
                          onClick={() => void loadModalData(token, searchKeyword)}
                        >
                          {token}
                        </Button>
                      ))}
                      <Button type="button" variant="outline" className="h-8 px-3 text-xs" disabled={!data.pagination.hasNextPage || isPending} onClick={() => void loadModalData(data.pagination.page + 1, searchKeyword)}>
                        下一页
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={activeTab === "create" ? "order-1 p-4 sm:p-5 lg:order-2" : "hidden order-1 p-4 sm:p-5 lg:block lg:order-2"}>
                <div>
                  <h4 className="text-sm font-semibold">新建合集并加入</h4>
                  <p className="mt-1 text-xs text-muted-foreground">移动端优先展示创建表单，方便直接新建后加入。</p>
                </div>

                <div className="mt-3 space-y-3">
                  <label className="block space-y-2 text-sm">
                    <span className="font-medium text-foreground">合集名称</span>
                    <input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      placeholder="例如：前端设计灵感"
                      className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30"
                    />
                  </label>

                  <label className="block space-y-2 text-sm">
                    <span className="font-medium text-foreground">合集说明</span>
                    <textarea
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder="可选，说明这个合集的收录标准。"
                      className="min-h-[84px] w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground/30 sm:min-h-[96px]"
                    />
                  </label>

                  <label className="block space-y-2 text-sm">
                    <span className="font-medium text-foreground">可见性</span>
                    <select
                      value={draftVisibility}
                      onChange={(event) => {
                        const nextVisibility = event.target.value === "PUBLIC" ? "PUBLIC" : "PRIVATE"
                        setDraftVisibility(nextVisibility)
                        if (nextVisibility === "PRIVATE") {
                          setDraftAllowOtherUsersToContribute(false)
                          setDraftRequireContributionApproval(false)
                        }
                      }}
                      className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30"
                    >
                      <option value="PRIVATE">私有，仅自己可见和使用</option>
                      <option value="PUBLIC">公开，其他用户可见</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-secondary/10 px-4 py-3 text-sm">
                    <span>允许其他用户投稿</span>
                    <input
                      type="checkbox"
                      checked={publicCreateEnabled && draftAllowOtherUsersToContribute}
                      disabled={!publicCreateEnabled}
                      onChange={(event) => setDraftAllowOtherUsersToContribute(event.target.checked)}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-secondary/10 px-4 py-3 text-sm">
                    <span>其他用户投稿需要审核</span>
                    <input
                      type="checkbox"
                      checked={publicCreateEnabled && draftAllowOtherUsersToContribute && draftRequireContributionApproval}
                      disabled={!publicCreateEnabled || !draftAllowOtherUsersToContribute}
                      onChange={(event) => setDraftRequireContributionApproval(event.target.checked)}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" disabled={isPending || !draftTitle.trim()} onClick={createAndAdd}>
                      {isPending ? "提交中..." : "创建并加入"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={isPending} onClick={resetCreateDraft}>
                      清空
                    </Button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </DialogPanel>
        </DialogPositioner>
      </div>
    </DialogPortal>
  )
}
