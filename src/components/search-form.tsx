"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { LevelIcon } from "@/components/level-icon"
import { normalizeHeaderAppIconName, type SiteHeaderAppIconItem, type SiteHeaderAppLinkItem, HEADER_APP_ICON_OPTIONS } from "@/lib/site-header-app-links"



interface SearchFormProps {
  defaultValue?: string
  compact?: boolean
  appLinks?: SiteHeaderAppLinkItem[]
  appIconName?: string
}

function HeaderAppTriggerIcon({ name, className }: { name: string; className?: string }) {
  const normalizedName = normalizeHeaderAppIconName(name)
  const matchedOption = HEADER_APP_ICON_OPTIONS.find((item: SiteHeaderAppIconItem) => item.value === normalizedName)
  const Icon = matchedOption?.icon ?? HEADER_APP_ICON_OPTIONS[0]!.icon
  return <Icon className={className} />
}

export function SearchForm({ defaultValue = "", compact = false, appLinks = [], appIconName = "grid" }: SearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const desktopAppsMenuRef = useRef<HTMLDivElement | null>(null)
  const [keyword, setKeyword] = useState(defaultValue)
  const [desktopAppsMenuOpen, setDesktopAppsMenuOpen] = useState(false)
  const hasDesktopApps = compact && appLinks.length > 0


  useEffect(() => {
    if (!desktopAppsMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!desktopAppsMenuRef.current?.contains(target)) {
        setDesktopAppsMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDesktopAppsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [desktopAppsMenuOpen])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault()

    const nextKeyword = keyword.trim()
    const params = new URLSearchParams(searchParams.toString())

    if (!nextKeyword) {
      params.delete("q")
      params.delete("page")
      router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`)
      return
    }

    params.set("q", nextKeyword)
    params.set("page", "1")
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "w-full" : "w-full max-w-2xl"}>
      <div className={compact ? "relative" : "flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-3 text-foreground shadow-sm transition-shadow focus-within:shadow-soft"}>
        {compact ? (
          <>
            {hasDesktopApps ? (
              <div ref={desktopAppsMenuRef} className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2">
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setDesktopAppsMenuOpen((current) => !current)}
                  aria-expanded={desktopAppsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="打开应用菜单"
                >
                  <HeaderAppTriggerIcon name={appIconName} className="h-4 w-4" />
                </button>
                {desktopAppsMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] w-64 rounded-2xl border border-border bg-background p-2 shadow-2xl">
                    <div className="px-3 pb-2 pt-1 text-xs font-medium text-muted-foreground">应用入口</div>
                    <div className="grid gap-1">
                      {appLinks.map((item) => {
                        const isExternal = /^https?:\/\//i.test(item.href)


                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noreferrer noopener" : undefined}
                            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
                            onClick={() => setDesktopAppsMenuOpen(false)}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <LevelIcon icon={item.icon} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name} />
                            </span>

                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${hasDesktopApps ? "left-10" : "left-3"}`} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className={`h-9 w-full rounded-full border border-border bg-muted/50 py-2 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${hasDesktopApps ? "pl-16" : "pl-10"}`}
              placeholder="搜索节点、帖子、用户..."
              maxLength={50}
              type="search"
            />
          </>
        ) : (

          <>
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="搜索节点、帖子、作者"
              maxLength={50}
            />
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">
              搜索
            </button>
          </>
        )}
      </div>
    </form>
  )
}
