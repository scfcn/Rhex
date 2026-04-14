"use client"

import type { ReactNode } from "react"
import { useLayoutEffect, useSyncExternalStore } from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

import {
  DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemeLocalSettingsSnapshot,
  subscribeThemeSettings,
  type ThemePreference,
} from "@/lib/theme"

function readThemeHydrationSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  return readThemeLocalSettingsSnapshot()
}

function ThemeAppearanceSync() {
  const { theme, resolvedTheme } = useTheme()
  const settings = useSyncExternalStore(
    subscribeThemeSettings,
    readThemeLocalSettingsSnapshot,
    readThemeHydrationSnapshot,
  )

  useLayoutEffect(() => {
    if (theme !== "dark" && theme !== "light" && theme !== "system") {
      return
    }

    const themePreference: ThemePreference = theme
    applyTheme(themePreference, settings.preset, settings.fontSizePreset)
  }, [resolvedTheme, settings.customThemeConfig, settings.fontSizePreset, settings.preset, theme])

  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeAppearanceSync />
      {children}
    </NextThemesProvider>
  )
}
