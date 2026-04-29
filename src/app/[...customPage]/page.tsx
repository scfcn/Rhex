import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getPublishedCustomPageByPath } from "@/lib/custom-pages"
import { resolveCustomPageRoutePathFromSegments, stripCustomPageHtmlToText } from "@/lib/custom-page-types"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

interface CustomPageRouteProps {
  params: Promise<{ customPage: string[] }>
}

export const dynamic = "force-dynamic"

async function getCustomPageRouteData(segments: string[]) {
  const routePath = resolveCustomPageRoutePathFromSegments(segments)
  if (!routePath) {
    return null
  }

  return getPublishedCustomPageByPath(routePath)
}

export async function generateMetadata({ params }: CustomPageRouteProps): Promise<Metadata> {
  const { customPage } = await params
  const routePath = resolveCustomPageRoutePathFromSegments(customPage)
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    routePath ? getPublishedCustomPageByPath(routePath) : Promise.resolve(null),
  ])

  if (!page) {
    return {
      title: settings.siteName,
      description: settings.siteDescription,
    }
  }

  const description = stripCustomPageHtmlToText(page.htmlContent, 120) || settings.siteDescription

  return {
    title: `${page.title} - ${settings.siteName}`,
    description,
    openGraph: {
      title: `${page.title} - ${settings.siteName}`,
      description,
      type: "website",
    },
  }
}

export default async function CustomPageRoute({ params }: CustomPageRouteProps) {
  const { customPage } = await params
  const page = await getCustomPageRouteData(customPage)

  if (!page) {
    notFound()
  }

  const settingsPromise = getSiteSettings()
  const boardsPromise = page.includeLeftSidebar ? getBoards() : Promise.resolve([])
  const zonesPromise = page.includeLeftSidebar ? getZones() : Promise.resolve([])
  const currentUserPromise = page.includeRightSidebar ? getCurrentUser() : Promise.resolve(null)
  const hotTopicsPromise = page.includeRightSidebar
    ? settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount))
    : Promise.resolve([])
  const announcementsPromise = page.includeRightSidebar ? getHomeAnnouncements(3) : Promise.resolve([])

  const [settings, boards, zones, currentUser, hotTopics, announcements] = await Promise.all([
    settingsPromise,
    boardsPromise,
    zonesPromise,
    currentUserPromise,
    hotTopicsPromise,
    announcementsPromise,
  ])

  const sidebarUser = page.includeRightSidebar
    ? await resolveSidebarUser(currentUser, settings)
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {page.includeHeader ? <SiteHeader /> : null}
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          rightSidebar={page.includeRightSidebar ? (
            <div className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteLogoPath={settings.siteLogoPath}
                siteIconPath={settings.siteIconPath}
                stickyTopClass={page.includeHeader ? "top-20" : "top-4"}
              />
            </div>
          ) : null}
          leftSidebarDisplayModeOverride={page.includeLeftSidebar ? undefined : "HIDDEN"}
          sidebarStickyTopClass={page.includeHeader ? "top-14" : "top-4"}
          main={(
            <main className={page.includeHeader ? "py-1 pb-12 mt-6" : "py-3 pb-12"}>
              <div
                className="custom-page-html min-w-0 [&_iframe]:max-w-full [&_img]:max-w-full [&_table]:max-w-full"
                dangerouslySetInnerHTML={{ __html: page.htmlContent }}
              />
            </main>
          )}
        />
      </div>
    </div>
  )
}
