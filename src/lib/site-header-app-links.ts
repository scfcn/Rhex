import {

  AppWindow,
  BookOpen,
  Compass,
  FileText,
  Globe,
  Grid2x2,
  HelpCircle,
  Home,
  LayoutGrid,
  Link2,
  MessageSquare,
  Newspaper,
  Package,
  PanelsTopLeft,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  User,
  type LucideIcon,
} from "lucide-react"

export interface SiteHeaderAppLinkItem {
  id: string
  name: string
  href: string
  icon: string
}

export const DEFAULT_SITE_HEADER_APP_LINKS: SiteHeaderAppLinkItem[] = [
  { id: "home", name: "首页", href: "/", icon: "🏠" },
  { id: "boards", name: "节点", href: "/boards", icon: "🧭" },
  { id: "write", name: "发帖", href: "/write", icon: "✍️" },
  { id: "messages", name: "消息", href: "/messages", icon: "💬" },
]


export const HEADER_APP_ICON_OPTIONS = [
  { value: "grid", label: "宫格", icon: Grid2x2 },
  { value: "layout", label: "应用面板", icon: LayoutGrid },
  { value: "app", label: "应用", icon: AppWindow },
  { value: "sparkles", label: "闪光", icon: Sparkles },
  { value: "compass", label: "指南针", icon: Compass },
  { value: "panels", label: "门户", icon: PanelsTopLeft },
  { value: "package", label: "资源", icon: Package },
] as const

export type HeaderAppIconName = (typeof HEADER_APP_ICON_OPTIONS)[number]["value"]
export type SiteHeaderAppIconItem = (typeof HEADER_APP_ICON_OPTIONS)[number]

const HEADER_APP_ICON_MAP: Record<HeaderAppIconName, LucideIcon> = {
  grid: Grid2x2,
  layout: LayoutGrid,
  app: AppWindow,
  sparkles: Sparkles,
  compass: Compass,
  panels: PanelsTopLeft,
  package: Package,
}

const HEADER_APP_LINK_ICON_PALETTE: LucideIcon[] = [
  Home,
  Compass,
  MessageSquare,
  FileText,
  BookOpen,
  Store,
  ShoppingBag,
  User,
  Settings,
  HelpCircle,
  Newspaper,
  Globe,
  Link2,
]

export function normalizeSiteHeaderAppLinks(raw: unknown): SiteHeaderAppLinkItem[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SITE_HEADER_APP_LINKS]
  }

  const normalized: SiteHeaderAppLinkItem[] = []

  raw.forEach((item, index) => {
    const name = String(item?.name ?? "").trim()
    const href = String(item?.href ?? "").trim()
    const icon = String(item?.icon ?? "⭐").trim()

    if (!name || !href || !icon) {
      return
    }

    normalized.push({
      id: String(item?.id ?? `app-link-${index + 1}`).trim() || `app-link-${index + 1}`,
      name,
      href,
      icon,
    })
  })

  return normalized.length > 0 ? normalized : [...DEFAULT_SITE_HEADER_APP_LINKS]
}


export function parseSiteHeaderAppLinks(raw: string | null | undefined) {
  if (!raw) {
    return [...DEFAULT_SITE_HEADER_APP_LINKS]
  }

  try {
    return normalizeSiteHeaderAppLinks(JSON.parse(raw))
  } catch {
    return [...DEFAULT_SITE_HEADER_APP_LINKS]
  }
}

export function normalizeHeaderAppIconName(raw: unknown): HeaderAppIconName {
  const normalized = String(raw ?? "grid").trim().toLowerCase()
  return normalized in HEADER_APP_ICON_MAP ? (normalized as HeaderAppIconName) : "grid"
}

export function resolveHeaderAppTriggerIcon(name: unknown): LucideIcon {
  return HEADER_APP_ICON_MAP[normalizeHeaderAppIconName(name)]
}

export function resolveHeaderAppItemIcon(index: number): LucideIcon {
  return HEADER_APP_LINK_ICON_PALETTE[index % HEADER_APP_LINK_ICON_PALETTE.length] ?? Grid2x2
}


