"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { MessageSquareMore } from "lucide-react"

import { MessageConversationSidebar } from "@/components/message-conversation-sidebar"
import { MessageThreadPanel } from "@/components/message-thread-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageBubbleItem, MessageCenterData, MessageHistoryResult, MessageStreamEvent } from "@/lib/message-types"

interface MessagesClientProps {
  currentUser: {
    id: number
  } | null
  initialData: MessageCenterData | null
  conversationId?: string
}

export function MessagesClient({ currentUser, initialData, conversationId }: MessagesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const connectionStateRef = useRef<"connecting" | "connected" | "closed">("connecting")
  const streamCursorRef = useRef<string | null>(null)
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const selectedConversationIdRef = useRef<string | undefined>(conversationId)
  const messagePromptAudioRef = useRef<HTMLAudioElement | null>(null)
  const previousUnreadConversationCountRef = useRef(0)
  const unreadTitleCountRef = useRef(0)
  const originalTitleRef = useRef("")
  const [deletingConversationId, setDeletingConversationId] = useState("")
  const [deletedConversationIds, setDeletedConversationIds] = useState<string[]>([])
  const [historyLoadingConversationId, setHistoryLoadingConversationId] = useState("")
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({})
  const [historyHasMoreByConversation, setHistoryHasMoreByConversation] = useState<Record<string, boolean>>({})
  const [historyMessagesByConversation, setHistoryMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [optimisticMessagesByConversation, setOptimisticMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})

  const data = useMemo(() => buildMessageCenterView(initialData, {
    deletedConversationIds,
    historyHasMoreByConversation,
    historyMessagesByConversation,
    optimisticMessagesByConversation,
  }), [deletedConversationIds, historyHasMoreByConversation, historyMessagesByConversation, initialData, optimisticMessagesByConversation])
  const currentUserId = currentUser?.id
  const shouldConnectMessageStream = Boolean(currentUserId && data && !data.usingDemoData)

  const activeConversationId = useMemo(() => {
    if (!data?.activeConversation) {
      return undefined
    }

    return data.activeConversation.id
  }, [data])

  const loadingHistory = historyLoadingConversationId !== "" && historyLoadingConversationId === activeConversationId
  const historyError = activeConversationId ? (historyErrors[activeConversationId] ?? "") : ""

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    selectedConversationIdRef.current = conversationId
  }, [activeConversationId, conversationId])

  function resetWindowAttention() {
    unreadTitleCountRef.current = 0

    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current
    }
  }

  function bumpWindowAttention() {
    if (typeof document === "undefined") {
      return
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title
    }

    unreadTitleCountRef.current += 1
    document.title = unreadTitleCountRef.current > 1 ? `有新消息（${unreadTitleCountRef.current}）` : "有新消息"
  }

  function handleLocalMessageSent(message: MessageBubbleItem) {
    const conversationKey = data?.activeConversation?.id
    if (!conversationKey) {
      return
    }

    setOptimisticMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: mergeMessages(current[conversationKey] ?? [], [message]),
    }))
  }

  async function handleLoadHistory() {
    const currentConversation = data?.activeConversation
    const oldestMessageId = currentConversation?.messages[0]?.id

    if (!currentConversation || !oldestMessageId || historyLoadingConversationId === currentConversation.id || !currentConversation.hasMoreHistory) {
      return
    }

    setHistoryLoadingConversationId(currentConversation.id)
    setHistoryErrors((current) => ({
      ...current,
      [currentConversation.id]: "",
    }))

    const response = await fetch("/api/messages/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: currentConversation.id,
        beforeMessageId: oldestMessageId,
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0) {
      setHistoryErrors((current) => ({
        ...current,
        [currentConversation.id]: payload?.message ?? "加载历史消息失败",
      }))
      setHistoryLoadingConversationId("")
      return
    }

    const result = payload?.data as MessageHistoryResult | undefined

    if (!result) {
      setHistoryLoadingConversationId("")
      return
    }

    setHistoryMessagesByConversation((current) => ({
      ...current,
      [currentConversation.id]: mergeMessages(result.messages, current[currentConversation.id] ?? []),
    }))
    setHistoryHasMoreByConversation((current) => ({
      ...current,
      [currentConversation.id]: result.hasMoreHistory,
    }))
    setHistoryLoadingConversationId("")
  }

  async function handleDeleteConversation(conversationIdToDelete: string) {
    setDeletingConversationId(conversationIdToDelete)

    const response = await fetch("/api/messages/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: conversationIdToDelete }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0) {
      setDeletingConversationId("")
      return
    }

    const nextConversations = data?.conversations.filter((conversation) => conversation.id !== conversationIdToDelete) ?? []
    const nextConversationId = nextConversations[0]?.id

    setDeletedConversationIds((current) => current.includes(conversationIdToDelete) ? current : [...current, conversationIdToDelete])

    setDeletingConversationId("")

    if (activeConversationId === conversationIdToDelete) {
      router.push(nextConversationId ? `/messages?conversation=${nextConversationId}` : "/messages", { scroll: false })
      return
    }

    router.refresh()
  }

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title
    }
  }, [])

  useEffect(() => {
    const audio = new Audio("/apps/messages/prompt.mp3")
    audio.preload = "auto"
    messagePromptAudioRef.current = audio

    const unlockAudio = () => {
      const target = messagePromptAudioRef.current
      if (!target) {
        return
      }

      target.muted = true
      target.currentTime = 0
      void target.play()
        .then(() => {
          target.pause()
          target.currentTime = 0
          target.muted = false
        })
        .catch(() => {
          target.muted = false
        })
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("keydown", unlockAudio)

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      audio.pause()
      messagePromptAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pathname === "/messages" && typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
      resetWindowAttention()
    }
  }, [pathname])

  useEffect(() => {
    const totalUnreadConversationCount = data?.conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) ?? 0
    const previousUnreadConversationCount = previousUnreadConversationCountRef.current

    if (totalUnreadConversationCount > previousUnreadConversationCount) {
      const audio = messagePromptAudioRef.current
      if (audio) {
        audio.currentTime = 0
        void audio.play().catch(() => undefined)
      }
    }

    previousUnreadConversationCountRef.current = totalUnreadConversationCount
  }, [data?.conversations])

  useEffect(() => {
    function handleWindowFocus() {
      resetWindowAttention()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetWindowAttention()
      }
    }

    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!shouldConnectMessageStream || !currentUserId) {
      connectionStateRef.current = "closed"
      reconnectAttemptRef.current = 0
      streamCursorRef.current = null
      return
    }

    let closed = false
    let eventSource: EventSource | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (closed || reconnectTimerRef.current) {
        return
      }

      connectionStateRef.current = "connecting"
      const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttemptRef.current)
      reconnectAttemptRef.current += 1

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const handleMessage = (event: MessageEvent<string>) => {
      let payload: MessageStreamEvent

      try {
        payload = JSON.parse(event.data) as MessageStreamEvent
      } catch {
        return
      }

      if (payload.type === "heartbeat" || payload.senderId === currentUserId) {
        return
      }

      const selectedConversation = selectedConversationIdRef.current
      const activeConversation = activeConversationIdRef.current
      const shouldRefresh = !selectedConversation || payload.conversationId === activeConversation || payload.recipientId === currentUserId

      if (!document.hasFocus() || document.visibilityState !== "visible") {
        bumpWindowAttention()
      }

      if (shouldRefresh) {
        router.refresh()
      }
    }

    const handleCursor = (event: Event) => {
      let payload: { cursor?: string }

      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as { cursor?: string }
      } catch {
        return
      }

      if (typeof payload.cursor === "string" && payload.cursor) {
        streamCursorRef.current = payload.cursor
      }
    }

    const connect = () => {
      if (closed) {
        return
      }

      clearReconnectTimer()
      connectionStateRef.current = "connecting"

      const streamUrl = new URL("/api/messages/stream", window.location.origin)
      if (streamCursorRef.current) {
        streamUrl.searchParams.set("cursor", streamCursorRef.current)
      }

      eventSource = new EventSource(streamUrl)

      eventSource.onopen = () => {
        reconnectAttemptRef.current = 0
        connectionStateRef.current = "connected"
      }

      eventSource.onmessage = handleMessage
      eventSource.addEventListener("cursor", handleCursor as EventListener)
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }

        scheduleReconnect()
      }
    }

    connect()

    return () => {
      closed = true
      clearReconnectTimer()
      reconnectAttemptRef.current = 0
      connectionStateRef.current = "closed"
      eventSource?.close()
    }
  }, [currentUserId, router, shouldConnectMessageStream])

  const isMobileThreadVisible = Boolean(data?.activeConversation)

  return (
    <main className="mx-auto max-w-[1240px] px-0 py-0 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      {!currentUser ? (
        <Card>
          <CardHeader>
            <CardTitle>站内私信</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>请先登录后查看私信列表和聊天记录。</p>
            <Link href="/login">
              <Button className="rounded-full">前往登录</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !data ? null : (
        <>
          <div className={isMobileThreadVisible ? "hidden sm:mb-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
            <div>
              <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
                <MessageSquareMore className="h-7 w-7" />
                站内私信
              </h1>
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <MessageConversationSidebar
              conversations={data.conversations}
              activeConversationId={data.activeConversation?.id}
              deletingConversationId={deletingConversationId}
              onDeleteConversation={handleDeleteConversation}
              mobileHidden={isMobileThreadVisible}
            />
            <div className={isMobileThreadVisible ? "block" : "hidden xl:block"}>
              <MessageThreadPanel
                conversation={data.activeConversation}
                currentUserId={currentUser.id}
                usingDemoData={data.usingDemoData}
                onMessageSent={handleLocalMessageSent}
                onLoadHistory={handleLoadHistory}
                loadingHistory={loadingHistory}
                historyError={historyError}
                onBack={data.activeConversation ? () => router.push("/messages", { scroll: false }) : undefined}
              />
            </div>
          </div>
        </>
      )}
    </main>
  )
}

