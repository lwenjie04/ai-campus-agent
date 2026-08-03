import { randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { query } from './mysql.mjs'
import { createRateLimiter } from './rate-limit.mjs'

const AUTH_NOTIFY_EMAIL = process.env.AUTH_NOTIFY_EMAIL || '3279574698@qq.com'
const DEFAULT_ADMIN_USERNAME = process.env.AUTH_DEFAULT_ADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = process.env.AUTH_DEFAULT_ADMIN_PASSWORD || 'admin123'
const DEFAULT_ADMIN_NAME = process.env.AUTH_DEFAULT_ADMIN_NAME || '系统管理员'
const CODE_EXPIRE_MINUTES = Number(process.env.AUTH_CODE_EXPIRE_MINUTES || 10)
const CODE_RESEND_SECONDS = Number(process.env.AUTH_CODE_RESEND_SECONDS || 60)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error || 'Unknown error')

if (!process.env.JWT_SECRET) {
  console.warn('[auth] 未设置 JWT_SECRET，使用开发默认值；生产环境务必配置随机密钥。')
}

// 登录失败限流：同一账号 + 来源 IP 在窗口内最多允许 MAX_FAILURES 次尝试。
const LOGIN_MAX_FAILURES = Number(process.env.AUTH_LOGIN_MAX_FAILURES || 5)
const LOGIN_WINDOW_MS = Number(process.env.AUTH_LOGIN_WINDOW_MINUTES || 15) * 60 * 1000
const loginLimiter = createRateLimiter({ windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_FAILURES })
// 验证码发送频率：同一邮箱 + 来源 IP 每小时最多 10 次。
const sendCodeLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 })
const CODE_MAX_ATTEMPTS = Number(process.env.AUTH_CODE_MAX_ATTEMPTS || 5)

let authSchemaReadyPromise = null
let mailTransporter = null

const hashPassword = (password) => {
  const salt = randomUUID().replace(/-/g, '')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

const verifyPassword = (password, storedHash) => {
  const [salt, expected] = String(storedHash || '').split(':')
  if (!salt || !expected) return false

  const actual = scryptSync(password, salt, 64)
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (actual.length !== expectedBuffer.length) return false
  return timingSafeEqual(actual, expectedBuffer)
}

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, username: user.username, displayName: user.display_name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )

