"use client"

import Script from "next/script"
import { useEffect, useRef } from "react"

interface TurnstileCaptchaFieldProps {
  siteKey: string
  description: string
  onTokenChange: (value: string) => void
}

export function TurnstileCaptchaField({ siteKey, description, onTokenChange }: TurnstileCaptchaFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hasRenderedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!siteKey || !window.turnstile || !container || hasRenderedRef.current) {
      return
    }

    window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
      theme: "auto",
    })
    hasRenderedRef.current = true
  }, [onTokenChange, siteKey])

  return (
    <div className="space-y-2 rounded-[24px] border border-border p-4">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <p className="text-sm font-medium">验证码</p>
      <div ref={containerRef} className="min-h-[65px]" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
