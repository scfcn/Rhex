"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "danger"
}

interface ConfirmRequest extends Required<Omit<ConfirmOptions, "title">> {
  id: string
  title: string
  resolve: (value: boolean) => void
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)
let globalConfirmBridge: ConfirmContextValue | null = null

function createConfirmId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ConfirmRequest[]>([])
  const queueRef = useRef<ConfirmRequest[]>([])

  const syncQueue = useCallback((updater: (current: ConfirmRequest[]) => ConfirmRequest[]) => {
    setQueue((current) => {
      const next = updater(current)
      queueRef.current = next
      return next
    })
  }, [])

  const settleCurrent = useCallback((value: boolean) => {
    const current = queueRef.current[0]
    if (!current) {
      return
    }

    current.resolve(value)
    syncQueue((items) => items.slice(1))
  }, [syncQueue])

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    const request: ConfirmRequest = {
      id: createConfirmId(),
      title: options.title ?? "请确认操作",
      description: options.description,
      confirmText: options.confirmText ?? "确认",
      cancelText: options.cancelText ?? "取消",
      variant: options.variant ?? "default",
      resolve,
    }

    syncQueue((current) => [...current, request])
  }), [syncQueue])

  useEffect(() => () => {
    queueRef.current.forEach((item) => item.resolve(false))
    queueRef.current = []
  }, [])

  const contextValue = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm])
  const current = queue[0] ?? null

  useEffect(() => {
    globalConfirmBridge = contextValue
    return () => {
      if (globalConfirmBridge === contextValue) {
        globalConfirmBridge = null
      }
    }
  }, [contextValue])

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {current ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 px-3 py-4">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-lg font-semibold">{current.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{current.description}</p>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4">
              <Button type="button" variant="ghost" className="min-w-24" onClick={() => settleCurrent(false)}>
                {current.cancelText}
              </Button>
              <Button
                type="button"
                className={current.variant === "danger" ? "min-w-24 bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600" : "min-w-24"}
                onClick={() => settleCurrent(true)}
              >
                {current.confirmText}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error("useConfirm 必须在 ConfirmProvider 内使用")
  }

  return context.confirm
}

function fallbackConfirm(options: ConfirmOptions) {
  if (typeof window === "undefined") {

    return Promise.resolve(false)
  }

  const title = options.title ? `${options.title}\n\n` : ""
  return Promise.resolve(window.confirm(`${title}${options.description}`))
}

export function showConfirm(options: ConfirmOptions) {
  if (!globalConfirmBridge) {
    return fallbackConfirm(options)
  }

  return globalConfirmBridge.confirm(options)
}

