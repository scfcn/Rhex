"use client"

import Image from "next/image"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { POST_LIST_LOAD_MODE_PAGINATION, type PostListLoadMode } from "@/lib/post-list-load-mode"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY, type PostListDisplayMode } from "@/lib/post-list-display"
import type { InteractionGateCondition, InteractionGateSettings } from "@/lib/site-settings"
import type { SiteSearchSettings, SiteTippingGiftItem } from "@/lib/site-settings"

export interface AdminBasicSettingsInitialSettings {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords?: string[]
  postLinkDisplayMode: "SLUG" | "ID"
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: number
  zonePostPageSize: number
  boardPostPageSize: number
  homeSidebarHotTopicsCount: number
  postSidebarRelatedTopicsCount: number
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  search: SiteSearchSettings
  analyticsCode?: string | null
  inviteRewardInviter: number
  inviteRewardInvitee: number
  registerInitialPoints: number
  registrationEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  inviteCodePurchaseEnabled: boolean
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey?: string | null
  turnstileSecretKey?: string | null
  postEditableMinutes: number
  commentEditableMinutes: number
  guestCanViewComments: boolean
  interactionGates: InteractionGateSettings
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: number[]
  tippingGifts: SiteTippingGiftItem[]
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: number
  postRedPacketDailyLimit: number
  postRedPacketRandomClaimProbability: number
  postJackpotEnabled: boolean
  postJackpotMinInitialPoints: number
  postJackpotMaxInitialPoints: number
  postJackpotReplyIncrementPoints: number
  postJackpotHitProbability: number
  heatViewWeight: number
  heatCommentWeight: number
  heatLikeWeight: number
  heatTipCountWeight: number
  heatTipPointsWeight: number
  homeHotRecentWindowHours: number
  heatStageThresholds: number[]
  heatStageColors: string[]
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  githubClientId?: string | null
  githubClientSecret?: string | null
  googleClientId?: string | null
  googleClientSecret?: string | null
  passkeyRpId?: string | null
  passkeyRpName?: string | null
  passkeyOrigin?: string | null
  smtpEnabled: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure: boolean
}

export type AdminBasicSettingsMode = "profile" | "registration" | "interaction"

export interface AdminBasicSettingsDraft {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath: string
  siteSeoKeywords: string
  postLinkDisplayMode: "SLUG" | "ID"
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: string
  zonePostPageSize: string
  boardPostPageSize: string
  homeSidebarHotTopicsCount: string
  postSidebarRelatedTopicsCount: string
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  searchEnabled: boolean
  analyticsCode: string
  postEditableMinutes: string
  commentEditableMinutes: string
  guestCanViewComments: boolean
  postCreateRequireEmailVerified: boolean
  commentCreateRequireEmailVerified: boolean
  postCreateMinRegisteredMinutes: string
  commentCreateMinRegisteredMinutes: string
  inviteRewardInviter: string
  inviteRewardInvitee: string
  registerInitialPoints: string
  registrationEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  inviteCodePurchaseEnabled: boolean
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey: string
  turnstileSecretKey: string
  tippingEnabled: boolean
  tippingDailyLimit: string
  tippingPerPostLimit: string
  tippingAmounts: string
  tippingGifts: SiteTippingGiftItem[]
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: string
  postRedPacketDailyLimit: string
  postRedPacketRandomClaimProbability: string
  postJackpotEnabled: boolean
  postJackpotMinInitialPoints: string
  postJackpotMaxInitialPoints: string
  postJackpotReplyIncrementPoints: string
  postJackpotHitProbability: string
  heatViewWeight: string
  heatCommentWeight: string
  heatLikeWeight: string
  heatTipCountWeight: string
  heatTipPointsWeight: string
  homeHotRecentWindowHours: string
  heatStageThresholds: string
  heatStageColors: string[]
  previewViews: string
  previewComments: string
  previewLikes: string
  previewTipCount: string
  previewTipPoints: string
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  githubClientId: string
  githubClientSecret: string
  googleClientId: string
  googleClientSecret: string
  passkeyRpId: string
  passkeyRpName: string
  passkeyOrigin: string
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure: boolean
}

function getRegisteredMinutesConditionValue(settings: InteractionGateSettings, action: "POST_CREATE" | "COMMENT_CREATE") {
  const condition = settings.actions[action].conditions.find((item): item is Extract<InteractionGateCondition, { type: "REGISTERED_MINUTES" }> => item.type === "REGISTERED_MINUTES")
  return condition?.value ?? 0
}

