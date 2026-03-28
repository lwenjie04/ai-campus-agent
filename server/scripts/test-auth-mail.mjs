import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import nodemailer from 'nodemailer'

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return

  const text = readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), 'server/.env'))
loadEnvFile(resolve(process.cwd(), '.env.server'))

const requiredKeys = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS']
const missingKeys = requiredKeys.filter((key) => !String(process.env[key] || '').trim())

if (missingKeys.length > 0) {
  console.error('[mail:test] 邮件配置不完整，缺少：', missingKeys.join(', '))
  process.exit(1)
}

const secure = String(process.env.MAIL_SECURE || 'true') !== 'false'
const to = process.env.AUTH_NOTIFY_EMAIL || process.env.MAIL_USER
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || (secure ? 465 : 587)),
  secure,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
})

try {
  await transporter.verify()
  console.log('[mail:test] SMTP 连接验证成功。')

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject: '校园智能问答平台邮件配置测试',
    text: [
      '这是一封测试邮件。',
      '',
      '如果你收到这封邮件，说明邮箱验证码发送链路已经基本可用。',
      `发送时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    ].join('\n'),
  })

  console.log('[mail:test] 测试邮件已发送成功。')
  console.log('[mail:test] 收件人：', to)
  console.log('[mail:test] MessageId：', info.messageId || '')
} catch (error) {
  console.error('[mail:test] 测试失败：', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
