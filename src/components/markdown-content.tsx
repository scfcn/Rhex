"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Lightbox, { type Slide } from "yet-another-react-lightbox"
import { Counter, Zoom,Fullscreen  } from "yet-another-react-lightbox/plugins"

import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import { bindBase64Inspector, bindBrokenImagePlaceholders, bindImageLightbox, enhanceMarkdown, type LightboxImage } from "@/lib/markdown/enhance"
import { isImageOnlyMarkdownHtml, renderMarkdown } from "@/lib/markdown/render"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  html?: string
  className?: string
  emptyText?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
  expandImagesWhenImageOnly?: boolean
  imageOnly?: boolean
}

interface MarkdownBodyProps {
  html: string
  className?: string
  onOpenLightbox: (images: LightboxImage[], index: number) => void
  isImageOnly?: boolean
}

interface LightboxState {
  images: LightboxImage[]
  index: number
}

interface LightboxPortalProps {
  lightbox: LightboxState
  onClose: () => void
  onChange: (index: number) => void
}

function LightboxPortal({ lightbox, onClose, onChange }: LightboxPortalProps) {
  const slides = useMemo<Slide[]>(
    () => lightbox.images.map((item) => ({ src: item.src, alt: item.alt })),
    [lightbox.images],
  )
  const render = useMemo(
    () => ({
      iconPrev: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronLeft size={20} strokeWidth={2.25} />
        </span>
      ),
      iconNext: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronRight size={20} strokeWidth={2.25} />
        </span>
      ),
    }),
    [],
  )

  return (
    <Lightbox
      className="markdown-lightbox-viewer"
      open
      close={onClose}
      index={lightbox.index}
      slides={slides}
      plugins={[Counter, Zoom,Fullscreen]}
      counter={{
        container: {
          className: "markdown-lightbox-counter",
        },
        separator: " / ",
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      carousel={{
        padding: 0,
        spacing: "12px",
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        scrollToZoom: true,
      }}
      render={render}
      labels={{
        Previous: "上一张",
        Next: "下一张",
        Close: "关闭",
      }}
      on={{
        view: ({ index }) => onChange(index),
      }}
    />
  )
}

const MarkdownBody = memo(function MarkdownBody({ html, className, onOpenLightbox, isImageOnly = false }: MarkdownBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !html) {
      return
    }

    const removeBase64Inspector = bindBase64Inspector(container)
    const removeBrokenImagePlaceholders = bindBrokenImagePlaceholders(container)
    let removeMarkdownEnhancements = () => {}
    let removeImageLightbox = () => {}
    let cancelled = false

    void enhanceMarkdown(container).then((cleanup) => {
      if (cancelled) {
        cleanup()
        return
      }

      removeMarkdownEnhancements = cleanup
      removeImageLightbox = bindImageLightbox(container, onOpenLightbox)
    })

    return () => {
      cancelled = true
      removeBase64Inspector()
      removeBrokenImagePlaceholders()
      removeMarkdownEnhancements()
      removeImageLightbox()
    }
  }, [html, onOpenLightbox])

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      className={cn("markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1", isImageOnly && "markdown-body--image-only", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

export function MarkdownContent({ content, html, className, emptyText, markdownEmojiMap, expandImagesWhenImageOnly = false, imageOnly }: MarkdownContentProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const resolvedHtml = useMemo(() => {
    if (typeof html === "string") {
      return html
    }

    return normalized ? renderMarkdown(normalized, resolvedMarkdownEmojiMap) : ""
  }, [html, normalized, resolvedMarkdownEmojiMap])
  const isImageOnly = useMemo(() => {
    if (!expandImagesWhenImageOnly) {
      return false
    }

    if (typeof imageOnly === "boolean") {
      return imageOnly
    }

    return isImageOnlyMarkdownHtml(resolvedHtml)
  }, [expandImagesWhenImageOnly, imageOnly, resolvedHtml])
  const handleOpenLightbox = useCallback((images: LightboxImage[], index: number) => {
    setLightbox({ images, index })
  }, [])

  if (!resolvedHtml) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <>
      <MarkdownBody html={resolvedHtml} className={className} onOpenLightbox={handleOpenLightbox} isImageOnly={isImageOnly} />
      {lightbox ? (
        <LightboxPortal
          lightbox={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((previous) => previous ? { ...previous, index } : previous)}
        />
      ) : null}
    </>
  )
}
