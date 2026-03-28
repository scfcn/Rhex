import Link from "next/link"
import { Rss } from "lucide-react"

interface RssSubscribeButtonProps {
  href: string
  label?: string
  className?: string
}

export function RssSubscribeButton({ href, label = "订阅 RSS", className }: RssSubscribeButtonProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={className ?? "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/15"}
    >
      <Rss className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  )
}
