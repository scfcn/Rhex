"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const START_PROGRESS = 14
const MAX_PROGRESS_BEFORE_COMPLETE = 90

function isTrackableAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest("a")
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null
  }

  if (anchor.target && anchor.target !== "_self") {
    return null
  }

  if (anchor.hasAttribute("download") || anchor.dataset.disableNavigationProgress === "true") {
    return null
  }

  return anchor
}

export function GlobalNavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const navigatingRef = useRef(false)
  const progressTimerRef = useRef<number | null>(null)
  const finishTimerRef = useRef<number | null>(null)

  useEffect(() => {
    function clearTimers() {
      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current)
        finishTimerRef.current = null
      }
    }

    function startProgress() {
      clearTimers()
      navigatingRef.current = true
      setVisible(true)
      setProgress((current) => (current > 0 ? current : START_PROGRESS))

      progressTimerRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= MAX_PROGRESS_BEFORE_COMPLETE) {
            return current
          }

          const remaining = MAX_PROGRESS_BEFORE_COMPLETE - current
          const step = Math.max(1, Math.round(remaining * 0.18))
          return Math.min(MAX_PROGRESS_BEFORE_COMPLETE, current + step)
        })
      }, 140)
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) {
        return
      }

      const anchor = isTrackableAnchor(event.target)
      if (!anchor) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) {
        return
      }

      const currentPath = `${window.location.pathname}${window.location.search}`
      const nextPath = `${destination.pathname}${destination.search}`
      if (currentPath === nextPath) {
        return
      }

      startProgress()
    }

    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (!navigatingRef.current) {
      return
    }

    navigatingRef.current = false
    let completeTimer: number | null = null

    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }

    completeTimer = window.setTimeout(() => {
      setProgress(100)
      finishTimerRef.current = window.setTimeout(() => {
        setVisible(false)
        setProgress(0)
        finishTimerRef.current = null
      }, 220)
    }, 0)

    return () => {
      if (completeTimer !== null) {
        window.clearTimeout(completeTimer)
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current)
        finishTimerRef.current = null
      }
    }
  }, [pathname, search])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 shadow-[0_0_18px_rgba(251,191,36,0.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
