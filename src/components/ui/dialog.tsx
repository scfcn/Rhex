"use client"

import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

interface DialogPortalProps {
  open: boolean
  children: ReactNode
  onClose?: () => void
  closeOnEscape?: boolean
  lockBodyScroll?: boolean
}

export function DialogPortal({ open, children, onClose, closeOnEscape = true, lockBodyScroll = true }: DialogPortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        onClose?.()
      }
    }

    if (lockBodyScroll) {
      document.body.style.overflow = "hidden"
    }

    if (closeOnEscape) {
      window.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      if (lockBodyScroll) {
        document.body.style.overflow = previousOverflow
      }

      if (closeOnEscape) {
        window.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [closeOnEscape, lockBodyScroll, mounted, onClose, open])

  if (!mounted || !open) {
    return null
  }

  return createPortal(children, document.body)
}

interface DialogBackdropProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  closeLabel?: string
}

export function DialogBackdrop({ className, closeLabel = "关闭弹窗", ...props }: DialogBackdropProps) {
  return (
    <button
      type="button"
      aria-label={closeLabel}
      className={cn("absolute inset-0 bg-black/45", className)}
      {...props}
    />
  )
}

export function DialogPositioner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative flex min-h-full items-center justify-center px-4 py-6", className)} {...props} />
}

export function DialogPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { onClick, ...restProps } = props

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn("relative isolate w-full overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl", className)}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      {...restProps}
    />
  )
}
