"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"

interface AdminActionFormProps {
  action: string
  targetId: string
  placeholder?: string
  buttonText: string
  tone?: "default" | "danger"
  useModal?: boolean
  modalTitle?: string
  modalDescription?: string
  confirmText?: string
}

export function AdminActionForm({
  action,
  targetId,
  placeholder,
  buttonText,
  tone = "default",
  useModal = false,
  modalTitle,
  modalDescription,
  confirmText,
}: AdminActionFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitAction(nextMessage: string) {
    setFeedback(null)

    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          targetId,
          message: nextMessage,
        }),
      })

      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "操作已完成" : "操作失败"))
      if (response.ok) {
        setMessage("")
        setOpen(false)
        router.refresh()
      }
    })
  }

  async function onSubmit(formData: FormData) {
    submitAction(String(formData.get("message") ?? ""))
  }

  if (!useModal) {
    return (
      <form action={onSubmit} className="space-y-3">
        {placeholder ? (
          <textarea
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={placeholder}
            className="min-h-[92px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
          />
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" className={tone === "danger" ? "bg-red-600 text-white hover:bg-red-500" : ""} disabled={isPending}>
            {isPending ? "处理中..." : buttonText}
          </Button>
          {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
        </div>
      </form>
    )
  }

  return (
    <>
      <Button type="button" className={tone === "danger" ? "h-8 rounded-full bg-red-600 px-3 text-white hover:bg-red-500" : "h-8 rounded-full px-3"} variant={tone === "danger" ? "default" : "outline"} onClick={() => setOpen(true)}>
        {buttonText}
      </Button>
      <DialogPortal open={open} onClose={isPending ? undefined : () => setOpen(false)} closeOnEscape={!isPending}>
        <div className="fixed inset-0 z-[120]">
          <DialogBackdrop onClick={isPending ? undefined : () => setOpen(false)} />
          <DialogPositioner className="px-4">
            <DialogPanel className="max-w-lg p-6">
            <h3 className="text-lg font-semibold">{modalTitle ?? `确认${buttonText}`}</h3>
            {modalDescription ? <p className="mt-2 text-sm text-muted-foreground">{modalDescription}</p> : null}
            {placeholder ? (
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={placeholder}
                className="mt-4 min-h-[120px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
              />
            ) : null}

            <div className="mt-4 flex items-center gap-3">
              <Button
                type="button"
                className={tone === "danger" ? "bg-red-600 text-white hover:bg-red-500" : ""}
                disabled={isPending}
                onClick={() => submitAction(message)}
              >
                {isPending ? "处理中..." : confirmText ?? buttonText}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
                取消
              </Button>
            </div>
            </DialogPanel>
          </DialogPositioner>
        </div>
      </DialogPortal>
    </>
  )
}
