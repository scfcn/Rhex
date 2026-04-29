"use client"

import { useLayoutEffect } from "react"

import { preloadReadingHistorySnapshot } from "@/lib/local-reading-history"
import { resetSidebarNavigationCollapsedPreference } from "@/lib/sidebar-navigation-preference"
import { applyTheme, readThemeLocalSettingsSnapshot } from "@/lib/theme"

export function RootBootstrap() {
  useLayoutEffect(() => {
    try {
      const settings = readThemeLocalSettingsSnapshot()

      applyTheme(settings.preference, settings.preset, settings.fontSizePreset)
      resetSidebarNavigationCollapsedPreference()
      preloadReadingHistorySnapshot()
    } finally {
      document.documentElement.setAttribute("data-root-init", "ready")
    }
  }, [])

  return null
}
