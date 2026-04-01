"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { BuiltinCaptchaField } from "@/components/builtin-captcha-field"
import { PowCaptchaField } from "@/components/pow-captcha-field"
import { TurnstileCaptchaField } from "@/components/turnstile-captcha-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { SiteSettingsData } from "@/lib/site-settings"

interface LoginFormProps {
  settings: SiteSettingsData
}

export function LoginForm({ settings }: LoginFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [powNonce, setPowNonce] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const captchaMode = settings.loginCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"
  const usePowCaptcha = captchaMode === "POW"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    if ((useTurnstile || useBuiltinCaptcha || usePowCaptcha) && !captchaToken) {
      setMessage("请先完成验证码验证")
      setLoading(false)
      return
    }

    if (useBuiltinCaptcha && !builtinCaptchaCode.trim()) {
      setMessage("请输入图形验证码")
      setLoading(false)
      return
    }

    if (usePowCaptcha && !powNonce) {
      setMessage("请先完成工作量证明验证")
      setLoading(false)
      return
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, captchaToken, builtinCaptchaCode, powNonce }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "登录失败"
      setMessage(errorMessage)
      toast.error(errorMessage, "登录失败")
      setLoading(false)
      return
    }

    const successMessage = "登录成功，正在跳转到首页…"
    setMessage(successMessage)
    toast.success(successMessage, "登录成功")
    router.push("/")
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">用户名</p>
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入用户名"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">密码</p>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入密码"
          />
        </div>

        {useTurnstile && settings.turnstileSiteKey ? <TurnstileCaptchaField siteKey={settings.turnstileSiteKey} description="使用 Cloudflare Turnstile 防止机器人撞库登录。" onTokenChange={setCaptchaToken} /> : null}

        {useBuiltinCaptcha ? <BuiltinCaptchaField code={builtinCaptchaCode} onCodeChange={setBuiltinCaptchaCode} onTokenChange={setCaptchaToken} onLoadError={setMessage} /> : null}

        {usePowCaptcha ? <PowCaptchaField scope="login" onTokenChange={setCaptchaToken} onNonceChange={setPowNonce} onLoadError={setMessage} /> : null}

        <Button className="w-full" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </Button>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </>
  )
}
