"use client"

import type { AccessThresholdOption } from "@/lib/access-threshold-options"

export type ConditionValueFieldMode = "text" | "number" | "user-level" | "vip-level" | "datetime-local"

interface ConditionValueFieldProps {
  mode?: ConditionValueFieldMode
  value: string
  placeholder?: string
  userLevelOptions?: AccessThresholdOption[]
  vipLevelOptions?: AccessThresholdOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

function padDateTimeValue(unit: number) {
  return String(unit).padStart(2, "0")
}

function normalizeDateTimeLocalValue(value: string) {
  if (!value) {
    return ""
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return [
    parsedDate.getFullYear(),
    padDateTimeValue(parsedDate.getMonth() + 1),
    padDateTimeValue(parsedDate.getDate()),
  ].join("-") + `T${padDateTimeValue(parsedDate.getHours())}:${padDateTimeValue(parsedDate.getMinutes())}`
}

function getConditionSelectOptions(
  mode: ConditionValueFieldMode,
  userLevelOptions: AccessThresholdOption[],
  vipLevelOptions: AccessThresholdOption[],
) {
  if (mode === "user-level") {
    return userLevelOptions.filter((option) => option.value !== "0")
  }

  if (mode === "vip-level") {
    return vipLevelOptions.filter((option) => option.value !== "0")
  }

  return null
}

export function ConditionValueField({
  mode = "text",
  value,
  placeholder,
  userLevelOptions = [],
  vipLevelOptions = [],
  onChange,
  disabled = false,
  className = "h-11 rounded-full border border-border bg-background px-4 text-sm outline-none",
}: ConditionValueFieldProps) {
  const selectOptions = getConditionSelectOptions(mode, userLevelOptions, vipLevelOptions)

  if (selectOptions && selectOptions.length > 0) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        disabled={disabled}
      >
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  }

  const inputType = mode === "datetime-local"
    ? "datetime-local"
    : mode === "number"
      ? "number"
      : "text"

  return (
    <input
      type={inputType}
      value={mode === "datetime-local" ? normalizeDateTimeLocalValue(value) : value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
