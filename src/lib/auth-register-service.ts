import { ChangeType, VerificationChannel } from "@/db/types"
import { hashSync } from "bcryptjs"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { enforceSensitiveText } from "@/lib/content-safety"
import { getRequestIp } from "@/lib/request-ip"
import { getSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateAuthPayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"

interface RegisterFlowOptions {
  request: Request
  body: unknown
}

interface RegisterFlowResult {
  user: {
    id: number
    username: string
  }
  registerIp: string | null
  invited: boolean
  successMessage?: string
}


interface RegisterPayload {
  username: string
  password: string
  nickname: string
  inviterUsername: string
  inviteCode: string
  email: string
  emailCode: string
  phone: string
  phoneCode: string
  gender: string
}

interface RegisterContext {
  payload: RegisterPayload
  body: Record<string, unknown>
  settings: Awaited<ReturnType<typeof getSiteSettings>>
  registerIp: string | null
  userAgent: string | null
  nicknameSafety: Awaited<ReturnType<typeof enforceSensitiveText>> | null
}


function assertRegisterPayload(body: unknown): RegisterPayload {
  const validated = validateAuthPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  return validated.data
}

async function verifyRegisterCaptcha(context: RegisterContext) {
  const captchaToken = typeof context.body.captchaToken === "string" ? context.body.captchaToken.trim() : ""
  const builtinCaptchaCode = typeof context.body.builtinCaptchaCode === "string" ? context.body.builtinCaptchaCode.trim() : ""

  if (context.settings.registerCaptchaMode === "TURNSTILE") {
    if (!context.settings.turnstileSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) {
      apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
    }

    if (!captchaToken) {
      apiError(400, "请先完成验证码验证")
    }

    await verifyTurnstileToken(captchaToken, context.registerIp)
  }

  if (context.settings.registerCaptchaMode === "BUILTIN") {
    if (!captchaToken || !builtinCaptchaCode) {
      apiError(400, "请先完成图形验证码验证")
    }

    verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
  }
}

function verifyRequiredRegisterFields(context: RegisterContext) {
  const { payload, settings } = context

  if (!settings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (settings.registerEmailEnabled && settings.registerEmailRequired && !payload.email) {
    apiError(400, "请填写邮箱")
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneRequired && !payload.phone) {
    apiError(400, "请填写手机号")
  }

  if (settings.registerNicknameEnabled && settings.registerNicknameRequired && !payload.nickname) {
    apiError(400, "请填写昵称")
  }

  if (settings.registerGenderEnabled && settings.registerGenderRequired && payload.gender === "unknown") {
    apiError(400, "请选择性别")
  }

  if (settings.registrationRequireInviteCode && !payload.inviteCode) {
    apiError(400, "当前注册必须填写邀请码")
  }

  if (settings.registerEmailEnabled && settings.registerEmailVerification) {
    if (!payload.email) {
      apiError(400, "当前注册要求邮箱验证，请填写邮箱")
    }

    if (!payload.emailCode) {
      apiError(400, "请填写邮箱验证码")
    }
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification) {
    if (!payload.phone) {
      apiError(400, "当前注册要求手机验证，请填写手机号")
    }

    if (!payload.phoneCode) {
      apiError(400, "请填写手机验证码")
    }
  }
}

async function ensureRegisterTargetsAvailable(context: RegisterContext) {
  const { payload, nicknameSafety } = context
  const sanitizedNickname = nicknameSafety?.sanitizedText ?? payload.nickname

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: payload.username },
        ...(payload.email ? [{ email: payload.email }] : []),
        ...(payload.phone ? [{ phone: payload.phone }] : []),
        ...(payload.nickname ? [{ nickname: sanitizedNickname }] : []),
      ],
    },
    select: {
      username: true,
      email: true,
      phone: true,
      nickname: true,
    },
  })

  if (existingUser?.username === payload.username) {
    apiError(409, "用户名已存在")
  }

  if (payload.email && existingUser?.email === payload.email) {
    apiError(409, "邮箱已被使用")
  }

  if (payload.phone && existingUser?.phone === payload.phone) {
    apiError(409, "手机号已被使用")
  }

  if (payload.nickname && existingUser?.nickname === sanitizedNickname) {
    apiError(409, "昵称已被使用")
  }
}

