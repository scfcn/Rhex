export type PostDraftMode = "create" | "edit"

export interface LocalPostDraft {
  title: string
  content: string
  isAnonymous: boolean
  coverPath: string
  boardSlug: string
  postType: string
  bountyPoints: string
  pollOptions: string[]
  pollExpiresAt: string
  commentsVisibleToAuthorOnly: boolean
  loginUnlockContent: string
  replyUnlockContent: string
  purchaseUnlockContent: string
  purchasePrice: string
  minViewLevel: string
  minViewVipLevel: string
  manualTags: string[]
  lotteryStartsAt: string
  lotteryEndsAt: string
  lotteryParticipantGoal: string
  lotteryPrizes: Array<{ title: string; quantity: string; description: string }>
  lotteryConditions: Array<{ type: string; value: string; operator: string; description: string; groupKey: string }>
  redPacketEnabled: boolean
  redPacketMode: "RED_PACKET" | "JACKPOT"
  redPacketGrantMode: "FIXED" | "RANDOM"
  redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED" | "RANDOM"
  redPacketTriggerType: "REPLY" | "LIKE" | "FAVORITE"
  jackpotInitialPoints: string
  redPacketUnitPoints: string
  redPacketTotalPoints: string
  redPacketPacketCount: string
  attachments: Array<{
    id?: string
    sourceType: "UPLOAD" | "EXTERNAL_LINK"
    uploadId: string
    name: string
    externalUrl: string
    externalCode: string
    fileSize: number | null
    fileExt: string
    mimeType: string
    minDownloadLevel: string
    minDownloadVipLevel: string
    pointsCost: string
    requireReplyUnlock: boolean
  }>
}

export interface StoredLocalPostDraft {
  version: 1
  updatedAt: string
  mode: PostDraftMode
  postId: string | null
  data: LocalPostDraft
}

const STORAGE_KEY_PREFIX = "rhex:post-draft"

export function createEmptyLocalPostDraft(boardSlug = ""): LocalPostDraft {
  return {
    title: "",
    content: "",
    isAnonymous: false,
    coverPath: "",
    boardSlug,
    postType: "NORMAL",
    bountyPoints: "100",
    pollOptions: ["", ""],
    pollExpiresAt: "",
    commentsVisibleToAuthorOnly: false,
    loginUnlockContent: "",
    replyUnlockContent: "",
    purchaseUnlockContent: "",
    purchasePrice: "20",
    minViewLevel: "0",
    minViewVipLevel: "0",
    manualTags: [],
    lotteryStartsAt: "",
    lotteryEndsAt: "",
    lotteryParticipantGoal: "",
    lotteryPrizes: [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }],
    lotteryConditions: [{ type: "REPLY_CONTENT_LENGTH", value: "10", operator: "GTE", description: "回帖内容至少 10 字", groupKey: "default" }],
    redPacketEnabled: false,
    redPacketMode: "RED_PACKET",
    redPacketGrantMode: "FIXED",
    redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED",
    redPacketTriggerType: "REPLY",
    jackpotInitialPoints: "100",
    redPacketUnitPoints: "10",
    redPacketTotalPoints: "10",
    redPacketPacketCount: "1",
    attachments: [],
  }
}

function hasMeaningfulPostDraftContent(draft: LocalPostDraft, initialDraft: LocalPostDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initialDraft)
}


function buildDraftStorageKey(mode: PostDraftMode, postId?: string) {
  if (mode === "edit" && postId) {
    return `${STORAGE_KEY_PREFIX}:edit:${postId}`
  }

  return `${STORAGE_KEY_PREFIX}:create`
}

export function getPostDraftStorageKey(mode: PostDraftMode, postId?: string) {
  return buildDraftStorageKey(mode, postId)
}

export function savePostDraftToStorage(mode: PostDraftMode, draft: LocalPostDraft, initialDraft: LocalPostDraft, postId?: string) {
  if (typeof window === "undefined") {
    return null
  }

  const storageKey = buildDraftStorageKey(mode, postId)
  if (!hasMeaningfulPostDraftContent(draft, initialDraft)) {
    window.localStorage.removeItem(storageKey)
    return null
  }


  const payload: StoredLocalPostDraft = {
    version: 1,
    updatedAt: new Date().toISOString(),
    mode,
    postId: mode === "edit" ? postId ?? null : null,
    data: draft,
  }
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
  return payload
}

export function loadPostDraftFromStorage(mode: PostDraftMode, postId?: string): StoredLocalPostDraft | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(buildDraftStorageKey(mode, postId))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredLocalPostDraft
    if (parsed?.version !== 1 || !parsed.data) {
      return null
    }

    return {
      ...parsed,
      data: {
        ...createEmptyLocalPostDraft(parsed.data.boardSlug || ""),
        ...parsed.data,
        manualTags: Array.isArray(parsed.data.manualTags) ? parsed.data.manualTags.filter((item): item is string => typeof item === "string") : [],
        attachments: Array.isArray(parsed.data.attachments)
          ? parsed.data.attachments
              .filter((item): item is LocalPostDraft["attachments"][number] => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((item) => ({
                id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined,
                sourceType: (item.sourceType === "EXTERNAL_LINK" ? "EXTERNAL_LINK" : "UPLOAD") as "UPLOAD" | "EXTERNAL_LINK",
                uploadId: typeof item.uploadId === "string" ? item.uploadId : "",
                name: typeof item.name === "string" ? item.name : "",
                externalUrl: typeof item.externalUrl === "string" ? item.externalUrl : "",
                externalCode: typeof item.externalCode === "string" ? item.externalCode : "",
                fileSize: typeof item.fileSize === "number" && Number.isFinite(item.fileSize) ? item.fileSize : null,
                fileExt: typeof item.fileExt === "string" ? item.fileExt : "",
                mimeType: typeof item.mimeType === "string" ? item.mimeType : "",
                minDownloadLevel: typeof item.minDownloadLevel === "string" ? item.minDownloadLevel : "0",
                minDownloadVipLevel: typeof item.minDownloadVipLevel === "string" ? item.minDownloadVipLevel : "0",
                pointsCost: typeof item.pointsCost === "string" ? item.pointsCost : "0",
                requireReplyUnlock: Boolean(item.requireReplyUnlock),
              }) satisfies LocalPostDraft["attachments"][number])
          : [],
      },
    }
  } catch {
    return null
  }
}

export function clearPostDraftFromStorage(mode: PostDraftMode, postId?: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(buildDraftStorageKey(mode, postId))
}
