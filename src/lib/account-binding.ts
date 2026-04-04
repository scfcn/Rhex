import { getExternalAuthProviderLabel } from "@/lib/auth-provider-config"
import { listExternalAuthAccountsByUserId, listPasskeyCredentialsByUserId } from "@/lib/external-auth-store"
import type { ExternalAuthProvider } from "@/lib/external-auth-types"
import type { SiteSettingsData } from "@/lib/site-settings"

interface ExternalAuthMetadata {
  displayName?: string | null
  avatarUrl?: string | null
  emailVerified?: boolean
}

function parseExternalAuthMetadata(metadataJson?: string | null): ExternalAuthMetadata {
  if (!metadataJson) {
    return {}
  }

  try {
    const parsed = JSON.parse(metadataJson) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return parsed as ExternalAuthMetadata
  } catch {
    return {}
  }
}

function getEnabledProviderFlag(
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled">,
  provider: ExternalAuthProvider,
) {
  return provider === "github" ? settings.authGithubEnabled : settings.authGoogleEnabled
}

export async function getUserAccountBindingView(
  userId: number,
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled" | "authPasskeyEnabled">,
) {
  const [accounts, passkeys] = await Promise.all([
    listExternalAuthAccountsByUserId(userId),
    listPasskeyCredentialsByUserId(userId),
  ])

  const providers = (["github", "google"] as const).map((provider) => {
    const account = accounts.find((item) => item.provider === provider) ?? null
    const metadata = parseExternalAuthMetadata(account?.metadataJson)

    return {
      provider,
      label: getExternalAuthProviderLabel(provider),
      enabled: getEnabledProviderFlag(settings, provider),
      accountId: account?.id ?? null,
      connected: Boolean(account),
      providerUsername: account?.providerUsername ?? null,
      providerEmail: account?.providerEmail ?? null,
      displayName: metadata.displayName ?? null,
      avatarUrl: metadata.avatarUrl ?? null,
      connectedAt: account?.createdAt.toISOString() ?? null,
    }
  })

  return {
    providers,
    passkey: {
      enabled: settings.authPasskeyEnabled,
      items: passkeys.map((credential, index) => ({
        id: credential.id,
        name: credential.name?.trim() || `Passkey ${index + 1}`,
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
        createdAt: credential.createdAt.toISOString(),
      })),
    },
  }
}
