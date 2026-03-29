import type { CurrentUserRecord } from "@/db/current-user"
import { executeUserCheckIn, listUserCheckInLogsInRange } from "@/db/check-in-queries"

import { apiError } from "@/lib/api-route"
import { getLocalDateKey, getMonthKey } from "@/lib/date-key"
import { recordUserCheckInGrowth } from "@/lib/level-system"
import { getSiteSettings } from "@/lib/site-settings"
import { isVipActive } from "@/lib/vip-status"

interface CheckInSettingsSnapshot {
  pointName: string
  checkInReward: number
  checkInMakeUpCardPrice: number
  checkInVipMakeUpCardPrice: number
}

interface BuildCheckInCalendarOptions {
  userId: number
  month: string
}

interface ExecuteCheckInOptions {
  userId: number
  dateKey: string
  reward: number
  pointName: string
  makeUpCost: number
  isMakeUp: boolean
}

interface CheckInActionPayload {
  action: "check-in" | "make-up"
  date?: string
}

export interface CheckInCalendarEntry {
  date: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: string
}

export interface CheckInOverview {
  month: string
  pointName: string
  checkInReward: number
  makeUpPrice: number
  vipMakeUpPrice: number
  normalMakeUpPrice: number
  entries: CheckInCalendarEntry[]
}

export interface CheckInActionResult {
  points: number
  alreadyCheckedIn: boolean
  date: string
  makeUpCost?: number
  message: string
}

function parseDateKey(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null
  }

  const date = new Date(`${input}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getMonthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    apiError(400, "月份格式不正确")
  }

  const firstDay = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(firstDay.getTime())) {
    apiError(400, "月份格式不正确")
  }

  const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1)
  return {
    start: `${month}-01`,
    end: getLocalDateKey(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)),
  }
}

function assertCheckInEnabled(settings: { checkInEnabled: boolean }) {
  if (!settings.checkInEnabled) {
    apiError(403, "签到功能暂未开启")
  }
}

function readCheckInSettingsSnapshot(settings: CheckInSettingsSnapshot) {
  return {
    pointName: settings.pointName,
    reward: Math.max(0, settings.checkInReward),
    normalMakeUpPrice: Math.max(0, settings.checkInMakeUpCardPrice),
    vipMakeUpPrice: Math.max(0, settings.checkInVipMakeUpCardPrice),
  }
}

async function buildCalendarData(options: BuildCheckInCalendarOptions): Promise<CheckInCalendarEntry[]> {
  const bounds = getMonthBounds(options.month)
  const logs = await listUserCheckInLogsInRange({
    userId: options.userId,
    startDateKey: bounds.start,
    endDateKey: bounds.end,
  })

  return logs.map((item) => ({
    date: item.checkedInOn,
    reward: item.reward,
    isMakeUp: item.isMakeUp,
    makeUpCost: item.makeUpCost,
    createdAt: item.createdAt.toISOString(),
  }))
}

async function executeCheckIn(options: ExecuteCheckInOptions) {
  const result = await executeUserCheckIn(options)

  if (!result) {
    apiError(404, "用户不存在")
  }

  if (options.isMakeUp && options.makeUpCost > 0 && !result.alreadyCheckedIn && result.points < 0) {
    apiError(409, `${options.pointName}不足，无法补签`)
  }

  if (!result.alreadyCheckedIn) {
    await recordUserCheckInGrowth(options.userId)
  }

  return result
}

function parseCheckInActionPayload(body: unknown): CheckInActionPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { action: "check-in" }
  }

  const record = body as Record<string, unknown>
  const action = record.action === "make-up" ? "make-up" : "check-in"
  const date = typeof record.date === "string" ? record.date.trim() : ""

  return action === "make-up"
    ? { action, ...(date ? { date } : {}) }
    : { action }
}

export async function getCheckInOverview(user: CurrentUserRecord, month = getMonthKey()): Promise<CheckInOverview> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  const snapshot = readCheckInSettingsSnapshot(settings)
  const vipActive = isVipActive(user)
  const entries = await buildCalendarData({ userId: user.id, month })

  return {
    month,
    pointName: snapshot.pointName,
    checkInReward: snapshot.reward,
    makeUpPrice: vipActive ? snapshot.vipMakeUpPrice : snapshot.normalMakeUpPrice,
    vipMakeUpPrice: snapshot.vipMakeUpPrice,
    normalMakeUpPrice: snapshot.normalMakeUpPrice,
    entries,
  }
}

export async function submitCheckInAction(user: CurrentUserRecord, body: unknown): Promise<CheckInActionResult> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  const snapshot = readCheckInSettingsSnapshot(settings)
  const payload = parseCheckInActionPayload(body)
  const todayKey = getLocalDateKey()

  if (payload.action === "check-in") {
    const result = await executeCheckIn({
      userId: user.id,
      dateKey: todayKey,
      reward: snapshot.reward,
      pointName: snapshot.pointName,
      makeUpCost: 0,
      isMakeUp: false,
    })

    return {
      points: result.points,
      alreadyCheckedIn: result.alreadyCheckedIn,
      date: todayKey,
      message: result.alreadyCheckedIn
        ? "今天已经签到过了"
        : `签到成功，获得 ${snapshot.reward} ${snapshot.pointName}`,
    }
  }

  const parsedDate = parseDateKey(payload.date ?? "")
  if (!parsedDate) {
    apiError(400, "补签日期格式不正确")
  }

  const targetDateKey = getLocalDateKey(parsedDate)
  if (targetDateKey >= todayKey) {
    apiError(400, "只能补签今天之前的日期")
  }

  const makeUpCost = isVipActive(user) ? snapshot.vipMakeUpPrice : snapshot.normalMakeUpPrice
  if (makeUpCost > 0 && user.points < makeUpCost) {
    apiError(409, `${snapshot.pointName}不足，无法补签`)
  }

  const result = await executeCheckIn({
    userId: user.id,
    dateKey: targetDateKey,
    reward: snapshot.reward,
    pointName: snapshot.pointName,
    makeUpCost,
    isMakeUp: true,
  })

  if (result.alreadyCheckedIn) {
    apiError(409, "该日期已经签到过了")
  }

  return {
    points: result.points,
    alreadyCheckedIn: false,
    date: targetDateKey,
    makeUpCost,
    message: makeUpCost > 0
      ? `补签成功，消耗 ${makeUpCost} ${snapshot.pointName}，获得 ${snapshot.reward} ${snapshot.pointName}`
      : `补签成功，获得 ${snapshot.reward} ${snapshot.pointName}`,
  }
}
