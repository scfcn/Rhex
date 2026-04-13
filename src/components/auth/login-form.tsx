"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react"

import { AuthField, AuthFormSection, AuthInlineMessage } from "@/components/auth/auth-form-primitives"
import { BuiltinCaptchaField } from "@/components/auth/builtin-captcha-field"
import { ExternalAuthEntry } from "@/components/auth/external-auth-entry"
import { PowCaptchaField } from "@/components/auth/pow-captcha-field"
import { TurnstileCaptchaField } from "@/components/auth/turnstile-captcha-field"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
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
  const [showPassword, setShowPassword] = useState(false)

  const captchaMode = settings.loginCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"
  const usePowCaptcha = captchaMode === "POW"
  const hasAlternativeAuth = settings.authGithubEnabled || settings.authGoogleEnabled || settings.authPasskeyEnabled

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AuthFormSection>
        <AuthField htmlFor="login-username" label="用户名" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80">
            <InputGroupAddon>
              <UserRound />
            </InputGroupAddon>
            <InputGroupInput
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="输入用户名"
            />
          </InputGroup>
        </AuthField>

        <AuthField htmlFor="login-password" label="密码" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80">
            <InputGroupAddon>
              <LockKeyhole />
            </InputGroupAddon>
            <InputGroupInput
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </AuthField>
      </AuthFormSection>

      {useTurnstile || useBuiltinCaptcha || usePowCaptcha ? (
        <AuthFormSection>
          {useTurnstile && settings.turnstileSiteKey ? (
            <TurnstileCaptchaField siteKey={settings.turnstileSiteKey} onTokenChange={setCaptchaToken} />
          ) : null}

          {useBuiltinCaptcha ? (
            <BuiltinCaptchaField
              code={builtinCaptchaCode}
              onCodeChange={setBuiltinCaptchaCode}
              onTokenChange={setCaptchaToken}
              onLoadError={setMessage}
            />
          ) : null}

          {usePowCaptcha ? (
            <PowCaptchaField
              scope="login"
              onTokenChange={setCaptchaToken}
              onNonceChange={setPowNonce}
              onLoadError={setMessage}
            />
          ) : null}
        </AuthFormSection>
      ) : null}

      {message ? (
        <AuthInlineMessage tone={message.includes("成功") ? "success" : "destructive"}>
          {message}
        </AuthInlineMessage>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Spinner data-icon="inline-start" />
              登录中...
            </>
          ) : (
            <>
              登录
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>

      {hasAlternativeAuth ? <ExternalAuthEntry settings={settings} mode="login" /> : null}
    </form>
  )
}
