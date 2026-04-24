"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { SettingsInputField, SettingsSection } from "@/components/admin/admin-settings-fields"
import { Button } from "@/components/ui/button"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import type { FooterLinkItem } from "@/lib/site-settings"

interface AdminFooterLinksSettingsFormProps {
  initialLinks: FooterLinkItem[]
}

function createEmptyLink(): FooterLinkItem {
  return { label: "", href: "" }
}

export function AdminFooterLinksSettingsForm({ initialLinks }: AdminFooterLinksSettingsFormProps) {
  const router = useRouter()
  const [links, setLinks] = useState<FooterLinkItem[]>(initialLinks.length > 0 ? initialLinks : [createEmptyLink()])
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const normalizedPreview = useMemo(
    () => links.map((item) => ({ label: item.label.trim(), href: item.href.trim() })).filter((item) => item.label || item.href),
    [links],
  )

  function updateLink(index: number, key: keyof FooterLinkItem, value: string) {
    setLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function addLink() {
    setLinks((current) => [...current, createEmptyLink()])
  }

  function removeLink(index: number) {
    setLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyLink()]
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
            section: "site-footer-links",
            footerLinks: links,
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <SettingsSection
        title="页脚导航链接"
        description="用于控制前台页脚的链接名称与跳转地址。支持站内路径，也支持完整外链地址。"
      >

        <div className="space-y-3">
          {links.map((item, index) => (
            <div key={`footer-link-${index}`} className="grid gap-3 rounded-2xl bg-muted/35 p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
              <SettingsInputField label="显示名称" value={item.label} onChange={(value) => updateLink(index, "label", value)} placeholder="如 关于我们" />
              <SettingsInputField label="跳转地址" value={item.href} onChange={(value) => updateLink(index, "href", value)} placeholder="如 /about 或 https://example.com/about" />
              <Button type="button" variant="outline" onClick={() => removeLink(index)} className="rounded-full">删除</Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={addLink} className="rounded-full">新增链接</Button>
        </div>

        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-medium text-foreground">预览</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {normalizedPreview.length > 0 ? normalizedPreview.map((item) => (
              <span key={`${item.label}-${item.href}`} className="transition-colors hover:text-foreground">{item.label}</span>
            )) : <span>暂无可展示链接</span>}
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存页脚导航"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}
