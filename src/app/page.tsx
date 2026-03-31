import type { Metadata } from "next"

import { ForumFeedList } from "@/components/forum-feed-list"
import { ForumPageShell } from "@/components/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"

import { getFriendLinkListData } from "@/lib/friend-links"
import { type FeedSort, getLatestFeed } from "@/lib/forum-feed"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
import { groupHomeSidebarPanels } from "@/lib/home-sidebar-layout"
import { getSiteSettings } from "@/lib/site-settings"

import { getSelfServeAdsAppConfig, getSelfServeAdsPanelData } from "@/lib/self-serve-ads"
import { toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { getZones } from "@/lib/zones"






interface HomePageProps {
  searchParams?: {
    page?: string
    sort?: string
  }
}

function normalizeSort(sort?: string): FeedSort {
  if (sort === "new" || sort === "hot") {
    return sort
  }

  return "latest"
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${settings.siteName} - 首页`,
    description: settings.siteDescription,
    openGraph: {
      title: `${settings.siteName} - 首页`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const currentPage = Number(searchParams?.page ?? "1") || 1
  const currentSort = normalizeSort(searchParams?.sort)
  const [feed, boards, zones, currentUser, hotTopics, announcements, settings, friendLinks, selfServeAdsConfig, selfServeAdsPanelData] = await Promise.all([
    getLatestFeed(currentPage, 35, currentSort),
    getBoards(),
    getZones(),
    getCurrentUser(),
    getHomeSidebarHotTopics(5),
    getHomeAnnouncements(3),
    getSiteSettings(),
    getFriendLinkListData(),
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
  ])





  const nextPage = currentPage + 1
  const prevPage = Math.max(1, currentPage - 1)
  const selfServeAdsResolvedConfig = toSelfServeAdConfig(selfServeAdsConfig)
  const [sidebarUser, sidebarStats] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    settings.homeSidebarStatsCardEnabled ? getHomeSidebarStats() : Promise.resolve(null),
  ])
  const sidebarPanels = groupHomeSidebarPanels(
    selfServeAdsPanelData && selfServeAdsResolvedConfig.enabled && selfServeAdsResolvedConfig.visibleOnHome
      ? [{

          id: "self-serve-ads",
          slot: selfServeAdsResolvedConfig.sidebarSlot,
          order: selfServeAdsResolvedConfig.sidebarOrder,
          content: <SelfServeAdsSidebar AppId="self-serve-ads" config={selfServeAdsConfig} panelData={selfServeAdsPanelData} />,
        }]
      : [],
  )

  return (


    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-4">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <div className="pb-12 py-1">
              <ForumFeedList items={feed} currentSort={currentSort} listDisplayMode={settings.homeFeedPostListDisplayMode} postLinkDisplayMode={settings.postLinkDisplayMode} />

              {feed.length === 0 ? <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">当前排序下还没有可展示的帖子内容。</div> : null}

              <nav className="mx-auto flex w-full justify-center py-4" aria-label="pagination">
                <ul className="flex flex-row items-center gap-1">
                  <li>
                    <a href={`/?sort=${currentSort}&page=${prevPage}`} aria-disabled={currentPage <= 1} className={currentPage <= 1 ? "pointer-events-none inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium opacity-50 sm:pl-2.5" : "inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent sm:pl-2.5"}>
                      <span className="hidden sm:block">上一页</span>
                    </a>
                  </li>
                  <li>
                    <span className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-sm font-medium">{currentPage}</span>
                  </li>
                  <li>
                    <a href={`/?sort=${currentSort}&page=${nextPage}`} className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent sm:pr-2.5">
                      <span className="hidden sm:block">下一页</span>
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                postLinkDisplayMode={settings.postLinkDisplayMode}
                announcements={announcements}
                friendLinks={friendLinks.compact}
              friendLinksEnabled={settings.friendLinksEnabled}
              topPanels={sidebarPanels.top}
              middlePanels={sidebarPanels.middle}
              bottomPanels={sidebarPanels.bottom}
              stats={sidebarStats}
              siteName={settings.siteName}
              siteDescription={settings.siteDescription}
            />
            </div>
          )}
        />
      </div>
    </div>
  )
}



