import { Tooltip } from "@/components/ui/tooltip"

interface VipBadgeProps {
  level?: number | null
  compact?: boolean
}

function getVipBadgeClasses(compact: boolean) {
  return compact
    ? "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
    : "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
}

function getVipBadgeStyle(level: number) {
  const colorVariableName = level >= 3
    ? "--vip-name-color-vip3"
    : level === 2
      ? "--vip-name-color-vip2"
      : "--vip-name-color-vip1"

  return {
    color: `var(${colorVariableName})`,
    borderColor: `color-mix(in srgb, var(${colorVariableName}) 30%, transparent)`,
    backgroundColor: `color-mix(in srgb, var(${colorVariableName}) 14%, transparent)`,
  }
}

export function VipBadge({ level = 1, compact = false }: VipBadgeProps) {
  const normalizedLevel = Math.max(1, level ?? 1)
  const label = `VIP${normalizedLevel} 会员`

  return (
    <Tooltip content={label}>
      <span className={getVipBadgeClasses(compact)} style={getVipBadgeStyle(normalizedLevel)} aria-label={label}>
        VIP{normalizedLevel}
      </span>
    </Tooltip>
  )
}
