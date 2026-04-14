import { findUserByEmail } from "@/db/password-reset-queries"
import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { canSendEmail } from "@/lib/mailer"
import { getRequestIp } from "@/lib/request-ip"
import { sendPasswordResetCode } from "@/lib/password-reset"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const email = normalizeEmailAddress(requireStringField(body, "email", "请输入邮箱"))

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  if (!isValidEmail(email)) {
    apiError(400, "邮箱格式不正确")
  }

  const smtpReady = await canSendEmail()

  if (!smtpReady) {
    apiError(400, "当前站点未配置邮件发送能力，暂不可找回密码")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    apiError(404, "该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法找回密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法找回密码")
  }

  return withRequestWriteGuard(createRequestWriteGuardOptions("auth-forgot-password-send-code", {
    request,
    input: {
      email,
    },
  }), async () => {
    const result = await sendPasswordResetCode({
      email,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    })

    return apiSuccess(result, "验证码已发送到邮箱")
  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/auth/forgot-password/send-code] unexpected error",
})
