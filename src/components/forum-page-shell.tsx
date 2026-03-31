"use client"

import { useEffect, useState, type ReactNode } from "react"

import { SidebarNavigation } from "@/components/sidebar-navigation"
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/sidebar-navigation-preference"

interface ForumPageShellZoneItem {
  id: string
  slug: string
  name: string
  icon: string
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface ForumPageShellBoardItem {
  id: string
  slug: string
  name: string
  icon: string
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface ForumPageShellProps {
  zones: ForumPageShellZoneItem[]
  boards: ForumPageShellBoardItem[]
  activeZoneSlug?: string
  activeBoardSlug?: string
  main: ReactNode
  rightSidebar: ReactNode
}

export function ForumPageShell({ zones, boards, activeZoneSlug, activeBoardSlug, main, rightSidebar }: ForumPageShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    setSidebarCollapsed(document.documentElement.dataset.sidebarCollapsed === "true")
  }, [])

  function handleToggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0")
      document.documentElement.dataset.sidebarCollapsed = next ? "true" : "false"
      return next
    })
  }

  return (
    <div className="forum-page-shell grid grid-cols-1 gap-6">
      <SidebarNavigation
        zones={zones}
        boards={boards}
        activeZoneSlug={activeZoneSlug}
        activeBoardSlug={activeBoardSlug}
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
      />
      <div className="forum-page-main min-w-0" data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}>{main}</div>
      <div className="forum-page-right-sidebar min-w-0 w-full justify-self-end [&>*]:w-full [&>*]:max-w-full">{rightSidebar}</div>
    </div>
  )
}
