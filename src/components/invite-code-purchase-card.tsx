"use client"

import { useState } from "react"

import { Button } from "@/components/ui/rbutton"
import { formatNumber } from "@/lib/formatters"



interface InviteCodePurchaseCardProps {
  enabled: boolean
  price: number
  priceDescription?: string
  pointName: string
}

export function InviteCodePurchaseCard({ enabled, price, priceDescription, pointName }: InviteCodePurchaseCardProps) {
  const [loading, setLoading] = useState(false)
  const [latestCode, setLatestCode] = useState("")


  async function handlePurchase() {
    setLoading(true)
    setLatestCode("")


    const response = await fetch("/api/invite-codes/purchase", {
      method: "POST",
    })
    const result = await response.json()

    if (!response.ok) {
      setLoading(false)
      return
    }

    setLatestCode(result.data?.code ?? "")

    setLoading(false)
  }

  if (!enabled) {
    return null
  }

  return (
    <div className="rounded-[24px] border border-border px-4 py-4 space-y-3">
      <div>
        <p className="font-medium">购买邀请码</p>
        <p className="mt-1 text-sm text-muted-foreground">每个邀请码售价 {formatNumber(price)} {pointName}，购买后可分享给好友注册使用。</p>
        {priceDescription ? <p className="mt-1 text-xs text-muted-foreground">{priceDescription}</p> : null}
      </div>
      <Button type="button" onClick={handlePurchase} disabled={loading}>{loading ? "购买中..." : `花费 ${formatNumber(price)} ${pointName} 购买邀请码`}</Button>
      {latestCode ? <p className="text-sm">最新邀请码：<span className="font-mono font-semibold">{latestCode}</span></p> : null}

    </div>
  )
}
