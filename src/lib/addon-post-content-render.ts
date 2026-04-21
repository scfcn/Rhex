import "server-only"

import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { renderMarkdown } from "@/lib/markdown/render"

export async function renderAddonPostContentHtml(input: {
  content: string
  markdownEmojiMap: MarkdownEmojiItem[]
  pathname?: string
  searchParams?: URLSearchParams
}) {
  const normalizedContent = input.content.replace(/\r\n/g, "\n").trim()
  if (!normalizedContent) {
    return ""
  }

  const renderedHtml = renderMarkdown(normalizedContent, input.markdownEmojiMap)
  const result = await executeAddonAsyncWaterfallHook("post.content.render", renderedHtml, {
    pathname: input.pathname,
    searchParams: input.searchParams,
  })

  return typeof result.value === "string" ? result.value : renderedHtml
}
