import { PostListLink } from "@/components/post-list-link"
import { getPostCommentPath } from "@/lib/post-links"
import type { PostLinkDisplayMode } from "@/lib/site-settings"

interface UserRecentReplyItem {
  id: string | number
  content: string
  createdAt: string
  postId: string | number
  postTitle: string
  postSlug: string
  boardName: string
  likeCount: number
  replyToUsername?: string | null
}

interface UserRecentRepliesListProps {
  replies: UserRecentReplyItem[]
  postLinkDisplayMode: PostLinkDisplayMode
  emptyText?: string
}

export function UserRecentRepliesList({
  replies,
  postLinkDisplayMode,
  emptyText = "最近还没有回复记录。",
}: UserRecentRepliesListProps) {
  if (replies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e8e8e8] px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {replies.map((reply) => {
        const commentPath = getPostCommentPath(
          { id: String(reply.postId), slug: reply.postSlug, title: reply.postTitle },
          String(reply.id),
          { mode: postLinkDisplayMode },
        )

        return (
          <div key={reply.id} className="rounded-[18px] border border-border/80 bg-card px-3.5 py-2.5 transition-colors hover:bg-accent/30">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[13px] leading-5">
                <span className="text-muted-foreground">评论于</span>
                <PostListLink href={commentPath} visitedPath={commentPath} dimWhenRead className="line-clamp-1 font-semibold text-foreground">
                  {reply.postTitle}
                </PostListLink>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                {reply.replyToUsername ? <span>回复 @{reply.replyToUsername}</span> : <span>发表评论</span>}
                <span>{formatDateTime(reply.createdAt)}</span>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{reply.content}</p>
          </div>
        )
      })}
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