export const verifyToken = (token) => {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload?.sub) return null
    return {
      userId: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export const resolveRequestAuth = (req) => {
  const header = String(req.headers?.authorization || '')
  if (!header.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token ? verifyToken(token) : null
}

const createAuthTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(64) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      must_change_password TINYINT(1) NOT NULL DEFAULT 0,
      email VARCHAR(128) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_auth_users_role (role),
      UNIQUE KEY uk_auth_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS auth_verification_codes (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(128) NOT NULL,
      code VARCHAR(8) NOT NULL,
      purpose VARCHAR(32) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME DEFAULT NULL,
      INDEX idx_auth_code_email (email),
      INDEX idx_auth_code_purpose (purpose)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
}

const ensureDefaultAdmin = async () => {
  const rows = await query('SELECT id, password_hash FROM auth_users WHERE username = ? LIMIT 1', [DEFAULT_ADMIN_USERNAME])
  if (Array.isArray(rows) && rows.length > 0) {
    // 存量安装：若默认 admin 仍是默认密码，标记需改密。改密成功后字段清零，重复执行幂等。
    const existing = rows[0]
    if (verifyPassword(DEFAULT_ADMIN_PASSWORD, existing.password_hash)) {
      await query(`UPDATE auth_users SET must_change_password = 1 WHERE id = ?`, [existing.id])
    }
    return
  }

  await query(
    `INSERT INTO auth_users (id, username, password_hash, display_name, role, email, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', ?, 1)`,
    [randomUUID(), DEFAULT_ADMIN_USERNAME, hashPassword(DEFAULT_ADMIN_PASSWORD), DEFAULT_ADMIN_NAME, AUTH_NOTIFY_EMAIL],
  )
}

// 幂等迁移：MySQL 不支持 ADD COLUMN IF NOT EXISTS，先查 information_schema 再 ALTER。
const ensureColumnExists = async (table, column, definition) => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  )
  const has = Number(rows?.[0]?.cnt || 0) > 0
  if (!has) {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`)
  }
}

const ensureAuthSchema = async () => {
  if (!authSchemaReadyPromise) {
    authSchemaReadyPromise = (async () => {
      await createAuthTables()
      await ensureColumnExists('auth_users', 'must_change_password', 'must_change_password TINYINT(1) NOT NULL DEFAULT 0')
      await ensureColumnExists('auth_verification_codes', 'attempts', 'attempts INT NOT NULL DEFAULT 0')
      await ensureDefaultAdmin()
    })().catch((error) => {
      authSchemaReadyPromise = null
      throw error
    })
  }

  return authSchemaReadyPromise
}

const canSendMail = () => Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS)

const getTransporter = () => {
  if (!canSendMail()) return null
  if (mailTransporter) return mailTransporter

  const secure = String(process.env.MAIL_SECURE || 'true') !== 'false'
  mailTransporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || (secure ? 465 : 587)),
    secure,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  })

  return mailTransporter
}

const sendMail = async (payload) => {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[auth-mail] 未检测到 SMTP 配置，邮件发送已跳过。')
    return false
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      ...payload,
    })
  } catch (error) {
    console.error('[auth-mail] 邮件发送失败：', {
      host: process.env.MAIL_HOST || '',
      port: Number(process.env.MAIL_PORT || 0),
      secure: String(process.env.MAIL_SECURE || 'true') !== 'false',
      user: process.env.MAIL_USER || '',
      to: payload?.to || '',
      subject: payload?.subject || '',
      code: error && typeof error === 'object' ? error.code || '' : '',
      responseCode: error && typeof error === 'object' ? error.responseCode || '' : '',
      message: getErrorMessage(error),
    })
    throw error
  }
  return true
}

const sendRegistrationNotice = async (user) => {
  await sendMail({
    to: AUTH_NOTIFY_EMAIL,
    subject: '校园智能问答平台有新的普通用户注册',
    text: [
      '校园智能问答平台收到新的普通用户注册信息。',
      `姓名/昵称：${user.displayName}`,
      `邮箱：${user.email}`,
      `注册时间：${user.createdAt}`,
    ].join('\n'),
  })
}

const sendRegisterCodeMail = async ({ email, code, displayName }) => {
  await sendMail({
    to: email,
    subject: '校园智能问答平台注册验证码',
    text: [
      `你好${displayName ? `，${displayName}` : ''}：`,
      '',
      `你的注册验证码为：${code}`,
      `验证码 ${CODE_EXPIRE_MINUTES} 分钟内有效，请尽快完成注册。`,
      '',
      '如果这不是你的操作，请忽略本邮件。',
    ].join('\n'),
  })
}

const normalizeUser = (row) => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  role: row.role === 'admin' ? 'admin' : 'user',
  email: row.email || '',
  mustChangePassword: Number(row.must_change_password || 0) === 1,
  createdAt: row.created_at,
})

const validateLoginPayload = (body) => {
  const account = String(body?.account || body?.username || '').trim()
  const password = String(body?.password || '').trim()
  if (!account || !password) {
    const err = new Error('请输入账号和密码')
    err.code = 'AUTH_INVALID_PAYLOAD'
    throw err
  }
  return { account, password }
}

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const generateCode = () => String(randomInt(100000, 1000000))

const markOldCodesExpired = async (email, purpose) => {
  await query(
    `UPDATE auth_verification_codes
     SET status = 'expired'
     WHERE email = ? AND purpose = ? AND status = 'pending'`,
    [email, purpose],
  )
}

const getLatestPendingCode = async (email, purpose) => {
  const rows = await query(
    `SELECT * FROM auth_verification_codes
     WHERE email = ? AND purpose = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose],
  )
  return Array.isArray(rows) ? rows[0] : null
}

