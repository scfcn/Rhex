"use client"

import { useState } from "react"

import { AccessThresholdSelectGroup } from "@/components/access-threshold-select-group"
import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"

interface PostViewLevelModalProps {
  open: boolean
  value: {
    minViewLevel: string
    minViewVipLevel: string
  }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}

export function PostViewLevelModal({ open, value, levelOptions, vipLevelOptions, onChange, onClose }: PostViewLevelModalProps) {
  return (
    <DialogPortal open={open} onClose={onClose}>
      <div className="fixed inset-0 z-[120]">
        <DialogBackdrop onClick={onClose} />
        <DialogPositioner>
          {open ? <PostViewLevelModalBody initialValue={value} levelOptions={levelOptions} vipLevelOptions={vipLevelOptions} onChange={onChange} onClose={onClose} /> : null}
        </DialogPositioner>
      </div>
    </DialogPortal>
  )
}

function PostViewLevelModalBody({ initialValue, levelOptions, vipLevelOptions, onChange, onClose }: {
  initialValue: { minViewLevel: string; minViewVipLevel: string }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}) {
  const [draftLevelValue, setDraftLevelValue] = useState(initialValue.minViewLevel)
  const [draftVipLevelValue, setDraftVipLevelValue] = useState(initialValue.minViewVipLevel)

  function handleSave() {
    onChange({
      minViewLevel: draftLevelValue,
      minViewVipLevel: draftVipLevelValue,
    })
    onClose()
  }

  return (
    <DialogPanel className="max-w-lg">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h4 className="text-lg font-semibold">设置帖子浏览门槛</h4>
          <p className="mt-1 text-sm text-muted-foreground">等级和 VIP 任一设置为大于 0 时，只有满足全部门槛的用户才可查看帖子正文。</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
      </div>

      <div className="space-y-4 px-6 py-5">
        <AccessThresholdSelectGroup
          levelValue={draftLevelValue}
          vipLevelValue={draftVipLevelValue}
          levelOptions={levelOptions}
          vipLevelOptions={vipLevelOptions}
          onLevelChange={setDraftLevelValue}
          onVipLevelChange={setDraftVipLevelValue}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
        <Button type="button" onClick={handleSave}>保存访问门槛</Button>
      </div>
    </DialogPanel>
  )
}