function buildMessageCenterView(initialData: MessageCenterData | null, patches: {
  deletedConversationIds: string[]
  historyHasMoreByConversation: Record<string, boolean>
  historyMessagesByConversation: Record<string, MessageBubbleItem[]>
  optimisticMessagesByConversation: Record<string, MessageBubbleItem[]>
}): MessageCenterData | null {
  if (!initialData) {
    return null
  }

  const deletedConversationIdSet = new Set(patches.deletedConversationIds)
  const conversations = initialData.conversations
    .filter((conversation) => !deletedConversationIdSet.has(conversation.id))
    .map((conversation) => {
      const optimisticMessages = patches.optimisticMessagesByConversation[conversation.id] ?? []
      const latestOptimisticMessage = optimisticMessages.at(-1)

      if (!latestOptimisticMessage) {
        return conversation
      }

      return {
        ...conversation,
        preview: latestOptimisticMessage.body,
        updatedAt: latestOptimisticMessage.createdAt,
        unreadCount: 0,
      }
    })

  if (!initialData.activeConversation || deletedConversationIdSet.has(initialData.activeConversation.id)) {
    return {
      ...initialData,
      conversations,
      activeConversation: null,
    }
  }

  const activeConversationId = initialData.activeConversation.id
  const historyMessages = patches.historyMessagesByConversation[activeConversationId] ?? []
  const optimisticMessages = patches.optimisticMessagesByConversation[activeConversationId] ?? []
  const messages = mergeMessages(historyMessages, initialData.activeConversation.messages, optimisticMessages)

  return {
    ...initialData,
    conversations,
    activeConversation: {
      ...initialData.activeConversation,
      subtitle: optimisticMessages.length > 0 ? "实时会话" : initialData.activeConversation.subtitle,
      updatedAt: optimisticMessages.at(-1)?.createdAt ?? initialData.activeConversation.updatedAt,
      messages,
      hasMoreHistory: patches.historyHasMoreByConversation[activeConversationId] ?? initialData.activeConversation.hasMoreHistory,
    },
  }
}

function mergeMessages(...messageGroups: MessageBubbleItem[][]) {
  const seenMessageIds = new Set<string>()
  const mergedMessages: MessageBubbleItem[] = []

  for (const group of messageGroups) {
    for (const message of group) {
      if (seenMessageIds.has(message.id)) {
        continue
      }

      seenMessageIds.add(message.id)
      mergedMessages.push(message)
    }
  }

  return mergedMessages
}