export function createAdminBasicSettingsDraft(initialSettings: AdminBasicSettingsInitialSettings): AdminBasicSettingsDraft {
  const postCreateConditions = initialSettings.interactionGates.actions.POST_CREATE.conditions
  const commentCreateConditions = initialSettings.interactionGates.actions.COMMENT_CREATE.conditions
  const postCreateRequireEmailVerified = postCreateConditions.some((condition) => condition.type === "EMAIL_VERIFIED")
  const commentCreateRequireEmailVerified = commentCreateConditions.some((condition) => condition.type === "EMAIL_VERIFIED")
  const postCreateMinRegisteredMinutes = getRegisteredMinutesConditionValue(initialSettings.interactionGates, "POST_CREATE")
  const commentCreateMinRegisteredMinutes = getRegisteredMinutesConditionValue(initialSettings.interactionGates, "COMMENT_CREATE")

  return {
    siteName: initialSettings.siteName,
    siteSlogan: initialSettings.siteSlogan,
    siteDescription: initialSettings.siteDescription,
    siteLogoText: initialSettings.siteLogoText,
    siteLogoPath: initialSettings.siteLogoPath ?? "",
    siteSeoKeywords: (initialSettings.siteSeoKeywords ?? []).join(","),
    postLinkDisplayMode: initialSettings.postLinkDisplayMode,
    homeFeedPostListDisplayMode: initialSettings.homeFeedPostListDisplayMode,
    homeFeedPostListLoadMode: initialSettings.homeFeedPostListLoadMode,
    homeFeedPostPageSize: String(initialSettings.homeFeedPostPageSize),
    zonePostPageSize: String(initialSettings.zonePostPageSize),
    boardPostPageSize: String(initialSettings.boardPostPageSize),
    homeSidebarHotTopicsCount: String(initialSettings.homeSidebarHotTopicsCount),
    postSidebarRelatedTopicsCount: String(initialSettings.postSidebarRelatedTopicsCount),
    homeSidebarStatsCardEnabled: initialSettings.homeSidebarStatsCardEnabled,
    homeSidebarAnnouncementsEnabled: initialSettings.homeSidebarAnnouncementsEnabled,
    searchEnabled: initialSettings.search.enabled,
    analyticsCode: initialSettings.analyticsCode ?? "",
    postEditableMinutes: String(initialSettings.postEditableMinutes),
    commentEditableMinutes: String(initialSettings.commentEditableMinutes),
    guestCanViewComments: initialSettings.guestCanViewComments,
    postCreateRequireEmailVerified,
    commentCreateRequireEmailVerified,
    postCreateMinRegisteredMinutes: String(postCreateMinRegisteredMinutes),
    commentCreateMinRegisteredMinutes: String(commentCreateMinRegisteredMinutes),
    inviteRewardInviter: String(initialSettings.inviteRewardInviter),
    inviteRewardInvitee: String(initialSettings.inviteRewardInvitee),
    registerInitialPoints: String(initialSettings.registerInitialPoints),
    registrationEnabled: initialSettings.registrationEnabled,
    registrationRequireInviteCode: initialSettings.registrationRequireInviteCode,
    registerInviteCodeEnabled: initialSettings.registerInviteCodeEnabled,
    inviteCodePurchaseEnabled: initialSettings.inviteCodePurchaseEnabled,
    registerCaptchaMode: initialSettings.registerCaptchaMode,
    loginCaptchaMode: initialSettings.loginCaptchaMode,
    turnstileSiteKey: initialSettings.turnstileSiteKey ?? "",
    turnstileSecretKey: initialSettings.turnstileSecretKey ?? "",
    tippingEnabled: initialSettings.tippingEnabled,
    tippingDailyLimit: String(initialSettings.tippingDailyLimit),
    tippingPerPostLimit: String(initialSettings.tippingPerPostLimit),
    tippingAmounts: initialSettings.tippingAmounts.join(","),
    tippingGifts: initialSettings.tippingGifts,
    postRedPacketEnabled: initialSettings.postRedPacketEnabled,
    postRedPacketMaxPoints: String(initialSettings.postRedPacketMaxPoints),
    postRedPacketDailyLimit: String(initialSettings.postRedPacketDailyLimit),
    postRedPacketRandomClaimProbability: String(initialSettings.postRedPacketRandomClaimProbability),
    postJackpotEnabled: initialSettings.postJackpotEnabled,
    postJackpotMinInitialPoints: String(initialSettings.postJackpotMinInitialPoints),
    postJackpotMaxInitialPoints: String(initialSettings.postJackpotMaxInitialPoints),
    postJackpotReplyIncrementPoints: String(initialSettings.postJackpotReplyIncrementPoints),
    postJackpotHitProbability: String(initialSettings.postJackpotHitProbability),
    heatViewWeight: String(initialSettings.heatViewWeight),
    heatCommentWeight: String(initialSettings.heatCommentWeight),
    heatLikeWeight: String(initialSettings.heatLikeWeight),
    heatTipCountWeight: String(initialSettings.heatTipCountWeight),
    heatTipPointsWeight: String(initialSettings.heatTipPointsWeight),
    homeHotRecentWindowHours: String(initialSettings.homeHotRecentWindowHours),
    heatStageThresholds: initialSettings.heatStageThresholds.join(","),
    heatStageColors: initialSettings.heatStageColors,
    previewViews: "120",
    previewComments: "18",
    previewLikes: "12",
    previewTipCount: "4",
    previewTipPoints: "160",
    registerEmailEnabled: initialSettings.registerEmailEnabled,
    registerEmailRequired: initialSettings.registerEmailRequired,
    registerEmailVerification: initialSettings.registerEmailVerification,
    registerPhoneEnabled: initialSettings.registerPhoneEnabled,
    registerPhoneRequired: initialSettings.registerPhoneRequired,
    registerPhoneVerification: initialSettings.registerPhoneVerification,
    registerNicknameEnabled: initialSettings.registerNicknameEnabled,
    registerNicknameRequired: initialSettings.registerNicknameRequired,
    registerGenderEnabled: initialSettings.registerGenderEnabled,
    registerGenderRequired: initialSettings.registerGenderRequired,
    registerInviterEnabled: initialSettings.registerInviterEnabled,
    authGithubEnabled: initialSettings.authGithubEnabled,
    authGoogleEnabled: initialSettings.authGoogleEnabled,
    authPasskeyEnabled: initialSettings.authPasskeyEnabled,
    githubClientId: initialSettings.githubClientId ?? "",
    githubClientSecret: initialSettings.githubClientSecret ?? "",
    googleClientId: initialSettings.googleClientId ?? "",
    googleClientSecret: initialSettings.googleClientSecret ?? "",
    passkeyRpId: initialSettings.passkeyRpId ?? "",
    passkeyRpName: initialSettings.passkeyRpName ?? "",
    passkeyOrigin: initialSettings.passkeyOrigin ?? "",
    smtpEnabled: initialSettings.smtpEnabled,
    smtpHost: initialSettings.smtpHost ?? "",
    smtpPort: initialSettings.smtpPort ? String(initialSettings.smtpPort) : "",
    smtpUser: initialSettings.smtpUser ?? "",
    smtpPass: initialSettings.smtpPass ?? "",
    smtpFrom: initialSettings.smtpFrom ?? "",
    smtpSecure: initialSettings.smtpSecure,
  }
}

