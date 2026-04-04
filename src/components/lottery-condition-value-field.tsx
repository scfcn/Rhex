"use client"

import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import { getLotteryConditionPlaceholder } from "@/components/create-post-form.shared"

interface LotteryConditionValueFieldProps {
  conditionType: string
  value: string
  pointName: string
  userLevelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

function getConditionSelectOptions(
  conditionType: string,
  userLevelOptions: AccessThresholdOption[],
  vipLevelOptions: AccessThresholdOption[],
) {
  if (conditionType === "USER_LEVEL") {
    return userLevelOptions.filter((option) => option.value !== "0")
  }

  if (conditionType === "VIP_LEVEL") {
    return vipLevelOptions.filter((option) => option.value !== "0")
  }

  return null
}

export function LotteryConditionValueField({
  conditionType,
  value,
  pointName,
  userLevelOptions,
  vipLevelOptions,
  onChange,
  disabled = false,
}: LotteryConditionValueFieldProps) {
  const selectOptions = getConditionSelectOptions(conditionType, userLevelOptions, vipLevelOptions)

  if (selectOptions && selectOptions.length > 0) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none"
        disabled={disabled}
      >
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none"
      placeholder={getLotteryConditionPlaceholder(conditionType, pointName)}
      disabled={disabled}
    />
  )
}
