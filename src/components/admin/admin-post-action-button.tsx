"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface AdminPostActionButtonProps {
  action: string
  targetId: string
  label: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  tone?: "default" | "danger"
  payload?: Record<string, unknown>
  modalTitle?: string
  modalDescription?: string
  placeholder?: string
  confirmText?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function AdminPostActionButton({
  action,
  targetId,
  label,
  className,
  variant = "outline",
  tone = "default",
  payload,
  modalTitle,
  modalDescription,
  placeholder,
  confirmText,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: AdminPostActionButtonProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const autoSubmittedRef = useRef(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const submit = useCallback(() => {
    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, message, ...payload }),
      })

      if (response.ok) {
        setOpen(false)
        setMessage("")
        router.refresh()
      }
    })
  }, [action, message, payload, router, setOpen, startTransition, targetId])

  useEffect(() => {
    if (!hideTrigger || modalTitle || placeholder) {
      return
    }

    if (!open) {
      autoSubmittedRef.current = false
      return
    }

    if (autoSubmittedRef.current || isPending) {
      return
    }

    autoSubmittedRef.current = true
    submit()
  }, [hideTrigger, isPending, modalTitle, open, placeholder, submit])

  return (
    <>
      {!hideTrigger ? (
        <Button
          type="button"
          variant={variant}
          className={className ?? (tone === "danger" ? "h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" : "h-7 rounded-full px-2.5 text-xs")}
          onClick={() => {
            if (!modalTitle && !placeholder) {
              submit()
              return
            }
            setOpen(true)
          }}
          disabled={isPending}
        >
          {isPending ? "处理中..." : label}
        </Button>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle ?? `确认${label}`}
        description={modalDescription}
        footer={
          <div className="flex items-center gap-2">
            <Button type="button" disabled={isPending} className={tone === "danger" ? "h-9 rounded-full bg-red-600 px-4 text-xs text-white hover:bg-red-500" : "h-9 rounded-full px-4 text-xs"} onClick={submit}>
              {isPending ? "处理中..." : confirmText ?? label}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        {placeholder ? (
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] rounded-xl bg-background px-4 py-3"
          />
        ) : null}
      </Modal>
    </>
  )
}

