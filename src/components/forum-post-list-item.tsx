import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"
import { getPostPinTone, getPostTitleClassName, PostMinViewLevelBadge, PostRedPacketIcon } from "@/components/post-list-shared"

import { MessageCircle } from "lucide-react"



import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { cn } from "@/lib/utils"
import { getPostPath } from "@/lib/post-links"

interface ForumPostListItemProps {
  item: {
    id: string
    slug: string
    title: string
    typeLabel: string
    type?: string
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    minViewLevel?: number
    isFeatured: boolean


    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorAvatarPath?: string | null
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorNameClassName?: string
    authorDisplayedBadges?: Array<{
      id: string
      name: string
      color: string
      iconText?: string | null
    }>
    metaPrimary: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }
  showBoard?: boolean
  compactFirstItem?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function ForumPostListItem({ item, showBoard = true, compactFirstItem = false, postLinkDisplayMode = "SLUG" }: ForumPostListItemProps) {

  const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"
  const pinTone = getPostPinTone(item.pinScope)

  return (
    <div className={cn(
      compactFirstItem ? "flex gap-3 border-b pb-3 last:border-b-0 sm:gap-4" : "flex gap-3 border-b py-3 last:border-b-0 sm:gap-4",
      "rounded-xl px-2 transition-all duration-150 hover:bg-accent hover:shadow-sm sm:px-3",
    )}>
      <Link href={`/users/${item.authorUsername}`} className={cn("flex-shrink-0", isRestrictedAuthor && "grayscale")}>
        <UserAvatar name={item.authorName} avatarPath={item.authorAvatarPath} size="lg" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link href={getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode })} className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className={getPostTitleClassName({ isFeatured: item.isFeatured, pinScope: item.pinScope })}>
                {item.title}
              </h2>
              {item.hasRedPacket ? (
                <span title="红包帖">
                  <PostRedPacketIcon />
                </span>
              ) : null}
              <PostMinViewLevelBadge minViewLevel={item.minViewLevel} />
            </div>
          </Link>

          {item.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground sm:px-2.5 sm:py-1 sm:text-xs">{item.typeLabel}</span> : null}
          {item.pinLabel && pinTone ? <span className={pinTone.badgeClassName}>{item.pinLabel}</span> : null}
          {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:px-2.5 sm:py-1 sm:text-xs">精华</span> : null}
          <Link href={{ pathname: getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode }), hash: "comments" }} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-normal transition-colors hover:opacity-90 sm:px-2.5 sm:py-1 sm:text-xs" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>



            <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {item.commentCount}
          </Link>
        </div>

        <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:gap-2 sm:text-xs", isRestrictedAuthor && "grayscale")}>
          {showBoard && item.boardSlug ? (
            <>
              <Link href={`/boards/${item.boardSlug}`} className="flex items-center gap-1 font-semibold hover:underline">
                <LevelIcon icon={item.boardIcon} className="h-3 w-3 text-sm sm:h-3.5 sm:w-3.5" svgClassName="[&>svg]:block" />
                <span>{item.boardName}</span>
              </Link>

              <span>•</span>
            </>
          ) : null}
          <Link href={`/users/${item.authorUsername}`} className={item.authorNameClassName ?? "hover:underline"}>
            {item.authorName}
          </Link>
          {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
          <span>•</span>
          <span>{item.metaPrimary}</span>
          {item.metaSecondary ? (
            <>
              <span>•</span>
              <span>{item.metaSecondary}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
