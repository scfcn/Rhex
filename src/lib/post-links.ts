import type { PostLinkDisplayMode } from "@/lib/site-settings"


export function getPostRouteSegment(post: { id: string; slug: string }, mode: PostLinkDisplayMode = "SLUG") {
  return mode === "ID" ? post.id : post.slug
}

export function getCanonicalPostPath(post: { slug: string }) {
  return `/posts/${encodeURIComponent(post.slug)}`
}

export function getPostPath(post: { id: string; slug: string }, options?: PostLinkDisplayMode | { mode?: PostLinkDisplayMode }) {
  const mode = typeof options === "string" ? options : options?.mode ?? "ID"

  return `/posts/${encodeURIComponent(getPostRouteSegment(post, mode))}`
}



export function getPostCommentPath(post: { id: string; slug: string; title?: string }, commentId: string, options?: PostLinkDisplayMode | { mode?: PostLinkDisplayMode }) {
  return `${getPostPath(post, options)}#comment-${commentId}`
}


export function extractPostIdFromRouteSegment(segment: string) {
  const trimmed = segment.trim()

  if (!trimmed) {
    return null
  }

  const directId = trimmed.match(/^[a-z0-9]+$/i)?.[0]
  if (directId) {
    return directId
  }

  return trimmed.match(/-([a-z0-9]+)$/i)?.[1] ?? null
}

