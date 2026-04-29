"use client"

import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useLayoutEffect, useSyncExternalStore } from "react"

import {
  DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT,
  applyTheme,
  readThemeLocalSettingsSnapshot,
  resolveStoredThemePreference,
  resolveSystemTheme,
  setStoredThemePreference,
  subscribeThemeSettings,
  type ThemeMode,
  type ThemePreference,
} from "@/lib/theme"

function readThemeHydrationSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  return readThemeLocalSettingsSnapshot()
}

function readSystemThemeSnapshot() {
  if (typeof window === "undefined") {
    return "light" as ThemeMode
  }

  return resolveSystemTheme()
}

function subscribeSystemTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  const handleChange = () => {
    onStoreChange()
  }

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }

  mediaQuery.addListener(handleChange)
  return () => {
    mediaQuery.removeListener(handleChange)
  }
}

interface ThemeContextValue {
  forcedTheme?: string
  resolvedTheme: ThemeMode
  setTheme: Dispatch<SetStateAction<string>>
  systemTheme: ThemeMode
  theme: ThemePreference
  themes: ThemePreference[]
}

const THEME_CONTEXT_FALLBACK: ThemeContextValue = {
  resolvedTheme: "light",
  setTheme: () => undefined,
  systemTheme: "light",
  theme: "light",
  themes: ["light", "dark", "system"],
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  return useContext(ThemeContext) ?? THEME_CONTEXT_FALLBACK
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(
    subscribeThemeSettings,
    readThemeLocalSettingsSnapshot,
    readThemeHydrationSnapshot,
  )
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    readSystemThemeSnapshot,
    () => "light" as ThemeMode,
  )
  const theme = settings.preference
  const resolvedTheme = theme === "system" ? systemTheme : theme

  const setTheme: Dispatch<SetStateAction<string>> = (value) => {
    const nextTheme = typeof value === "function" ? value(theme) : value
    setStoredThemePreference(resolveStoredThemePreference(nextTheme))
  }

  useLayoutEffect(() => {
    applyTheme(theme, settings.preset, settings.fontSizePreset)
  }, [resolvedTheme, settings.customThemeConfig, settings.fontSizePreset, settings.preset, theme])

  return (
    <ThemeContext.Provider
      value={{
        resolvedTheme,
        setTheme,
        systemTheme,
        theme,
        themes: THEME_CONTEXT_FALLBACK.themes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
