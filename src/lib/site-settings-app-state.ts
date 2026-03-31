import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"

const SITE_SETTINGS_STATE_KEY = "__siteSettings"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseAppStateRoot(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readSiteSettingsState(raw: string | null | undefined) {
  const root = parseAppStateRoot(raw)
  const siteSettingsState = root[SITE_SETTINGS_STATE_KEY]
  return isRecord(siteSettingsState) ? siteSettingsState : {}
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  return parseNonNegativeSafeInteger(value) ?? fallback
}

export interface CheckInMakeUpPriceSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface CheckInRewardSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface NicknameChangePointCostSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface InviteCodePurchasePriceSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export function resolveCheckInRewardSettings(options: {
  appStateJson?: string | null
  normalReward: number
}): CheckInRewardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInRewards = isRecord(siteSettingsState.checkInRewards)
    ? siteSettingsState.checkInRewards
    : {}

  const normal = normalizeNonNegativeInteger(options.normalReward, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInRewards.vip1, normal),
    vip2: normalizeNonNegativeInteger(checkInRewards.vip2, normal),
    vip3: normalizeNonNegativeInteger(checkInRewards.vip3, normal),
  }
}

export function mergeCheckInRewardSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInRewardSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    checkInRewards: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveCheckInMakeUpPriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
  vipFallbackPrice: number
}): CheckInMakeUpPriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInMakeUpPrices = isRecord(siteSettingsState.checkInMakeUpPrices)
    ? siteSettingsState.checkInMakeUpPrices
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)
  const vipFallbackPrice = normalizeNonNegativeInteger(options.vipFallbackPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInMakeUpPrices.vip1, vipFallbackPrice),
    vip2: normalizeNonNegativeInteger(checkInMakeUpPrices.vip2, vipFallbackPrice),
    vip3: normalizeNonNegativeInteger(checkInMakeUpPrices.vip3, vipFallbackPrice),
  }
}

export function mergeCheckInMakeUpPriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInMakeUpPriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    checkInMakeUpPrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveNicknameChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): NicknameChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const nicknameChangePointCosts = isRecord(siteSettingsState.nicknameChangePointCosts)
    ? siteSettingsState.nicknameChangePointCosts
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(nicknameChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(nicknameChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(nicknameChangePointCosts.vip3, normal),
  }
}

export function mergeNicknameChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: Pick<NicknameChangePointCostSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    nicknameChangePointCosts: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveInviteCodePurchasePriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): InviteCodePurchasePriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const inviteCodePurchasePrices = isRecord(siteSettingsState.inviteCodePurchasePrices)
    ? siteSettingsState.inviteCodePurchasePrices
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip1, normal),
    vip2: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip2, normal),
    vip3: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip3, normal),
  }
}

export function mergeInviteCodePurchasePriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<InviteCodePurchasePriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    inviteCodePurchasePrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}
