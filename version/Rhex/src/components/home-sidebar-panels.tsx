import Link from "next/link"
import { Flame, Link2 } from "lucide-react"

import { HomeAnnouncementPanel } from "@/components/home-announcement-panel"
import { SidebarUserCard, type SidebarUserCardData } from "@/components/sidebar-user-card"
import { UserAvatar } from "@/components/user-avatar"
import type { AnnouncementItem } from "@/lib/announcements"
import type { FriendLinkItem } from "@/lib/friend-links"
import type { HomeSidebarPanelItem } from "@/lib/home-sidebar-layout"

interface HotTopicItem {
  id: string
  slug: string
  title: string
  lastReplyAuthorName: string | null
  lastRepliedAt: string
  authorName: string
  authorAvatarPath?: string | null
}

interface HomeSidebarPanelsProps {
  user: SidebarUserCardData | null
  hotTopics: HotTopicItem[]
  announcements?: AnnouncementItem[]
  friendLinks?: FriendLinkItem[]
  friendLinksEnabled?: boolean
  createPostHref?: string
  topPanels?: HomeSidebarPanelItem[]
  middlePanels?: HomeSidebarPanelItem[]
  bottomPanels?: HomeSidebarPanelItem[]
}

export function HomeSidebarPanels({ user, hotTopics, announcements = [], friendLinks = [], friendLinksEnabled = false, createPostHref, topPanels = [], middlePanels = [], bottomPanels = [] }: HomeSidebarPanelsProps) {
  return (
    <div className="sticky top-20 space-y-4">
      <SidebarUserCard user={user} createPostHref={createPostHref} />

      {topPanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      <HomeAnnouncementPanel announcements={announcements} />

      <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500 dark:text-orange-400" />
          <h3 className="font-semibold">今日热帖</h3>
        </div>
        <div className="space-y-2">
          {hotTopics.map((topic) => (
            <Link key={topic.id} href={`/posts/${topic.slug}`} className="-mx-1.5 flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/70">
              <UserAvatar name={topic.authorName} avatarPath={topic.authorAvatarPath} size="sm" />
              <div className="min-w-0 flex-1">
                <div title={topic.title} className="truncate whitespace-nowrap text-sm leading-snug">{topic.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">最后回复：{topic.lastReplyAuthorName ?? topic.authorName} · {topic.lastRepliedAt}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>


      {middlePanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {friendLinksEnabled ? (

        <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-sky-500" />
              <div>
                <h3 className="font-semibold">友情链接</h3>
              </div>
            </div>
            <Link href="/link" className="text-xs text-muted-foreground transition hover:text-foreground">全部链接</Link>
          </div>
          {friendLinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {friendLinks.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="truncate rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" title={link.name}>
                  {link.name}
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">
              当前还没有已通过的友情链接，审核通过后会显示在这里。
            </div>
          )}
        </section>
      ) : null}

      {bottomPanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}
    </div>
  )
}
