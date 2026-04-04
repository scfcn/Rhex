"use client"

import type { AccessThresholdOption } from "@/lib/access-threshold-options"

interface AccessThresholdSelectGroupProps {
  levelValue: string
  vipLevelValue: string
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onLevelChange: (value: string) => void
  onVipLevelChange: (value: string) => void
  levelLabel?: string
  vipLevelLabel?: string
}

export function AccessThresholdSelectGroup({
  levelValue,
  vipLevelValue,
  levelOptions,
  vipLevelOptions,
  onLevelChange,
  onVipLevelChange,
  levelLabel = "最低浏览等级",
  vipLevelLabel = "最低 VIP 浏览等级",
}: AccessThresholdSelectGroupProps) {
  const currentLevelOption = levelOptions.find((item) => item.value === levelValue) ?? levelOptions[0]
  const currentVipLevelOption = vipLevelOptions.find((item) => item.value === vipLevelValue) ?? vipLevelOptions[0]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">{levelLabel}</p>
        <select
          value={levelValue}
          onChange={(event) => onLevelChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
        >
          {levelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-xs leading-6 text-muted-foreground">{currentLevelOption?.description}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{vipLevelLabel}</p>
        <select
          value={vipLevelValue}
          onChange={(event) => onVipLevelChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
        >
          {vipLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-xs leading-6 text-muted-foreground">{currentVipLevelOption?.description}</p>
      </div>
    </div>
  )
}
