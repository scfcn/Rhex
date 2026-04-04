const PROFILE_SETTINGS_KEY = "__profileSettings"
const RAW_SIGNATURE_KEY = "__rawSignatureText"

export interface UserProfileSettings {
  activityVisibilityPublic: boolean
  introduction: string
  externalNotificationEnabled: boolean
  notificationWebhookUrl: string
}

interface UserProfileSettingsInput {
  activityVisibilityPublic?: boolean
  introduction?: string
  externalNotificationEnabled?: boolean
  notificationWebhookUrl?: string
}

const defaultUserProfileSettings: UserProfileSettings = {
  activityVisibilityPublic: true,
  introduction: "",
  externalNotificationEnabled: false,
  notificationWebhookUrl: "",
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readSignatureEnvelope(signature: string | null | undefined) {
  if (!signature) {
    return { envelope: {} as Record<string, unknown>, rawSignatureText: "" }
  }

  try {
    const parsed = JSON.parse(signature)

    if (isPlainObject(parsed)) {
      return {
        envelope: parsed,
        rawSignatureText: typeof parsed[RAW_SIGNATURE_KEY] === "string" ? parsed[RAW_SIGNATURE_KEY] : "",
      }
    }
  } catch {
    // Keep plain text signatures intact by preserving them in a side channel.
  }

  return {
    envelope: {},
    rawSignatureText: signature,
  }
}

export function resolveUserProfileSettings(signature: string | null | undefined): UserProfileSettings {
  const { envelope, rawSignatureText } = readSignatureEnvelope(signature)
  const rawSettings = envelope[PROFILE_SETTINGS_KEY]

  if (!isPlainObject(rawSettings)) {
    return {
      ...defaultUserProfileSettings,
      introduction: rawSignatureText,
    }
  }

  return {
    activityVisibilityPublic:
      typeof rawSettings.activityVisibilityPublic === "boolean"
        ? rawSettings.activityVisibilityPublic
        : defaultUserProfileSettings.activityVisibilityPublic,
    introduction:
      typeof rawSettings.introduction === "string"
        ? rawSettings.introduction
        : rawSignatureText,
    externalNotificationEnabled:
      typeof rawSettings.externalNotificationEnabled === "boolean"
        ? rawSettings.externalNotificationEnabled
        : defaultUserProfileSettings.externalNotificationEnabled,
    notificationWebhookUrl:
      typeof rawSettings.notificationWebhookUrl === "string"
        ? rawSettings.notificationWebhookUrl.trim()
        : defaultUserProfileSettings.notificationWebhookUrl,
  }
}

export function mergeUserProfileSettings(signature: string | null | undefined, input: UserProfileSettingsInput) {
  const { envelope, rawSignatureText } = readSignatureEnvelope(signature)
  const current = resolveUserProfileSettings(signature)

  const nextSettings: UserProfileSettings = {
    activityVisibilityPublic: input.activityVisibilityPublic ?? current.activityVisibilityPublic,
    introduction: typeof input.introduction === "string" ? input.introduction.trim() : current.introduction,
    externalNotificationEnabled: input.externalNotificationEnabled ?? current.externalNotificationEnabled,
    notificationWebhookUrl:
      typeof input.notificationWebhookUrl === "string"
        ? input.notificationWebhookUrl.trim()
        : current.notificationWebhookUrl,
  }

  return JSON.stringify({
    ...envelope,
    ...(rawSignatureText ? { [RAW_SIGNATURE_KEY]: rawSignatureText } : {}),
    [PROFILE_SETTINGS_KEY]: nextSettings,
  })
}
