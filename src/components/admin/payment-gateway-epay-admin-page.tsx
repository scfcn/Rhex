"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { PaymentGatewayAdminData } from "@/lib/payment-gateway.types"

interface PaymentGatewayEpayAdminPageProps {
  initialData: PaymentGatewayAdminData
}

export function PaymentGatewayEpayAdminPage({ initialData }: PaymentGatewayEpayAdminPageProps) {
  const [data, setData] = useState(initialData)
  const [apiBaseUrl, setApiBaseUrl] = useState(initialData.config.epay.apiBaseUrl)
  const [pid, setPid] = useState(initialData.config.epay.pid)
  const [returnPath, setReturnPath] = useState(initialData.config.epay.returnPath)
  const [notifyPath, setNotifyPath] = useState(initialData.config.epay.notifyPath)
  const [key, setKey] = useState("")
  const [clearKey, setClearKey] = useState(false)

  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  function syncDraftFromData(nextData: PaymentGatewayAdminData) {
    setData(nextData)
    setApiBaseUrl(nextData.config.epay.apiBaseUrl)
    setPid(nextData.config.epay.pid)
    setReturnPath(nextData.config.epay.returnPath)
    setNotifyPath(nextData.config.epay.notifyPath)
    setKey("")
    setClearKey(false)
  }

  function buildPayload() {
    return {
      config: {
        epay: {
          apiBaseUrl,
          pid,
          returnPath,
          notifyPath,
        },
      },
      secret: {
        key,
        clearKey,
      },
    }
  }

  function saveConfig() {
    setFeedback("")

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment-gateway/epay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload()),
        })
        const result = await response.json()

        if (!response.ok || !result?.data) {
          throw new Error(result?.message ?? "码支付配置保存失败")
        }

        syncDraftFromData(result.data as PaymentGatewayAdminData)
        setFeedback(result?.message ?? "配置已保存")
        toast.success(result?.message ?? "码支付配置已保存", "保存成功")
      } catch (error) {
        const message = error instanceof Error ? error.message : "码支付配置保存失败"
        setFeedback(message)
        toast.error(message, "保存失败")
      }
    })
  }

  const runtimeReady = Boolean(data.config.epay.keyConfigured && data.config.epay.pid)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>码支付接口配置</CardTitle>
            <Link href="/admin/apps/payment-gateway" className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              返回网关基础页
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">当前提供方</p>
            <p className="mt-2 text-base font-semibold">码支付</p>
            <p className="mt-1 text-sm text-muted-foreground">基于易支付网关，聚合支付宝、微信、QQ 钱包。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">接口地址</p>
            <p className="mt-2 truncate text-base font-semibold">{apiBaseUrl || "未配置"}</p>
            <p className="mt-1 text-sm text-muted-foreground">易支付 API 基础地址。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">运行态</p>
            <p className="mt-2 text-base font-semibold">{runtimeReady ? "可用" : "未完成"}</p>
            <p className="mt-1 text-sm text-muted-foreground">是否已配置商户 ID 与商户密钥。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>基础参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="API 基础地址" value={apiBaseUrl} onChange={setApiBaseUrl} placeholder="https://pay.rliyun.cn" />
            <TextField label="商户 ID（pid）" value={pid} onChange={setPid} placeholder="1001" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="支付完成返回地址" value={returnPath} onChange={setReturnPath} placeholder="/topup/result" />
            <TextField label="异步通知路径" value={notifyPath} onChange={setNotifyPath} placeholder="/api/payments/notify/epay" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>敏感配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  商户密钥 {data.config.epay.keyConfigured ? "（已配置）" : "（未配置）"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  用于 MD5 签名的商户密钥，与易支付后台一致。留空则保持当前值。
                </p>
              </div>
            </div>
            <div className="mt-3">
              <TextField
                label="商户密钥"
                value={key}
                onChange={setKey}
                placeholder="留空则保留当前值"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(event) => setClearKey(event.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                保存时清空当前密钥
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={saveConfig} disabled={isPending}>{isPending ? "保存中..." : "保存码支付配置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </div>
  )
}