async function verifyRegisterContactCodes(context: RegisterContext) {
  const { payload, settings } = context

  if (settings.registerEmailEnabled && settings.registerEmailVerification && payload.email && payload.emailCode) {
    await verifyCode({
      channel: VerificationChannel.EMAIL,
      target: payload.email,
      code: payload.emailCode,
    })
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification && payload.phone && payload.phoneCode) {
    await verifyCode({
      channel: VerificationChannel.PHONE,
      target: payload.phone,
      code: payload.phoneCode,
    })
  }
}

export async function createRegisterFlow(options: RegisterFlowOptions): Promise<RegisterFlowResult> {
  const payload = assertRegisterPayload(options.body)
  const body = options.body as Record<string, unknown>
  const settings = await getSiteSettings()
  const registerIp = getRequestIp(options.request)
  const userAgent = options.request.headers.get("user-agent")
  const nicknameSafety = payload.nickname
    ? await enforceSensitiveText({ scene: "profile.nickname", text: payload.nickname })
    : null

  const context: RegisterContext = {
    payload,
    body,
    settings,
    registerIp,
    userAgent,
    nicknameSafety,
  }

  verifyRequiredRegisterFields(context)
  await verifyRegisterCaptcha(context)
  await ensureRegisterTargetsAvailable(context)
  await verifyRegisterContactCodes(context)

  const inviterReward = Math.max(0, settings.inviteRewardInviter)
  const inviteeReward = Math.max(0, settings.inviteRewardInvitee)
  const sanitizedNickname = nicknameSafety?.sanitizedText || payload.username

  const user = await prisma.$transaction(async (tx) => {
    let inviter: null | { id: number; username: string } = null
    let inviteCodeRecord: null | { id: string; code: string } = null

    if (payload.inviterUsername) {
      inviter = await tx.user.findUnique({
        where: { username: payload.inviterUsername },
        select: { id: true, username: true },
      })

      if (!inviter) {
        apiError(404, "邀请人不存在")
      }

      if (inviter.username === payload.username) {
        apiError(400, "邀请人不能填写自己")
      }
    }

    if (payload.inviteCode) {
      const foundCode = await tx.inviteCode.findUnique({
        where: { code: payload.inviteCode },
        select: {
          id: true,
          code: true,
          usedById: true,
          createdBy: {
            select: {
              id: true,
              username: true,
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

      if (!inviter && foundCode.createdBy) {
        if (foundCode.createdBy.username === payload.username) {
          apiError(400, "不能使用自己生成的邀请码注册")
        }

        inviter = {
          id: foundCode.createdBy.id,
          username: foundCode.createdBy.username,
        }
      }
    }

    const createdUser = await tx.user.create({
      data: {
        username: payload.username,
        email: settings.registerEmailEnabled ? payload.email || null : null,
        phone: settings.registerPhoneEnabled ? payload.phone || null : null,
        emailVerifiedAt: settings.registerEmailEnabled && settings.registerEmailVerification ? new Date() : null,
        phoneVerifiedAt: settings.registerPhoneEnabled && settings.registerPhoneVerification ? new Date() : null,
        passwordHash: hashSync(payload.password, 10),
        nickname: settings.registerNicknameEnabled ? sanitizedNickname : payload.username,
        gender: settings.registerGenderEnabled ? payload.gender : null,
        status: "ACTIVE",
        role: "USER",
        inviterId: inviter?.id,
        lastLoginAt: new Date(),
        lastLoginIp: registerIp,
        points: inviteeReward,
      },
      select: {
        id: true,
        username: true,
      },
    })

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
          points: { increment: inviterReward },
        },
      })
    }

    await tx.userLoginLog.create({
      data: {
        userId: createdUser.id,
        ip: registerIp,
        userAgent,
      },
    })

    if (inviter && inviterReward > 0) {
      await tx.pointLog.create({
        data: {
          userId: inviter.id,
          changeType: ChangeType.INCREASE,
          changeValue: inviterReward,
          reason: `邀请用户 ${createdUser.username} 注册奖励${settings.pointName}`,
        },
      })
    }

    if (inviter && inviteeReward > 0) {
      await tx.pointLog.create({
        data: {
          userId: createdUser.id,
          changeType: ChangeType.INCREASE,
          changeValue: inviteeReward,
          reason: `通过 ${inviter.username} 的邀请注册奖励${settings.pointName}`,
        },
      })
    }

    return createdUser
  })

  return {
    user,
    registerIp,
    invited: Boolean(payload.inviterUsername || payload.inviteCode),
    successMessage: nicknameSafety?.shouldReview ? "注册成功，昵称已按规则处理" : "success",
  }
}
