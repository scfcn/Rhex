import { findSidebarUserCheckInRecord } from "@/db/home-sidebar-queries"
import { getUnreadConversationCount } from "@/db/message-read-queries"
import { countUnreadNotifications } from "@/db/notification-read-queries"
import { getLocalDateKey } from "@/lib/date-key"

export interface HeaderUnreadCounts {
  unreadNotificationCount: number
  unreadMessageCount: number
}

export interface HeaderQuickActionsState {
  checkedInToday: boolean
}


export async function getHeaderUnreadCounts(userId?: number | null): Promise<HeaderUnreadCounts> {
  if (!userId) {
    return {
      unreadNotificationCount: 0,
      unreadMessageCount: 0,
    }
  }

  const [unreadNotificationCount, unreadMessageCount] = await Promise.all([
    countUnreadNotifications(userId),
    getUnreadConversationCount(userId),
  ])

  return {
    unreadNotificationCount,
    unreadMessageCount,
  }
}

export async function getHeaderQuickActionsState(userId?: number | null): Promise<HeaderQuickActionsState> {
  if (!userId) {
    return {
      checkedInToday: false,
    }
  }

  const checkInRecord = await findSidebarUserCheckInRecord(userId, getLocalDateKey())

  return {
    checkedInToday: Boolean(checkInRecord),
  }
}