export function buildAdminBasicSettingsPayload(draft: AdminBasicSettingsDraft, mode: AdminBasicSettingsMode) {
  if (mode === "profile") {
    return {
      siteName: draft.siteName,
      siteSlogan: draft.siteSlogan,
      siteDescription: draft.siteDescription,
      siteLogoText: draft.siteLogoText,
      siteLogoPath: draft.siteLogoPath,
      siteSeoKeywords: draft.siteSeoKeywords,
      postLinkDisplayMode: draft.postLinkDisplayMode,
      homeFeedPostListDisplayMode: draft.homeFeedPostListDisplayMode,
      homeFeedPostListLoadMode: draft.homeFeedPostListLoadMode ?? POST_LIST_LOAD_MODE_PAGINATION,
      homeFeedPostPageSize: Number(draft.homeFeedPostPageSize),
      zonePostPageSize: Number(draft.zonePostPageSize),
      boardPostPageSize: Number(draft.boardPostPageSize),
      homeSidebarHotTopicsCount: Number(draft.homeSidebarHotTopicsCount),
      postSidebarRelatedTopicsCount: Number(draft.postSidebarRelatedTopicsCount),
      homeSidebarStatsCardEnabled: draft.homeSidebarStatsCardEnabled,
      homeSidebarAnnouncementsEnabled: draft.homeSidebarAnnouncementsEnabled,
      searchEnabled: draft.searchEnabled,
      analyticsCode: draft.analyticsCode,
      postEditableMinutes: Number(draft.postEditableMinutes),
      commentEditableMinutes: Number(draft.commentEditableMinutes),
      section: "site-profile",
    }
  }

  if (mode === "registration") {
    return {
      inviteRewardInviter: Number(draft.inviteRewardInviter),
      inviteRewardInvitee: Number(draft.inviteRewardInvitee),
      registerInitialPoints: Number(draft.registerInitialPoints),
      registrationEnabled: draft.registrationEnabled,
      registrationRequireInviteCode: draft.registrationRequireInviteCode,
      registerInviteCodeEnabled: draft.registerInviteCodeEnabled,
      inviteCodePurchaseEnabled: draft.inviteCodePurchaseEnabled,
      registerCaptchaMode: draft.registerCaptchaMode,
      loginCaptchaMode: draft.loginCaptchaMode,
      turnstileSiteKey: draft.turnstileSiteKey,
      turnstileSecretKey: draft.turnstileSecretKey,
      registerEmailEnabled: draft.registerEmailEnabled,
      registerEmailRequired: draft.registerEmailRequired,
      registerEmailVerification: draft.registerEmailVerification,
      registerPhoneEnabled: draft.registerPhoneEnabled,
      registerPhoneRequired: draft.registerPhoneRequired,
      registerPhoneVerification: draft.registerPhoneVerification,
      registerNicknameEnabled: draft.registerNicknameEnabled,
      registerNicknameRequired: draft.registerNicknameRequired,
      registerGenderEnabled: draft.registerGenderEnabled,
      registerGenderRequired: draft.registerGenderRequired,
      registerInviterEnabled: draft.registerInviterEnabled,
      authGithubEnabled: draft.authGithubEnabled,
      authGoogleEnabled: draft.authGoogleEnabled,
      authPasskeyEnabled: draft.authPasskeyEnabled,
      githubClientId: draft.githubClientId,
      githubClientSecret: draft.githubClientSecret,
      googleClientId: draft.googleClientId,
      googleClientSecret: draft.googleClientSecret,
      passkeyRpId: draft.passkeyRpId,
      passkeyRpName: draft.passkeyRpName,
      passkeyOrigin: draft.passkeyOrigin,
      smtpEnabled: draft.smtpEnabled,
      smtpHost: draft.smtpHost,
      smtpPort: Number(draft.smtpPort),
      smtpUser: draft.smtpUser,
      smtpPass: draft.smtpPass,
      smtpFrom: draft.smtpFrom,
      smtpSecure: draft.smtpSecure,
      section: "site-registration",
    }
  }

  return {
    tippingEnabled: draft.tippingEnabled,
    guestCanViewComments: draft.guestCanViewComments,
    postCreateRequireEmailVerified: draft.postCreateRequireEmailVerified,
    commentCreateRequireEmailVerified: draft.commentCreateRequireEmailVerified,
    postCreateMinRegisteredMinutes: Number(draft.postCreateMinRegisteredMinutes),
    commentCreateMinRegisteredMinutes: Number(draft.commentCreateMinRegisteredMinutes),
    tippingDailyLimit: Number(draft.tippingDailyLimit),
    tippingPerPostLimit: Number(draft.tippingPerPostLimit),
    tippingAmounts: draft.tippingAmounts,
    tippingGifts: draft.tippingGifts,
    postRedPacketEnabled: draft.postRedPacketEnabled,
    postRedPacketMaxPoints: Number(draft.postRedPacketMaxPoints),
    postRedPacketDailyLimit: Number(draft.postRedPacketDailyLimit),
    postRedPacketRandomClaimProbability: Number(draft.postRedPacketRandomClaimProbability),
    postJackpotEnabled: draft.postJackpotEnabled,
    postJackpotMinInitialPoints: Number(draft.postJackpotMinInitialPoints),
    postJackpotMaxInitialPoints: Number(draft.postJackpotMaxInitialPoints),
    postJackpotReplyIncrementPoints: Number(draft.postJackpotReplyIncrementPoints),
    postJackpotHitProbability: Number(draft.postJackpotHitProbability),
    heatViewWeight: Number(draft.heatViewWeight),
    heatCommentWeight: Number(draft.heatCommentWeight),
    heatLikeWeight: Number(draft.heatLikeWeight),
    heatTipCountWeight: Number(draft.heatTipCountWeight),
    heatTipPointsWeight: Number(draft.heatTipPointsWeight),
    homeHotRecentWindowHours: Number(draft.homeHotRecentWindowHours),
    heatStageThresholds: draft.heatStageThresholds,
    heatStageColors: draft.heatStageColors.join(","),
    section: "site-interaction",
  }
}

