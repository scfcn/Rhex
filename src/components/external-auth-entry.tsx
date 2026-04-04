"use client"

import Link from "next/link"
import { Chrome, Github, KeyRound } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SiteSettingsData } from "@/lib/site-settings"

interface ExternalAuthEntryProps {
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled" | "authPasskeyEnabled">
  mode: "login" | "register"
  className?: string
}

function EntryLink({ href, children, useDocumentNavigation = false }: { href: string; children: React.ReactNode; useDocumentNavigation?: boolean }) {
  const className = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"

  if (useDocumentNavigation) {
    return (
      <a
        href={href}
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {children}
    </Link>
  )
}

export function ExternalAuthEntry({ settings, mode, className }: ExternalAuthEntryProps) {
  const items = [
    settings.authGithubEnabled ? {
      key: "github",
      label: mode === "login" ? "GitHub" : "GitHub",
      href: `/api/auth/oauth/github/start?mode=${mode}`,
      icon: <Github className="h-4 w-4" />,
      useDocumentNavigation: true,
    } : null,
    settings.authGoogleEnabled ? {
      key: "google",
      label: mode === "login" ? "Google" : "Google",
      href: `/api/auth/oauth/google/start?mode=${mode}`,
      icon: <Chrome className="h-4 w-4" />,
      useDocumentNavigation: true,
    } : null,
    settings.authPasskeyEnabled ? {
      key: "passkey",
      label: mode === "login" ? "Passkey" : "Passkey",
      href: `/auth/passkey?mode=${mode}`,
      icon: <KeyRound className="h-4 w-4" />,
      useDocumentNavigation: false,
    } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string; icon: React.ReactNode; useDocumentNavigation: boolean }>

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>其它登录方式</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <EntryLink key={item.key} href={item.href} useDocumentNavigation={item.useDocumentNavigation}>
            {item.icon}
            {item.label}
          </EntryLink>
        ))}
      </div>
    </div>
  )
}
