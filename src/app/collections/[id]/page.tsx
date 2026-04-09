import type { Metadata } from "next"

import { FavoriteCollectionDetail } from "@/components/favorite-collection-detail"
import { ForumPageShell } from "@/components/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getFavoriteCollectionDetailPage } from "@/lib/favorite-collections"
import { getFriendLinkListData } from "@/lib/friend-links"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

function parsePage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  const page = Number(rawValue)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ page?: string | string[]; pendingPage?: string | string[] }>
}): Promise<Metadata> {
  const { id } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const [settings, currentUser] = await Promise.all([getSiteSettings(), getCurrentUser()])
  const data = await getFavoriteCollectionDetailPage({
    collectionId: id,
    currentUserId: currentUser?.id,
    page: parsePage(searchParams?.page),
    pendingPage: parsePage(searchParams?.pendingPage),
  })

  return {
    title: `${settings.siteName} - ${data.title}`,
    description: data.description ?? `${data.ownerName} 创建的收藏合集`,
  }
}

export default async function FavoriteCollectionDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ page?: string | string[]; pendingPage?: string | string[] }>
}) {
  const { id } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const currentPage = parsePage(searchParams?.page)
  const currentPendingPage = parsePage(searchParams?.pendingPage)
  const [currentUser, settings, boards, zones] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    getBoards(),
    getZones(),
  ])
  const data = await getFavoriteCollectionDetailPage({
    collectionId: id,
    currentUserId: currentUser?.id,
    page: currentPage,
    pendingPage: currentPendingPage,
  })
  const [sidebarUser, hotTopics, announcements, friendLinks, sidebarStats] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount),
    getHomeAnnouncements(3),
    getFriendLinkListData(),
    settings.homeSidebarStatsCardEnabled ? getHomeSidebarStats() : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <div className="mt-6 pb-12">
              <FavoriteCollectionDetail initialData={data} postLinkDisplayMode={settings.postLinkDisplayMode} />
            </div>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                postLinkDisplayMode={settings.postLinkDisplayMode}
                announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                friendLinks={friendLinks.compact}
                friendLinksEnabled={settings.friendLinksEnabled}
                stats={sidebarStats}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteLogoPath={settings.siteLogoPath}
              />
            </div>
          )}
        />
      </div>
    </div>
  )
}