export interface AdminSiteSettingsInitialSettings {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords?: string[]
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  postOfflinePrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  uploadProvider: string
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
}

export interface AdminSiteSettingsDraft {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath: string
  vipMonthlyPrice: string
  vipQuarterlyPrice: string
  vipYearlyPrice: string
  postOfflinePrice: string
  postOfflineVip1Price: string
  postOfflineVip2Price: string
  postOfflineVip3Price: string
  uploadProvider: string
  uploadLocalPath: string
  uploadBaseUrl: string
  uploadOssBucket: string
  uploadOssRegion: string
  uploadOssEndpoint: string
}

export function createAdminSiteSettingsDraft(initialSettings: AdminSiteSettingsInitialSettings): AdminSiteSettingsDraft {
  return {
    siteName: initialSettings.siteName,
    siteSlogan: initialSettings.siteSlogan,
    siteDescription: initialSettings.siteDescription,
    siteLogoText: initialSettings.siteLogoText,
    siteLogoPath: initialSettings.siteLogoPath ?? "",
    vipMonthlyPrice: String(initialSettings.vipMonthlyPrice),
    vipQuarterlyPrice: String(initialSettings.vipQuarterlyPrice),
    vipYearlyPrice: String(initialSettings.vipYearlyPrice),
    postOfflinePrice: String(initialSettings.postOfflinePrice),
    postOfflineVip1Price: String(initialSettings.postOfflineVip1Price),
    postOfflineVip2Price: String(initialSettings.postOfflineVip2Price),
    postOfflineVip3Price: String(initialSettings.postOfflineVip3Price),
    uploadProvider: initialSettings.uploadProvider,
    uploadLocalPath: initialSettings.uploadLocalPath,
    uploadBaseUrl: initialSettings.uploadBaseUrl ?? "",
    uploadOssBucket: initialSettings.uploadOssBucket ?? "",
    uploadOssRegion: initialSettings.uploadOssRegion ?? "",
    uploadOssEndpoint: initialSettings.uploadOssEndpoint ?? "",
  }
}

