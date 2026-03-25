"use client"

import Image from "next/image"
import Link from "next/link"

import type { SelfServeAdItem } from "@/lib/self-serve-ads.shared"


type SelfServeAdsSidebarPanelData = {
  title: string
  pointName: string
  placeholderLabel: string
  imageSlots: SelfServeAdItem[]
  textSlots: SelfServeAdItem[]
  prices: {
    IMAGE: Record<1 | 3 | 6 | 12, number>
    TEXT: Record<1 | 3 | 6 | 12, number>
  }
}

interface SelfServeAdsSidebarProps {
  AppId: string
  config: Record<string, boolean | number | string>
  panelData: unknown
}

function isSidebarPanelData(value: unknown): value is SelfServeAdsSidebarPanelData {
  if (!value || typeof value !== "object") return false
  const payload = value as Record<string, unknown>
  return typeof payload.title === "string"
    && typeof payload.pointName === "string"
    && typeof payload.placeholderLabel === "string"
    && Array.isArray(payload.imageSlots)
    && Array.isArray(payload.textSlots)
    && !!payload.prices
}

function buildPurchaseHref(slotType: "IMAGE" | "TEXT", slotIndex: number) {
  return `/funs/self-serve-ads/purchase?slotType=${slotType}&slotIndex=${slotIndex}`
}

export function SelfServeAdsSidebar({ panelData }: SelfServeAdsSidebarProps) {
  const resolvedPanelData = isSidebarPanelData(panelData) ? panelData : null
  if (!resolvedPanelData) return null

  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{resolvedPanelData.title}</h3>
        </div>
        <Link href="/funs/self-serve-ads" className="shrink-0 text-[11px] text-muted-foreground transition hover:text-foreground">说明</Link>
      </div>

      <div className="space-y-2">
        {resolvedPanelData.imageSlots.map((item) => item.isPlaceholder ? (
          <Link key={item.id} href={buildPurchaseHref("IMAGE", item.slotIndex)} className="flex h-[52px] w-full items-center justify-center rounded-[16px] border border-dashed border-border bg-background text-xs font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
            购买图片广告位
          </Link>
        ) : (
          <a key={item.id} href={item.linkUrl ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[16px] border border-border bg-background transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
            <div className="h-[58px] w-full bg-muted/20">
              {item.imageUrl ? <Image src={item.imageUrl} alt={`图片广告位 ${item.slotIndex + 1}`} width={320} height={58} unoptimized className="h-[58px] w-full object-cover" /> : null}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {resolvedPanelData.textSlots.map((item) => item.isPlaceholder ? (
          <Link key={item.id} href={buildPurchaseHref("TEXT", item.slotIndex)} className="flex h-11 items-center justify-center rounded-[12px] border border-dashed border-border bg-background px-3 text-[11px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
            购买广告位
          </Link>
        ) : (
          <a key={item.id} href={item.linkUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate rounded-[12px] px-3 py-2 text-center text-[11px] font-medium transition hover:opacity-90" style={{ color: item.textColor ?? "#0f172a", backgroundColor: item.backgroundColor ?? "#f8fafc" }}>
            {item.title}
          </a>
        ))}
      </div>
    </section>
  )
}
