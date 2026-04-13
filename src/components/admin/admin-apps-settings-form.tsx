"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { SettingsInputField, SettingsSection } from "@/components/admin/admin-settings-fields"
import { IconPicker } from "@/components/ui/icon-picker"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import { HEADER_APP_ICON_OPTIONS, type SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"


interface AdminAppsSettingsFormProps {
  initialLinks: SiteHeaderAppLinkItem[]
  initialIconName: string
}

function createEmptyAppLink(index: number): SiteHeaderAppLinkItem {
  return {
    id: `app-link-${index + 1}`,
    name: "",
    href: "",
    icon: "⭐",
  }
}


export function AdminAppsSettingsForm({ initialLinks, initialIconName }: AdminAppsSettingsFormProps) {
  const router = useRouter()
  const [headerAppIconName, setHeaderAppIconName] = useState(initialIconName)
  const [links, setLinks] = useState<SiteHeaderAppLinkItem[]>(initialLinks.length > 0 ? initialLinks : [createEmptyAppLink(0)])
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const normalizedPreview = useMemo(
    () => links.map((item) => ({ ...item, name: item.name.trim(), href: item.href.trim() })).filter((item) => item.name || item.href),
    [links],
  )

  function updateLink(index: number, key: "name" | "href" | "icon", value: string) {

    setLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function addLink() {
    setLinks((current) => [...current, createEmptyAppLink(current.length)])
  }

  function removeLink(index: number) {
    setLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyAppLink(0)]
    })
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            section: "site-apps",
            headerAppIconName,
            headerAppLinks: links,
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <SettingsSection
        title="PC 搜索框应用入口"
        description="配置 PC 端搜索框左侧应用图标及下拉菜单项。支持站内路径与完整外链，前台会自动读取并展示。"
      >

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium">触发图标</span>
            <Select value={headerAppIconName} onValueChange={setHeaderAppIconName}>
              <SelectTrigger className="h-11 rounded-xl bg-background px-4 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              {HEADER_APP_ICON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="space-y-3">
          {links.map((item, index) => (
            <div key={`${item.id}-${index}`} className="rounded-2xl bg-muted/35 p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] xl:items-start">
                <div className="space-y-2">
                  <IconPicker
                    label="图标"
                    value={item.icon}
                    onChange={(value) => updateLink(index, "icon", value)}
                    popoverTitle="选择应用图标"
                    containerClassName="space-y-2"
                    triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                    textareaRows={5}
                    description="支持 emoji、符号，或粘贴完整 SVG。前台应用菜单会直接复用这里的图标。"
                  />
                </div>
                <SettingsInputField label="显示名称" value={item.name} onChange={(value) => updateLink(index, "name", value)} placeholder="如 帮助中心" />
                <SettingsInputField label="跳转地址" value={item.href} onChange={(value) => updateLink(index, "href", value)} placeholder="如 /help 或 https://example.com/help" />
                <div className="flex items-end justify-between gap-3 xl:block xl:pt-7">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-foreground/80">
                    <LevelIcon icon={item.icon} className="h-5 w-5 text-base" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name || "应用图标预览"} />
                  </div>
                  <Button type="button" variant="outline" onClick={() => removeLink(index)} className="rounded-full">删除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>


        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={addLink} className="rounded-full">新增应用</Button>
        </div>

        <div className="rounded-[20px] bg-muted/40 p-4">
          <p className="text-xs font-medium text-foreground">菜单预览</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {normalizedPreview.length > 0 ? normalizedPreview.map((item) => (
              <div key={`${item.id}-${item.name}-${item.href}`} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <LevelIcon icon={item.icon} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name || "应用图标预览"} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.name || "未命名应用"}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{item.href || "未配置链接"}</div>
                </div>
              </div>
            )) : <span className="text-sm text-muted-foreground">暂无可展示应用</span>}

          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存应用入口"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}
