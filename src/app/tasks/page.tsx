import { redirect } from "next/navigation"

import { getHomeAnnouncements } from "@/lib/announcements"
import { getBoards } from "@/lib/boards"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { TaskCenterPage } from "@/components/tasks/task-center-page"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { getTaskCenterPageData } from "@/lib/task-center-page"
import { getZones } from "@/lib/zones"

export default async function TasksPage() {
  const settingsPromise = getSiteSettings()
  const currentUserPromise = getCurrentUser()
  const [currentUser, data, boards, zones, settings, hotTopics, announcements] = await Promise.all([
    currentUserPromise,
    getTaskCenterPageData(),
    getBoards(),
    getZones(),
    settingsPromise,
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])
  if (!currentUser) {
    redirect("/login?redirect=/tasks")
  }

  if (!data) {
    redirect("/login?redirect=/tasks")
  }

  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="py-1 pb-12 mt-6">
              <TaskCenterPage data={data} />
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                createPostHref="/write"
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteLogoPath={settings.siteLogoPath}
                siteIconPath={settings.siteIconPath}
              />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
