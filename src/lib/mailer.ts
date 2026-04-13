import nodemailer from "nodemailer"

import { renderEmailTemplate } from "@/lib/email-template-settings"
import { getServerSiteSettings } from "@/lib/site-settings"

export interface MailerTransportConfig {
  siteName?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure?: boolean
}

interface ResolvedMailerTransportConfig {
  siteName?: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure?: boolean
}

export async function canSendEmail() {
  const settings = await getServerSiteSettings()
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass && settings.smtpFrom)
}

function assertMailerConfig(config: MailerTransportConfig): asserts config is ResolvedMailerTransportConfig {
  if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass || !config.smtpFrom) {
    throw new Error("请完整填写 SMTP 主机、端口、账号、密码和发件人地址")
  }
}

async function createMailerContext(config?: MailerTransportConfig) {
  const siteSettings = await getServerSiteSettings()
  const settings = config ?? siteSettings

  if (!config && !siteSettings.smtpEnabled) {
    throw new Error("当前未配置 SMTP 邮件发送，请先到后台基础设置中完成 SMTP 配置")
  }
  assertMailerConfig(settings)
  const { smtpFrom, smtpHost, smtpPass, smtpPort, smtpSecure, smtpUser } = settings

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure ?? false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  return {
    settings: {
      ...siteSettings,
      ...settings,
      smtpFrom,
      siteName: settings.siteName || siteSettings.siteName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpSecure: smtpSecure ?? false,
    } as typeof siteSettings & { siteName: string; smtpFrom: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpSecure: boolean },
    transporter,
  }
}


export async function sendRegisterVerificationEmail(input: { to: string; code: string }) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    code: input.code,
    username: "",
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.html, variables),
  })
}

export async function sendResetPasswordVerificationEmail(input: { to: string; code: string; username: string }) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    code: input.code,
    username: input.username,
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.html, variables),
  })
}

export async function sendSmtpTestEmail(input: {
  to: string
  siteName?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure?: boolean
}) {
  const { settings, transporter } = await createMailerContext({
    siteName: input.siteName,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    smtpPass: input.smtpPass,
    smtpFrom: input.smtpFrom,
    smtpSecure: input.smtpSecure,
  })

  await transporter.verify()
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: `${settings.siteName} SMTP 测试邮件`,
    text: `这是一封来自 ${settings.siteName} 的 SMTP 测试邮件。若你收到此邮件，说明当前 SMTP 配置可正常连接并发送。`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${settings.siteName} SMTP 测试</h2><p>这是一封后台手动触发的测试邮件。</p><p>如果你收到这封邮件，说明当前 SMTP 主机、端口、账号、密码和发件人配置已经可以正常发送。</p></div>`,
  })
}
