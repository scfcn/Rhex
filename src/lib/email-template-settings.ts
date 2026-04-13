export interface EditableEmailTemplate {
  subject: string
  text: string
  html: string
}

export interface RegistrationEmailTemplateSettings {
  registerVerification: EditableEmailTemplate
  resetPasswordVerification: EditableEmailTemplate
}

function buildRegisterVerificationTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 验证码",
    text: "你的验证码是 {{code}}，10 分钟内有效。如非本人操作请忽略。",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 验证码</h2><p>你的验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{code}}</p><p>验证码 10 分钟内有效，如非本人操作请忽略。</p></div>`,
  }
}

function buildResetPasswordTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 找回密码验证码",
    text: "用户 {{username}} 的找回密码验证码是 {{code}}，10 分钟内有效。如非本人操作，请尽快检查账号安全。",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 找回密码</h2><p>账号：<strong>{{username}}</strong></p><p>你的找回密码验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{code}}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件并尽快检查账号安全。</p></div>`,
  }
}

export function buildDefaultRegistrationEmailTemplateSettings(siteName: string) {
  return {
    registerVerification: buildRegisterVerificationTemplate(siteName),
    resetPasswordVerification: buildResetPasswordTemplate(siteName),
  } satisfies RegistrationEmailTemplateSettings
}

function sanitizeTemplateField(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : fallback
}

export function normalizeRegistrationEmailTemplateSettings(
  input: unknown,
  defaults: RegistrationEmailTemplateSettings,
): RegistrationEmailTemplateSettings {
  const root = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const registerVerification = root.registerVerification && typeof root.registerVerification === "object" && !Array.isArray(root.registerVerification)
    ? root.registerVerification as Record<string, unknown>
    : {}
  const resetPasswordVerification = root.resetPasswordVerification && typeof root.resetPasswordVerification === "object" && !Array.isArray(root.resetPasswordVerification)
    ? root.resetPasswordVerification as Record<string, unknown>
    : {}

  return {
    registerVerification: {
      subject: sanitizeTemplateField(registerVerification.subject, defaults.registerVerification.subject, 200),
      text: sanitizeTemplateField(registerVerification.text, defaults.registerVerification.text, 10000),
      html: sanitizeTemplateField(registerVerification.html, defaults.registerVerification.html, 20000),
    },
    resetPasswordVerification: {
      subject: sanitizeTemplateField(resetPasswordVerification.subject, defaults.resetPasswordVerification.subject, 200),
      text: sanitizeTemplateField(resetPasswordVerification.text, defaults.resetPasswordVerification.text, 10000),
      html: sanitizeTemplateField(resetPasswordVerification.html, defaults.resetPasswordVerification.html, 20000),
    },
  }
}

export function renderEmailTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "")
}
