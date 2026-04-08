"use client"

import Link from "next/link"
import { MessageSquare, Search, ShieldCheck, ShieldX, Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { AdminPostActionButton } from "@/components/admin-post-action-button"
import type { AdminCommentListResult } from "@/lib/admin-comment-management"
import { formatDateTime } from "@/lib/formatters"
import { getPostCommentPath } from "@/lib/post-links"

interface AdminCommentListProps {
  data: AdminCommentListResult
}

const statusFilters = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待审核" },
  { value: "NORMAL", label: "正常" },
  { value: "HIDDEN", label: "已下线" },
]

const sortFilters = [
  { value: "newest", label: "最新发布" },
  { value: "oldest", label: "最早发布" },
  { value: "mostLikes", label: "点赞最多" },
]

const reviewFilters = [
  { value: "ALL", label: "全部备注" },
  { value: "reviewed", label: "有备注" },
  { value: "unreviewed", label: "无备注" },
]

const typeFilters = [
  { value: "ALL", label: "全部层级" },
  { value: "ROOT", label: "主评论" },
  { value: "REPLY", label: "回复" },
]

const pageSizeOptions = [20, 50, 100]

export function AdminCommentList({ data }: AdminCommentListProps) {
  const baseQuery = new URLSearchParams({
    tab: "comments",
    keyword: data.filters.keyword,
    status: data.filters.status,
    board: data.filters.board,
    sort: data.filters.sort,
    review: data.filters.review,
    type: data.filters.type,
    commentPageSize: String(data.pagination.pageSize),
  })

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("commentPage", String(page))
    return `/admin?${query.toString()}`
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-[22px] border border-border bg-card p-4 xl:grid-cols-[minmax(120px,1.8fr)_120px_140px_120px_120px_100px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索评论</span>
          <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input name="keyword" defaultValue={data.filters.keyword} placeholder="评论内容 / 帖子 / 作者" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <CompactSelect name="status" label="状态" value={data.filters.status} options={statusFilters} />
        <CompactSelect name="board" label="节点" value={data.filters.board} options={[{ value: "", label: "全部节点" }, ...data.boardOptions.map((item) => ({ value: item.slug, label: item.name }))]} />
        <CompactSelect name="sort" label="排序" value={data.filters.sort} options={sortFilters} />
        <CompactSelect name="review" label="备注" value={data.filters.review} options={reviewFilters} />
        <CompactSelect name="type" label="层级" value={data.filters.type} options={typeFilters} />
        <CompactSelect name="commentPageSize" label="每页" value={String(data.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="tab" value="comments" />
          <input type="hidden" name="commentPage" value="1" />
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            筛选
          </button>
          <Link href="/admin?tab=comments" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            重置
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="评论总数" value={data.summary.total} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="待审核" value={data.summary.pending} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="已下线" value={data.summary.hidden} icon={<ShieldX className="h-4 w-4" />} />
        <StatCard label="主评论" value={data.summary.root} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="回复数" value={data.summary.reply} icon={<MessageSquare className="h-4 w-4" />} />
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.6fr)_170px_120px_220px]">
          <span>评论</span>
          <span>帖子 / 作者</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>
        {data.comments.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有评论。</div> : null}
        {data.comments.map((comment) => {
          const commentPath = getPostCommentPath({ id: comment.postId, slug: comment.postSlug }, comment.id)

          return (
            <div key={comment.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.6fr)_170px_120px_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={getCommentStatusBadgeClassName(comment.status)}>{comment.statusLabel}</span>
                  <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">{comment.parentId ? "回复" : "主评论"}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-foreground/90">{comment.content || "无评论内容"}</p>
                {comment.reviewNote ? <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">审核备注：{comment.reviewNote}</p> : null}
                {comment.reviewedAt ? <p className="mt-1 text-[11px] text-muted-foreground">处理时间：{formatDateTime(comment.reviewedAt)}{comment.reviewedByName ? ` · ${comment.reviewedByName}` : ""}</p> : null}
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div className="truncate text-foreground">{comment.postTitle}</div>
                <div className="truncate">{comment.boardName}</div>
                <div className="truncate">{comment.authorName}</div>
                <div className="truncate">{comment.zoneName ?? "未分区"}</div>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div>点赞 {comment.likeCount}</div>
                <div>{comment.parentId ? "回复评论" : "楼层评论"}</div>
                <div className="truncate">{comment.authorUsername}</div>
              </div>

              <div className="flex flex-wrap justify-end gap-1.5">
                <Link href={commentPath} className="inline-flex h-7 items-center justify-center rounded-full border border-border px-2.5 text-xs transition-colors hover:bg-accent hover:text-foreground">
                  前台
                </Link>
                {comment.status === "PENDING" ? (
                  <>
                    <AdminPostActionButton action="comment.approve" targetId={comment.id} label="通过" modalTitle="确认通过评论审核" modalDescription={`帖子：${comment.postTitle}`} placeholder="填写审核备注（可选）" confirmText="确认通过" className="h-7 rounded-full px-2.5 text-xs" />
                    <AdminPostActionButton action="comment.reject" targetId={comment.id} label="驳回" tone="danger" modalTitle="确认驳回评论" modalDescription={`帖子：${comment.postTitle}`} placeholder="填写驳回原因" confirmText="确认驳回" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" />
                  </>
                ) : comment.status === "HIDDEN" ? (
                  <AdminPostActionButton action="comment.show" targetId={comment.id} label="恢复" modalTitle="确认恢复评论" modalDescription={`帖子：${comment.postTitle}`} placeholder="填写恢复说明（可选）" confirmText="确认恢复" className="h-7 rounded-full px-2.5 text-xs" />
                ) : (
                  <AdminPostActionButton action="comment.hide" targetId={comment.id} label="下线" tone="danger" modalTitle="确认下线评论" modalDescription={`帖子：${comment.postTitle}`} placeholder="填写下线原因（可选）" confirmText="确认下线" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" />
                )}
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条评论</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} aria-disabled={!data.pagination.hasPrevPage} className={data.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>
              上一页
            </Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{data.pagination.page}</span>
            <Link href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} aria-disabled={!data.pagination.hasNextPage} className={data.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>
              下一页
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-2.5 text-sm outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function getCommentStatusBadgeClassName(status: AdminCommentListResult["comments"][number]["status"]) {
  if (status === "PENDING") {
    return "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }
  if (status === "HIDDEN") {
    return "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }
  if (status === "DELETED") {
    return "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
  }
  return "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}
