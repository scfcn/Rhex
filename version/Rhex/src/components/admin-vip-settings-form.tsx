"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

interface AdminVipSettingsFormProps {
  initialSettings: {
    vipMonthlyPrice: number
    vipQuarterlyPrice: number
    vipYearlyPrice: number
    postOfflinePrice: number
    postOfflineVip1Price: number
    postOfflineVip2Price: number
    postOfflineVip3Price: number
  }

}

export function AdminVipSettingsForm({ initialSettings }: AdminVipSettingsFormProps) {
  const [vipMonthlyPrice, setVipMonthlyPrice] = useState(String(initialSettings.vipMonthlyPrice))
  const [vipQuarterlyPrice, setVipQuarterlyPrice] = useState(String(initialSettings.vipQuarterlyPrice))
  const [vipYearlyPrice, setVipYearlyPrice] = useState(String(initialSettings.vipYearlyPrice))
  const [postOfflinePrice, setPostOfflinePrice] = useState(String(initialSettings.postOfflinePrice))
  const [postOfflineVip1Price, setPostOfflineVip1Price] = useState(String(initialSettings.postOfflineVip1Price))
  const [postOfflineVip2Price, setPostOfflineVip2Price] = useState(String(initialSettings.postOfflineVip2Price))
  const [postOfflineVip3Price, setPostOfflineVip3Price] = useState(String(initialSettings.postOfflineVip3Price))
  const [feedback, setFeedback] = useState("")

  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vipMonthlyPrice: Number(vipMonthlyPrice),
              vipQuarterlyPrice: Number(vipQuarterlyPrice),
              vipYearlyPrice: Number(vipYearlyPrice),
              postOfflinePrice: Number(postOfflinePrice),
              postOfflineVip1Price: Number(postOfflineVip1Price),
              postOfflineVip2Price: Number(postOfflineVip2Price),
              postOfflineVip3Price: Number(postOfflineVip3Price),
              section: "vip",
            }),

          })
          const result = await response.json()
          setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Stat title="月卡价格" value={Number(vipMonthlyPrice) || 0} />
        <Stat title="季卡价格" value={Number(vipQuarterlyPrice) || 0} />
        <Stat title="年卡价格" value={Number(vipYearlyPrice) || 0} />
        <Stat title="普通下线价" value={Number(postOfflinePrice) || 0} />
      </div>


      <div className="rounded-[22px] border border-border bg-card p-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">VIP 套餐配置</h3>
          <p className="mt-1 text-xs text-muted-foreground">统一配置前台可售 VIP 套餐对应的积分价格。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="月卡积分价格（VIP1）" value={vipMonthlyPrice} onChange={setVipMonthlyPrice} placeholder="如 3000" />
          <Field label="季卡积分价格（VIP2）" value={vipQuarterlyPrice} onChange={setVipQuarterlyPrice} placeholder="如 8000" />
          <Field label="年卡积分价格（VIP3）" value={vipYearlyPrice} onChange={setVipYearlyPrice} placeholder="如 30000" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">作者下线帖子价格</h3>
          <p className="mt-1 text-xs text-muted-foreground">0 表示免费；普通用户与 VIP1 / VIP2 / VIP3 按当前身份分别扣除积分。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="普通用户积分价格" value={postOfflinePrice} onChange={setPostOfflinePrice} placeholder="如 50" />
          <Field label="VIP1 积分价格" value={postOfflineVip1Price} onChange={setPostOfflineVip1Price} placeholder="如 30" />
          <Field label="VIP2 积分价格" value={postOfflineVip2Price} onChange={setPostOfflineVip2Price} placeholder="如 20" />
          <Field label="VIP3 积分价格" value={postOfflineVip3Price} onChange={setPostOfflineVip3Price} placeholder="如 0" />
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "保存中..." : "保存VIP设置"}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>

    </form>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}
