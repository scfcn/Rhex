"use client"

import { useState } from "react"

import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"

interface HiddenContentModalProps {

  open: boolean
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  price?: string

  onPriceChange?: (value: string) => void
  priceLabel?: string
}


export function HiddenContentModal({ open, title, description, value, onChange, onClose, price, onPriceChange, priceLabel }: HiddenContentModalProps) {
  return (
    <DialogPortal open={open} onClose={onClose}>
      <div className="fixed inset-0 z-[120]">
        <DialogBackdrop onClick={onClose} />
        <DialogPositioner>
          {open ? (
            <HiddenContentModalBody
              title={title}
              description={description}
              initialValue={value}
              initialPrice={price}
              onChange={onChange}
              onPriceChange={onPriceChange}
              onClose={onClose}
              priceLabel={priceLabel}
            />
          ) : null}
        </DialogPositioner>
      </div>
    </DialogPortal>
  )
}

function HiddenContentModalBody({ title, description, initialValue, initialPrice, onChange, onClose, onPriceChange, priceLabel }: {
  title: string
  description: string
  initialValue: string
  initialPrice?: string
  onChange: (value: string) => void
  onClose: () => void
  onPriceChange?: (value: string) => void
  priceLabel?: string
}) {
  const [draftValue, setDraftValue] = useState(initialValue)
  const [draftPrice, setDraftPrice] = useState(initialPrice ?? "")

  function handleSave() {
    onChange(draftValue)
    onPriceChange?.(draftPrice)
    onClose()
  }

  return (
    <DialogPanel className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h4 className="text-lg font-semibold">{title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
      </div>

      <div className="space-y-4 px-6 py-5">
        {onPriceChange ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{priceLabel ?? "价格"}</p>
            <input value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="输入价格" />
          </div>
        ) : null}

        <RefinedRichPostEditor
          value={draftValue}
          onChange={setDraftValue}
          placeholder="写下这部分隐藏内容，支持 Markdown、图片和表情。"
          minHeight={260}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
        <Button type="button" onClick={handleSave}>保存这段隐藏内容</Button>
      </div>
    </DialogPanel>
  )
}