export function buildAdminSiteSettingsPayload(draft: AdminSiteSettingsDraft) {
  return {
    siteName: draft.siteName,
    siteSlogan: draft.siteSlogan,
    siteDescription: draft.siteDescription,
    siteLogoText: draft.siteLogoText,
    siteLogoPath: draft.siteLogoPath,
    vipMonthlyPrice: Number(draft.vipMonthlyPrice),
    vipQuarterlyPrice: Number(draft.vipQuarterlyPrice),
    vipYearlyPrice: Number(draft.vipYearlyPrice),
    postOfflinePrice: Number(draft.postOfflinePrice),
    postOfflineVip1Price: Number(draft.postOfflineVip1Price),
    postOfflineVip2Price: Number(draft.postOfflineVip2Price),
    postOfflineVip3Price: Number(draft.postOfflineVip3Price),
    uploadProvider: draft.uploadProvider,
    uploadLocalPath: draft.uploadLocalPath,
    uploadBaseUrl: draft.uploadBaseUrl,
    uploadOssBucket: draft.uploadOssBucket,
    uploadOssRegion: draft.uploadOssRegion,
    uploadOssEndpoint: draft.uploadOssEndpoint,
  }
}

export async function uploadSiteLogoFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请先选择图片格式的站点 Logo")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", "site-logo")

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  })
  const result = await response.json()

  if (!response.ok || result.code !== 0) {
    throw new Error(result.message ?? "站点 Logo 上传失败")
  }

  return String(result.data?.urlPath ?? "")
}

export function SiteLogoUploadCard({
  value,
  uploading,
  onValueChange,
  onUpload,
  onClear,
}: {
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  return (
    <div className="space-y-3 rounded-[24px] border border-border p-5">
      <div>
        <h4 className="text-sm font-semibold">站点 Logo</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">支持上传图片或直接填写图片地址；未设置时，前台继续使用默认 SVG 图标。</p>
      </div>
      <div className="space-y-3 rounded-[18px] border border-dashed border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "上传中..." : "上传站点 Logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void onUpload(file)
                }
                event.target.value = ""
              }}
            />
          </label>
          <Button type="button" variant="ghost" disabled={!value || uploading} onClick={onClear}>清空图片 Logo</Button>
        </div>
        <input value={value} onChange={(event) => onValueChange(event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="或直接填写站点 Logo 地址" />
        {value ? (
          <div className="relative h-16 w-40 overflow-hidden rounded-xl border border-border bg-white p-2">
            <Image src={value} alt="站点 Logo 预览" fill sizes="160px" className="object-contain" unoptimized />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function resolveHomeFeedPostListDisplayMode(value: string) {
  return value === POST_LIST_DISPLAY_MODE_DEFAULT ? POST_LIST_DISPLAY_MODE_DEFAULT : POST_LIST_DISPLAY_MODE_GALLERY
}
