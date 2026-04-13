"use client"

import Link from "next/link"

interface SelfServeAdsIntroPageProps {
  AppId: string
}

export function SelfServeAdsIntroPage({ AppId }: SelfServeAdsIntroPageProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-border bg-card p-6 shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">自助推广广告位</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">支持图片广告和文字广告购买，提交后进入后台审核；审核不通过不退款。</p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">返回首页查看广告位</Link>
        </div>
      </div>

      <div className="rounded-[24px] border border-dashed border-border bg-card px-5 py-6 text-sm leading-7 text-muted-foreground">
        请从首页右侧广告位点击“购买”进入对应类型和槽位的购买页面。
      </div>

      <div className="text-xs text-muted-foreground">应用标识：{AppId}</div>
    </section>
  )
}
