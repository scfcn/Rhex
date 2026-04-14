type GlobalBackgroundJobHandlerBootstrapState = {
  __bbsBackgroundJobHandlersRegistered?: boolean
}

const globalForBackgroundJobHandlers = globalThis as typeof globalThis & GlobalBackgroundJobHandlerBootstrapState

export async function registerDefaultBackgroundJobHandlers() {
  if (globalForBackgroundJobHandlers.__bbsBackgroundJobHandlersRegistered) {
    return
  }

  await Promise.all([
    import("@/lib/ai-reply"),
    import("@/lib/background-task"),
    import("@/lib/check-in-streak-service"),
    import("@/lib/follow-notifications"),
    import("@/lib/interaction-side-effects"),
    import("@/lib/level-system"),
    import("@/lib/notification-writes"),
    import("@/lib/post-auctions"),
  ])

  globalForBackgroundJobHandlers.__bbsBackgroundJobHandlersRegistered = true
}