const handleSendRegisterCode = async (req, res, helpers) => {
  const body = await helpers.parseJsonBody(req)
  const email = String(body?.email || '').trim().toLowerCase()
  const displayName = String(body?.displayName || '').trim()

  if (!isValidEmail(email)) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_EMAIL_INVALID', message: '请输入有效邮箱地址' },
    })
  }

  const ip = req.socket?.remoteAddress || 'unknown'
  const sendKey = `sendcode:${email}:${ip}`
  const sendRate = sendCodeLimiter.check(sendKey)
  if (!sendRate.allowed) {
    return helpers.json(res, 429, {
      error: {
        code: 'AUTH_CODE_RATE_LIMITED',
        message: '验证码发送过于频繁，请稍后再试',
        retryAfterSeconds: Math.ceil(sendRate.retryAfterMs / 1000),
      },
    })
  }

  await ensureAuthSchema()

  const duplicateRows = await query('SELECT id FROM auth_users WHERE email = ? LIMIT 1', [email])
  if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
    return helpers.json(res, 409, {
      error: { code: 'AUTH_EMAIL_EXISTS', message: '该邮箱已注册，请直接登录' },
    })
  }

  const latestPending = await getLatestPendingCode(email, 'register')
  if (latestPending) {
    const secondsSinceCreate = Math.floor((Date.now() - new Date(latestPending.created_at).getTime()) / 1000)
    if (secondsSinceCreate < CODE_RESEND_SECONDS) {
      return helpers.json(res, 429, {
        error: {
          code: 'AUTH_CODE_TOO_FREQUENT',
          message: `验证码发送过于频繁，请在 ${CODE_RESEND_SECONDS - secondsSinceCreate} 秒后重试`,
        },
      })
    }
  }

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000)

  await markOldCodesExpired(email, 'register')
  await query(
    `INSERT INTO auth_verification_codes (id, email, code, purpose, status, expires_at)
     VALUES (?, ?, ?, 'register', 'pending', ?)`,
    [randomUUID(), email, code, expiresAt],
  )

  try {
    await sendRegisterCodeMail({ email, code, displayName })
  } catch (error) {
    console.error('[auth-mail] 验证码邮件发送失败：', getErrorMessage(error))
    return helpers.json(res, 500, {
      error: { code: 'AUTH_CODE_SEND_FAILED', message: '验证码发送失败，请检查邮箱配置' },
    })
  }

  return helpers.json(res, 200, {
    message: '验证码已发送，请查收邮箱',
    data: {
      expireMinutes: CODE_EXPIRE_MINUTES,
      resendSeconds: CODE_RESEND_SECONDS,
    },
  })
}

const handleLogin = async (req, res, helpers) => {
  const body = await helpers.parseJsonBody(req)
  const { account, password } = validateLoginPayload(body)

  // 登录限流：窗口内失败次数过多直接 429，即使密码正确也不放行。
  const ip = req.socket?.remoteAddress || 'unknown'
  const rateKey = `login:${account}:${ip}`
  const rate = loginLimiter.check(rateKey)
  if (!rate.allowed) {
    return helpers.json(res, 429, {
      error: {
        code: 'AUTH_RATE_LIMITED',
        message: '尝试次数过多，请稍后再试',
        retryAfterSeconds: Math.ceil(rate.retryAfterMs / 1000),
      },
    })
  }

  await ensureAuthSchema()
  const rows = await query('SELECT * FROM auth_users WHERE username = ? OR email = ? LIMIT 1', [account, account])
  const user = Array.isArray(rows) ? rows[0] : null

  if (!user || !verifyPassword(password, user.password_hash)) {
    return helpers.json(res, 401, {
      error: { code: 'AUTH_INVALID', message: '账号或密码错误' },
    })
  }

  loginLimiter.reset(rateKey)
  return helpers.json(res, 200, {
    data: {
      token: signToken(user),
      user: normalizeUser(user),
    },
  })
}

