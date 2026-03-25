const SHANGHAI_TIME_ZONE = "Asia/Shanghai"

function getDateParts(date = new Date(), timeZone = SHANGHAI_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((item) => item.type === "year")?.value
  const month = parts.find((item) => item.type === "month")?.value
  const day = parts.find((item) => item.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("无法解析日期")
  }

  return { year, month, day }
}

export function getLocalDateKey(date = new Date(), timeZone = SHANGHAI_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone)
  return `${year}-${month}-${day}`
}

export function getMonthKey(date = new Date(), timeZone = SHANGHAI_TIME_ZONE) {
  const { year, month } = getDateParts(date, timeZone)
  return `${year}-${month}`
}

export function getMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-")
  return `${year} 年 ${Number(month)} 月`
}
