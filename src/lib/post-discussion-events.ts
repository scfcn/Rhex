"use client"

export const POST_BOUNTY_RESOLVED_EVENT = "post:bounty-resolved"

export interface PostBountyResolvedDetail {
  postId: string
  acceptedAnswerAuthor?: string | null
}

export function dispatchPostBountyResolved(detail: PostBountyResolvedDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent<PostBountyResolvedDetail>(POST_BOUNTY_RESOLVED_EVENT, {
    detail,
  }))
}

export function addPostBountyResolvedListener(listener: (detail: PostBountyResolvedDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<PostBountyResolvedDetail>).detail
    if (!detail?.postId) {
      return
    }

    listener(detail)
  }

  window.addEventListener(POST_BOUNTY_RESOLVED_EVENT, handleEvent as EventListener)

  return () => {
    window.removeEventListener(POST_BOUNTY_RESOLVED_EVENT, handleEvent as EventListener)
  }
}
