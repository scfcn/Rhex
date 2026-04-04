import { compareSync, hashSync } from "bcryptjs"
import { randomBytes } from "node:crypto"

import type { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { createSystemNotification } from "@/lib/notification-writes"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { createExternalAuthAccount, createPasskeyCredential, deleteExternalAuthAccountsByUserIdAndProvider, deletePasskeyCredentialByIdAndUserId, findExternalAuthAccount, findExternalAuthAccountByUserIdAndProvider, findPasskeyCredentialByCredentialId } from "@/lib/external-auth-store"
import { getExternalAuthProviderLabel } from "@/lib/auth-provider-config"
import type { ExternalAuthIdentity, ExternalOAuthProfile, PendingExternalAuthState } from "@/lib/external-auth-types"
import type { SiteSettingsData } from "@/lib/site-settings"
import type { StoredPasskeyCredential } from "@/lib/external-auth-store"
import type { ExternalAuthProvider } from "@/lib/external-auth-types"

interface AuthenticatedUserSummary {
  id: number
  username: string
}

interface ExternalAuthPendingResult {
  kind: "pending"
  state: PendingExternalAuthState
}

interface ExternalAuthAuthenticatedResult {
  kind: "authenticated"
  user: AuthenticatedUserSummary
  created: boolean
}

export type ExternalAuthResolutionResult = ExternalAuthPendingResult | ExternalAuthAuthenticatedResult

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value)
}

function trimNormalizedEmail(email?: string | null) {
  const normalized = email?.trim()
  return normalized ? normalized : null
}

function buildRandomPassword() {
  return randomBytes(24).toString("base64url")
}

function normalizeAsciiValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
}

function fitUsernameLength(base: string, suffix = "") {
  const maxBaseLength = Math.max(3, 20 - suffix.length)
  const normalizedBase = base.slice(0, maxBaseLength).replace(/^_+|_+$/g, "") || "user"
  const combined = `${normalizedBase}${suffix}`.slice(0, 20)
  return combined.length >= 3 ? combined : `${combined}${"0".repeat(3 - combined.length)}`
}

export function normalizeExternalUsernameCandidate(value: string) {
  const ascii = normalizeAsciiValue(value)
  const normalized = ascii
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!normalized) {
    return ""
  }

  return fitUsernameLength(normalized)
}

async function isUsernameAvailable(username: string) {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  return !existing
}

export async function buildUsernameSuggestions(base: string, minimumCount = 4) {
  const normalizedBase = normalizeExternalUsernameCandidate(base) || "user"
  const candidatePool = new Set<string>()

  for (let index = 0; candidatePool.size < 16 && index < 64; index += 1) {
    const suffix = index === 0 ? "" : `_${Math.floor(100 + Math.random() * 900)}`
    candidatePool.add(fitUsernameLength(normalizedBase, suffix))
  }

  const candidates = Array.from(candidatePool)
  const existingUsers = await prisma.user.findMany({
    where: {
      username: {
        in: candidates,
      },
    },
    select: {
      username: true,
    },
  })
  const taken = new Set(existingUsers.map((item) => item.username))

  const available = candidates.filter((item) => !taken.has(item))

  while (available.length < minimumCount) {
    const fallback = fitUsernameLength("user", `_${Math.floor(1000 + Math.random() * 9000)}`)
    if (!available.includes(fallback) && !taken.has(fallback)) {
      available.push(fallback)
    }
  }

  return available.slice(0, minimumCount)
}

function resolveUsernameBase(identity: Pick<ExternalAuthIdentity, "providerUsername" | "displayName" | "providerEmail">) {
  const emailLocalPart = identity.providerEmail?.split("@")[0]?.trim() ?? ""
  return identity.providerUsername?.trim()
    || identity.displayName?.trim()
    || emailLocalPart
    || "user"
}

async function buildPendingState(identity: ExternalAuthIdentity, emailConflictUserId?: number, inviteCodeRequired = false) {
  const usernameCandidate = normalizeExternalUsernameCandidate(resolveUsernameBase(identity))
  const usernameSuggestions = await buildUsernameSuggestions(usernameCandidate || "user")

  if (emailConflictUserId && identity.providerEmail) {
    return {
      kind: "email_bind_required",
      ...identity,
      conflictUserId: emailConflictUserId,
      conflictEmail: identity.providerEmail,
      usernameCandidate: usernameCandidate || usernameSuggestions[0] || "user001",
      usernameSuggestions,
    } satisfies PendingExternalAuthState
  }

  return {
    kind: "username_required",
    ...identity,
    usernameCandidate: usernameCandidate || usernameSuggestions[0] || "user001",
    usernameSuggestions,
    inviteCodeRequired,
  } satisfies PendingExternalAuthState
}

