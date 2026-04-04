"use client"

import { useState } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_CUSTOM_THEME_CONFIG,
  FONT_SIZE_PRESET_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredCustomThemeConfig,
  resetCustomThemeConfig,
  resolveStoredCustomThemeConfig,
  resolveStoredFontSizePreset,
  resolveStoredThemePreference,
  saveCustomThemeConfig,
  setStoredThemePreset,
  type CustomThemeConfig,
} from "@/lib/theme"

interface CustomThemeModalProps {
  open: boolean
  onClose: () => void
}

export function CustomThemeModal({ open, onClose }: CustomThemeModalProps) {
  const initialDraft = open ? readStoredCustomThemeConfig() : DEFAULT_CUSTOM_THEME_CONFIG

  return <CustomThemeModalContent key={open ? "open" : "closed"} open={open} onClose={onClose} initialDraft={initialDraft} />
}

function CustomThemeModalContent({
  open,
  onClose,
  initialDraft,
}: CustomThemeModalProps & {
  initialDraft: CustomThemeConfig
}) {
  const [draft, setDraft] = useState<CustomThemeConfig>(initialDraft)

  function updateModeColor(mode: "light" | "dark", field: keyof CustomThemeConfig["light"], value: string) {
    setDraft((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [field]: value,
      },
    }))
  }

  function handleResetDraft() {
    setDraft(DEFAULT_CUSTOM_THEME_CONFIG)
  }

  function handleDisableCustomTheme() {
    if (typeof window === "undefined") {
      onClose()
      return
    }

    const preference = resolveStoredThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
    const fontSizePreset = resolveStoredFontSizePreset(window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY))

    setStoredThemePreset("default")
    applyTheme(preference, "default", fontSizePreset)
    onClose()
  }

  function handleSave() {
    if (typeof window === "undefined") {
      onClose()
      return
    }

    const normalizedDraft = resolveStoredCustomThemeConfig(draft)
    const preference = resolveStoredThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
    const fontSizePreset = resolveStoredFontSizePreset(window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY))

    saveCustomThemeConfig(normalizedDraft)
    setStoredThemePreset("custom")
    applyTheme(preference, "custom", fontSizePreset)
    onClose()
  }

  function handleRestoreSavedDefault() {
    resetCustomThemeConfig()
    setDraft(DEFAULT_CUSTOM_THEME_CONFIG)
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="自定义主题"
      description="只保存在当前浏览器本地。保存后会自动切换到自定义主题，你仍然可以随时切回官方预设。"
      size="lg"
      footer={(
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
            <Button type="button" variant="ghost" className="h-9 w-full px-4 text-sm md:w-auto" onClick={handleDisableCustomTheme}>
              停用自定义主题
            </Button>
            <Button type="button" variant="outline" className="h-9 w-full px-4 text-sm md:w-auto" onClick={handleRestoreSavedDefault}>
              恢复默认主题稿
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
            <Button type="button" variant="ghost" className="h-9 w-full px-4 text-sm md:w-auto" onClick={onClose}>
              取消
            </Button>
            <Button type="button" className="h-9 w-full px-4 text-sm md:w-auto" onClick={handleSave}>
              保存并应用
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-[20px] border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
          <p>说明 1：这里只影响当前浏览器，不会同步到账号或服务器。</p>
          <p className="mt-1">说明 2：浅色模式和深色模式分别配置，跟随系统时会自动切换对应方案。</p>
          <p className="mt-1">说明 3：建议优先调整主色、背景、卡片和交互底色，边框颜色用于细节微调。</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeModeCard
            title="浅色模式"
            modeKey="light"
            values={draft.light}
            onChange={updateModeColor}
          />
          <ThemeModeCard
            title="深色模式"
            modeKey="dark"
            values={draft.dark}
            onChange={updateModeColor}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="h-9 w-full px-4 text-sm sm:w-auto" onClick={handleResetDraft}>
            重置当前编辑
          </Button>
        </div>
      </div>
    </AdminModal>
  )
}

function ThemeModeCard({
  title,
  modeKey,
  values,
  onChange,
}: {
  title: string
  modeKey: "light" | "dark"
  values: CustomThemeConfig["light"]
  onChange: (mode: "light" | "dark", field: keyof CustomThemeConfig["light"], value: string) => void
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-[22px] border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">建议先从主色和背景开始调，再微调卡片、交互底色和边框。</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="主色" value={values.primary} onChange={(value) => onChange(modeKey, "primary", value)} />
        <ColorField label="页面背景" value={values.background} onChange={(value) => onChange(modeKey, "background", value)} />
        <ColorField label="卡片背景" value={values.card} onChange={(value) => onChange(modeKey, "card", value)} />
        <ColorField label="交互底色" value={values.accent} onChange={(value) => onChange(modeKey, "accent", value)} />
        <ColorField label="边框颜色" value={values.border} onChange={(value) => onChange(modeKey, "border", value)} />
      </div>
    </section>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="min-w-0 space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-border bg-background px-3 py-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 min-w-0 w-full rounded-full border border-border bg-card px-3 text-sm outline-none"
          placeholder="#3b82f6"
        />
      </div>
    </label>
  )
}