const handleRegister = async (req, res, helpers) => {
  const body = await helpers.parseJsonBody(req)
  const displayName = String(body?.displayName || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const verifyCode = String(body?.verifyCode || '').trim()
  const password = String(body?.password || '').trim()
  const confirmPassword = String(body?.confirmPassword || '').trim()

  if (!displayName) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_REGISTER_INVALID', message: '请输入姓名或昵称' },
    })
  }

  if (!isValidEmail(email)) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_EMAIL_INVALID', message: '请输入有效邮箱地址' },
    })
  }

  if (!verifyCode) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_CODE_REQUIRED', message: '请输入邮箱验证码' },
    })
  }

  if (password.length < 6) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_REGISTER_INVALID', message: '密码长度至少为 6 位' },
    })
  }

  if (password !== confirmPassword) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_REGISTER_INVALID', message: '两次输入的密码不一致' },
    })
  }

  await ensureAuthSchema()
  const duplicateRows = await query('SELECT id FROM auth_users WHERE email = ? LIMIT 1', [email])
  if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
    return helpers.json(res, 409, {
      error: { code: 'AUTH_EMAIL_EXISTS', message: '该邮箱已注册，请直接登录' },
    })
  }

  const codeRows = await query(
    `SELECT * FROM auth_verification_codes
     WHERE email = ? AND purpose = 'register' AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  )
  const codeRecord = Array.isArray(codeRows) ? codeRows[0] : null

  if (!codeRecord) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_CODE_NOT_FOUND', message: '请先获取邮箱验证码' },
    })
  }

  if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
    await query(`UPDATE auth_verification_codes SET status = 'expired' WHERE id = ?`, [codeRecord.id])
    return helpers.json(res, 400, {
      error: { code: 'AUTH_CODE_EXPIRED', message: '验证码已过期，请重新获取' },
    })
  }

  if (String(codeRecord.code) !== verifyCode) {
    const newAttempts = Number(codeRecord.attempts || 0) + 1
    if (newAttempts >= CODE_MAX_ATTEMPTS) {
      await query(
        `UPDATE auth_verification_codes SET status = 'expired', attempts = ? WHERE id = ?`,
        [newAttempts, codeRecord.id],
      )
      return helpers.json(res, 400, {
        error: { code: 'AUTH_CODE_TOO_MANY_ATTEMPTS', message: '验证码错误次数过多，请重新获取' },
      })
    }
    await query(`UPDATE auth_verification_codes SET attempts = ? WHERE id = ?`, [newAttempts, codeRecord.id])
    return helpers.json(res, 400, {
      error: { code: 'AUTH_CODE_INVALID', message: '验证码错误，请重新输入' },
    })
  }

  const id = randomUUID()
  await query(
    `INSERT INTO auth_users (id, username, password_hash, display_name, role, email)
     VALUES (?, ?, ?, ?, 'user', ?)`,
    [id, email, hashPassword(password), displayName, email],
  )

  await query(`UPDATE auth_verification_codes SET status = 'used', used_at = NOW() WHERE id = ?`, [codeRecord.id])

  const rows = await query('SELECT * FROM auth_users WHERE id = ? LIMIT 1', [id])
  const user = Array.isArray(rows) ? rows[0] : null

  if (!user) {
    return helpers.json(res, 500, {
      error: { code: 'AUTH_REGISTER_FAILED', message: '注册成功，但未能读取用户信息' },
    })
  }

  try {
    await sendRegistrationNotice(normalizeUser(user))
  } catch (error) {
    console.error('[auth-mail] 注册通知邮件发送失败：', getErrorMessage(error))
  }

  return helpers.json(res, 201, {
    data: {
      token: signToken(user),
      user: normalizeUser(user),
    },
    message: '注册成功，请登录',
  })
}

const handleChangePassword = async (req, res, helpers, auth) => {
  if (!auth) {
    return helpers.json(res, 401, {
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
    })
  }

  const body = await helpers.parseJsonBody(req)
  const oldPassword = String(body?.oldPassword || '')
  const newPassword = String(body?.newPassword || '')

  if (newPassword.length < 6) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_REGISTER_INVALID', message: '新密码长度至少为 6 位' },
    })
  }

  const rows = await query('SELECT * FROM auth_users WHERE id = ? LIMIT 1', [auth.userId])
  const user = Array.isArray(rows) ? rows[0] : null
  if (!user || !verifyPassword(oldPassword, user.password_hash)) {
    return helpers.json(res, 400, {
      error: { code: 'AUTH_INVALID', message: '原密码不正确' },
    })
  }

  await query(
    `UPDATE auth_users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?`,
    [hashPassword(newPassword), auth.userId],
  )

  return helpers.json(res, 200, { message: '密码修改成功' })
}

export const handleAuthRoute = async (req, res, requestUrl, helpers) => {
  const isPath = (path) => requestUrl.pathname === path || requestUrl.pathname === `/api${path}`
  const auth = resolveRequestAuth(req)

  if (req.method === 'POST' && isPath('/auth/send-register-code')) {
    return handleSendRegisterCode(req, res, helpers)
  }

  if (req.method === 'POST' && isPath('/auth/login')) {
    return handleLogin(req, res, helpers)
  }

  if (req.method === 'POST' && isPath('/auth/register')) {
    return handleRegister(req, res, helpers)
  }

  if (req.method === 'POST' && isPath('/auth/change-password')) {
    return handleChangePassword(req, res, helpers, auth)
  }

  return false
}