async function createUserFromIdentity(input: {
  identity: ExternalAuthIdentity
  username: string
  inviteCode?: string
  request: Request
  siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">
}) {
  if (!input.siteSettings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  const inviteCode = input.inviteCode?.trim().toUpperCase() ?? ""

  if (input.siteSettings.registrationRequireInviteCode && !inviteCode) {
    apiError(400, "当前注册必须填写邀请码")
  }

  if (!isValidUsername(input.username)) {
    apiError(400, "用户名需为 3-20 位字母、数字或下划线")
  }

  if (!(await isUsernameAvailable(input.username))) {
    apiError(409, "用户名已存在")
  }

  const email = trimNormalizedEmail(input.identity.providerEmail)
  if (email) {
    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailOwner) {
      apiError(409, "邮箱已被使用，请绑定已有账户")
    }
  }

  const randomPassword = buildRandomPassword()
  const loginIp = getRequestIp(input.request)
  const userAgent = input.request.headers.get("user-agent")
  const inviterReward = Math.max(0, input.siteSettings.inviteRewardInviter)
  const inviteeReward = Math.max(0, input.siteSettings.inviteRewardInvitee)
  const registerInitialPoints = Math.max(0, input.siteSettings.registerInitialPoints)

  const user = await prisma.$transaction(async (tx) => {
    let inviter: null | { id: number; username: string; points: number } = null
    let inviteCodeRecord: null | { id: string; code: string } = null

    if (inviteCode) {
      const foundCode = await tx.inviteCode.findUnique({
        where: { code: inviteCode },
        select: {
          id: true,
          code: true,
          usedById: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              points: true,
            },
          },
        },
      })

      if (!foundCode) {
        apiError(404, "邀请码不存在")
      }

      if (foundCode.usedById) {
        apiError(409, "邀请码已被使用")
      }

      inviteCodeRecord = { id: foundCode.id, code: foundCode.code }

      if (foundCode.createdBy) {
        if (foundCode.createdBy.username === input.username) {
          apiError(400, "不能使用自己生成的邀请码注册")
        }

        inviter = {
          id: foundCode.createdBy.id,
          username: foundCode.createdBy.username,
          points: foundCode.createdBy.points,
        }
      }
    }

    const inviteeRegisterReward = inviter && inviteeReward > 0 ? inviteeReward : 0

    const createdUser = await tx.user.create({
      data: {
        username: input.username,
        passwordHash: hashSync(randomPassword, 10),
        email,
        emailVerifiedAt: email && input.identity.emailVerified ? new Date() : null,
        nickname: input.username,
        lastLoginAt: new Date(),
        lastLoginIp: loginIp,
        inviterId: inviter?.id,
        points: 0,
      },
      select: {
        id: true,
        username: true,
      },
    })

    if (input.identity.method === "oauth" && input.identity.provider && input.identity.providerAccountId) {
      await createExternalAuthAccount({
        client: tx,
        userId: createdUser.id,
        provider: input.identity.provider,
        providerAccountId: input.identity.providerAccountId,
        providerUsername: input.identity.providerUsername ?? null,
        providerEmail: email,
        metadataJson: JSON.stringify({
          displayName: input.identity.displayName ?? null,
          avatarUrl: input.identity.avatarUrl ?? null,
          emailVerified: Boolean(input.identity.emailVerified),
        }),
      })
    }

    if (input.identity.method === "passkey" && input.identity.passkeyCredential) {
      await createPasskeyCredential({
        client: tx,
        userId: createdUser.id,
        credential: input.identity.passkeyCredential,
      })
    }

    if (inviteCodeRecord) {
      await tx.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: {
          usedById: createdUser.id,
          usedAt: new Date(),
        },
      })
    }

    if (inviter) {
      await tx.user.update({
        where: { id: inviter.id },
        data: {
          inviteCount: { increment: 1 },
        },
      })
    }

    await tx.userLoginLog.create({
      data: {
        userId: createdUser.id,
        ip: loginIp,
        userAgent,
      },
    })

    await createSystemNotification({
      client: tx,
      userId: createdUser.id,
      relatedType: "USER",
      relatedId: String(createdUser.id),
      title: "已为你生成随机登录密码",
      content: `你刚刚通过 ${input.identity.providerLabel} 创建了账户。系统已自动生成一组强密码：${randomPassword}。如需使用账号密码登录，请登录后尽快前往设置页面修改密码。`,
    })

    if (inviter && inviterReward > 0) {
      const preparedInviterReward = await prepareScopedPointDelta({
        scopeKey: "INVITE_REWARD_INVITER",
        baseDelta: inviterReward,
        userId: inviter.id,
      })

      await applyPointDelta({
        tx,
        userId: inviter.id,
        beforeBalance: inviter.points,
        prepared: preparedInviterReward,
        pointName: input.siteSettings.pointName,
        reason: `邀请用户 ${createdUser.username} 注册奖励`,
      })
    }

    let pointBalanceCursor = 0

    if (registerInitialPoints > 0) {
      const preparedRegisterInitialReward = await prepareScopedPointDelta({
        scopeKey: "REGISTER_INITIAL_REWARD",
        baseDelta: registerInitialPoints,
        userId: createdUser.id,
      })

      const registerInitialRewardResult = await applyPointDelta({
        tx,
        userId: createdUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: preparedRegisterInitialReward,
        pointName: input.siteSettings.pointName,
        reason: "新用户注册赠送积分",
      })

      pointBalanceCursor = registerInitialRewardResult.afterBalance
    }

    if (inviter && inviteeRegisterReward > 0) {
      const preparedInviteeReward = await prepareScopedPointDelta({
        scopeKey: "INVITE_REWARD_INVITEE",
        baseDelta: inviteeRegisterReward,
        userId: createdUser.id,
      })

      const inviteeRewardResult = await applyPointDelta({
        tx,
        userId: createdUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: preparedInviteeReward,
        pointName: input.siteSettings.pointName,
        reason: `通过 ${inviter.username} 的邀请注册奖励`,
      })

      pointBalanceCursor = inviteeRewardResult.afterBalance
    }

    return createdUser
  })

  return user
}

