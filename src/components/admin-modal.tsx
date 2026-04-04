"use client"

import type { FormEvent, ReactNode } from "react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"

interface AdminModalProps {
  open: boolean
  title: string
  description?: string
  size?: "md" | "lg" | "xl"
  children: ReactNode
  footer?: ReactNode
  closeDisabled?: boolean
  closeOnEscape?: boolean
  onClose: () => void
}

const sizeClassMap: Record<NonNullable<AdminModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
}

interface AdminFormModalProps extends Omit<AdminModalProps, "children" | "footer"> {
  children: ReactNode
  footer?: (context: { formId: string }) => ReactNode
  formClassName?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function AdminModal({
  open,
  title,
  description,
  size = "md",
  children,
  footer,
  closeDisabled = false,
  closeOnEscape = true,
  onClose,
}: AdminModalProps) {
  return (
    <DialogPortal open={open} onClose={closeDisabled ? undefined : onClose} closeOnEscape={closeOnEscape}>
      <div className="fixed inset-0 z-[120]">
        <DialogBackdrop onClick={closeDisabled ? undefined : onClose} />
        <DialogPositioner className="px-3 py-4">
          <DialogPanel className={`flex max-h-[calc(100vh-2rem)] max-w-lg flex-col ${sizeClassMap[size]}`}>
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">{title}</h3>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <Button type="button" variant="ghost" className="h-8 w-full px-2 text-xs sm:w-auto" onClick={onClose} disabled={closeDisabled}>
                关闭
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
            {footer ? <div className="border-t border-border px-4 py-4 sm:px-5">{footer}</div> : null}
          </DialogPanel>
        </DialogPositioner>
      </div>
    </DialogPortal>
  )
}

export function AdminFormModal({
  children,
  footer,
  formClassName,
  onSubmit,
  ...modalProps
}: AdminFormModalProps) {
  const formId = useId()

  return (
    <AdminModal
      {...modalProps}
      footer={footer ? footer({ formId }) : undefined}
    >
      <form id={formId} onSubmit={onSubmit} className={formClassName ? formClassName : "space-y-4"}>
        {children}
      </form>
    </AdminModal>
  )
}