async function linkIdentityToUser(input: {
  identity: ExternalAuthIdentity
  userId: number
}) {
  if (input.identity.method === "oauth" && input.identity.provider && input.identity.providerAccountId) {
    const existingProviderBinding = await findExternalAuthAccountByUserIdAndProvider(input.userId, input.identity.provider)

    if (existingProviderBinding && existingProviderBinding.providerAccountId !== input.identity.providerAccountId) {
      apiError(409, `你已经绑定了其它 ${input.identity.providerLabel} 账户，请先解绑后再试`)
    }

    const existing = await findExternalAuthAccount(input.identity.provider, input.identity.providerAccountId)

    if (existing && existing.userId !== input.userId) {
      apiError(409, `${input.identity.providerLabel} 账户已绑定其它站内账户`)
    }

    if (!existing) {
      await createExternalAuthAccount({
        userId: input.userId,
        provider: input.identity.provider,
        providerAccountId: input.identity.providerAccountId,
        providerUsername: input.identity.providerUsername ?? null,
        providerEmail: trimNormalizedEmail(input.identity.providerEmail),
        metadataJson: JSON.stringify({
          displayName: input.identity.displayName ?? null,
          avatarUrl: input.identity.avatarUrl ?? null,
          emailVerified: Boolean(input.identity.emailVerified),
        }),
      })
    }
  }

  if (input.identity.method === "passkey" && input.identity.passkeyCredential) {
    const existing = await findPasskeyCredentialByCredentialId(input.identity.passkeyCredential.credentialId)

    if (existing && existing.userId !== input.userId) {
      apiError(409, "该 Passkey 已绑定其它站内账户")
    }

    if (!existing) {
      await createPasskeyCredential({
        userId: input.userId,
        credential: input.identity.passkeyCredential,
      })
    }
  }
}

export async function connectExternalAuthIdentityToUser(input: {
  identity: ExternalAuthIdentity
  userId: number
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!user) {
    apiError(404, "站内账户不存在")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被拉黑，无法绑定新的登录方式")
  }

  await linkIdentityToUser(input)
}

export async function disconnectExternalAuthProviderFromUser(userId: number, provider: ExternalAuthProvider) {
  const deletedCount = await deleteExternalAuthAccountsByUserIdAndProvider(userId, provider)

  if (deletedCount < 1) {
    apiError(404, `${getExternalAuthProviderLabel(provider)} 尚未绑定`)
  }
}

export async function disconnectPasskeyCredentialFromUser(userId: number, credentialId: string) {
  const deletedCount = await deletePasskeyCredentialByIdAndUserId(credentialId, userId)

  if (deletedCount < 1) {
    apiError(404, "指定的 Passkey 不存在或不属于当前账户")
  }
}

export async function resolveExternalAuth(identity: ExternalAuthIdentity, siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">, request: Request): Promise<ExternalAuthResolutionResult> {
  if (identity.method === "oauth" && identity.provider && identity.providerAccountId) {
    const existingAccount = await findExternalAuthAccount(identity.provider, identity.providerAccountId)

    if (existingAccount) {
      return {
        kind: "authenticated",
        user: {
          id: existingAccount.userId,
          username: (await prisma.user.findUnique({
            where: { id: existingAccount.userId },
            select: { username: true },
          }))?.username ?? apiError(404, "关联的站内账户不存在"),
        },
        created: false,
      }
    }
  }

  const email = trimNormalizedEmail(identity.providerEmail)

  if (email) {
    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailOwner) {
      return {
        kind: "pending",
        state: await buildPendingState(identity, emailOwner.id),
      }
    }
  }

  if (!siteSettings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (siteSettings.registrationRequireInviteCode) {
    return {
      kind: "pending",
      state: await buildPendingState(identity, undefined, true),
    }
  }

  const usernameCandidate = normalizeExternalUsernameCandidate(resolveUsernameBase(identity))
  if (usernameCandidate && await isUsernameAvailable(usernameCandidate)) {
    const user = await createUserFromIdentity({
      identity,
      username: usernameCandidate,
      request,
      siteSettings,
    })

    return {
      kind: "authenticated",
      user,
      created: true,
    }
  }

  return {
    kind: "pending",
    state: await buildPendingState(identity),
  }
}

export async function completePendingExternalAuthUsername(input: {
  state: PendingExternalAuthState
  username: string
  inviteCode?: string
  siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">
  request: Request
}) {
  if (input.state.kind !== "username_required") {
    apiError(400, "当前流程不需要补充用户名")
  }

  return createUserFromIdentity({
    identity: input.state,
    username: input.username,
    inviteCode: input.inviteCode,
    request: input.request,
    siteSettings: input.siteSettings,
  })
}

export async function completePendingExternalAuthBind(input: {
  state: PendingExternalAuthState
  login: string
  password: string
}) {
  if (input.state.kind !== "email_bind_required") {
    apiError(400, "当前流程不需要绑定已有账户")
  }

  const login = input.login.trim()
  if (!login || !input.password.trim()) {
    apiError(400, "请输入用户名/邮箱和密码")
  }

  const matchedUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: login }, { email: login }],
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      status: true,
    },
  })

  if (!matchedUser || matchedUser.id !== input.state.conflictUserId) {
    apiError(409, `该 ${input.state.providerLabel} 邮箱已对应其它站内账户，请绑定正确的已有账户`)
  }

  if (!compareSync(input.password, matchedUser.passwordHash)) {
    apiError(401, "用户名/邮箱或密码错误")
  }

  if (matchedUser.status === "BANNED") {
    apiError(403, "该账号已被拉黑，无法绑定第三方登录")
  }

  await linkIdentityToUser({
    identity: input.state,
    userId: matchedUser.id,
  })

  return {
    id: matchedUser.id,
    username: matchedUser.username,
  }
}

export async function recordSuccessfulExternalLogin(request: Request, user: AuthenticatedUserSummary) {
  const loginIp = getRequestIp(request)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: loginIp,
      },
    })

    await tx.userLoginLog.create({
      data: {
        userId: user.id,
        ip: loginIp,
        userAgent: request.headers.get("user-agent"),
      },
    })
  })
}

export async function attachAuthenticatedSession(response: NextResponse, request: Request, user: AuthenticatedUserSummary) {
  const sessionToken = await createSessionToken(user.username, getRequestIp(request))
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())
}

export function createOAuthIdentity(profile: ExternalOAuthProfile): ExternalAuthIdentity {
  return {
    method: "oauth",
    provider: profile.provider,
    providerLabel: getExternalAuthProviderLabel(profile.provider),
    providerAccountId: profile.providerAccountId,
    providerUsername: profile.providerUsername ?? null,
    providerEmail: trimNormalizedEmail(profile.providerEmail),
    emailVerified: profile.emailVerified,
    displayName: profile.displayName ?? null,
    avatarUrl: profile.avatarUrl ?? null,
  }
}

export async function findPasskeyLinkedUserByCredentialId(credentialId: string): Promise<{ credential: StoredPasskeyCredential; user: AuthenticatedUserSummary } | null> {
  const credential = await findPasskeyCredentialByCredentialId(credentialId)

  if (!credential) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: credential.userId },
    select: {
      id: true,
      username: true,
    },
  })

  if (!user) {
    apiError(404, "Passkey 绑定的站内账户不存在")
  }

  return {
    credential,
    user,
  }
}

export function createPasskeyIdentity(input: {
  email?: string | null
  displayName?: string | null
  usernameCandidate: string
  credential: ExternalAuthIdentity["passkeyCredential"]
}): ExternalAuthIdentity {
  return {
    method: "passkey",
    providerLabel: "Passkey",
    providerEmail: trimNormalizedEmail(input.email),
    emailVerified: false,
    displayName: input.displayName ?? null,
    providerUsername: input.usernameCandidate,
    passkeyCredential: input.credential ?? undefined,
  }
}
