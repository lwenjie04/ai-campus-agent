import { randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import nodemailer from 'nodemailer'
import { readRequestClientIp } from './client-ip.mjs'
import { query } from './mysql.mjs'
import { issueSessionToken, sessionConfig } from './session.mjs'

const scrypt = promisify(scryptCallback)

const AUTH_NOTIFY_EMAIL = process.env.AUTH_NOTIFY_EMAIL || '3279574698@qq.com'
const DEFAULT_ADMIN_USERNAME = process.env.AUTH_DEFAULT_ADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = String(process.env.AUTH_DEFAULT_ADMIN_PASSWORD || '').trim()
const DEFAULT_ADMIN_NAME = process.env.AUTH_DEFAULT_ADMIN_NAME || '系统管理员'
const ALLOW_MEMORY_FALLBACK = process.env.AUTH_ALLOW_MEMORY_FALLBACK === 'true'
const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const CODE_EXPIRE_MINUTES = toPositiveNumber(process.env.AUTH_CODE_EXPIRE_MINUTES, 10)
const CODE_RESEND_SECONDS = toPositiveNumber(process.env.AUTH_CODE_RESEND_SECONDS, 60)
const AUTH_IP_SEND_LIMIT = Math.max(1, toPositiveNumber(process.env.AUTH_IP_SEND_LIMIT, 10))
const AUTH_IP_SEND_WINDOW_MS =
  Math.max(60_000, toPositiveNumber(process.env.AUTH_IP_SEND_WINDOW_HOURS, 24) * 3_600_000)
const AUTH_LOGIN_MAX_FAILURES = Math.max(1, toPositiveNumber(process.env.AUTH_LOGIN_MAX_FAILURES, 5))
const AUTH_LOGIN_LOCKOUT_MS =
  Math.max(60_000, toPositiveNumber(process.env.AUTH_LOGIN_LOCKOUT_SECONDS, 900) * 1000)
const AUTH_LOGIN_FAILURE_WINDOW_MS = Math.max(
  60_000,
  toPositiveNumber(process.env.AUTH_LOGIN_FAILURE_WINDOW_MINUTES, 15) * 60_000,
)
const AUTH_LOGIN_FAILURE_MAX_ENTRIES = Math.max(
  100,
  Math.floor(toPositiveNumber(process.env.AUTH_LOGIN_FAILURE_MAX_ENTRIES, 10_000)),
)

const authRateBuckets = new Map()
const loginFailures = new Map()
let lastLoginFailureCleanupAt = 0

let authSchemaReadyPromise = null
let mailTransporter = null
let memoryAdmin = null

const readClientIp = (req) =>
  readRequestClientIp(req, { trustProxy: process.env.AUTH_TRUST_PROXY === 'true' })

const cleanupAuthRateBuckets = (now) => {
  for (const [key, bucket] of authRateBuckets.entries()) {
    if (now - bucket.windowStartedAt >= AUTH_IP_SEND_WINDOW_MS) authRateBuckets.delete(key)
  }
}

// 发送注册验证码：按 IP 固定窗口限流，防止单出口网络刷邮件。
const enforceIpSendLimit = (req) => {
  const ipAddress = readClientIp(req)
  if (!ipAddress) return

  const now = Date.now()
  cleanupAuthRateBuckets(now)

  let bucket = authRateBuckets.get(ipAddress)
  if (!bucket || now - bucket.windowStartedAt >= AUTH_IP_SEND_WINDOW_MS) {
    bucket = { count: 0, windowStartedAt: now }
    authRateBuckets.set(ipAddress, bucket)
  }

  if (bucket.count >= AUTH_IP_SEND_LIMIT) {
    const err = new Error('当前网络发送验证码过于频繁，请稍后再试')
    err.code = 'AUTH_CODE_IP_RATE_LIMITED'
    err.statusCode = 429
    throw err
  }

  bucket.count += 1
}

const normalizeAccountKey = (account) => String(account || '').trim().toLowerCase()

const isLoginFailureExpired = (entry, now) => {
  if (entry.lockedUntil) return entry.lockedUntil <= now
  return now - entry.lastFailureAt >= AUTH_LOGIN_FAILURE_WINDOW_MS
}

const cleanupLoginFailures = (now = Date.now()) => {
  if (now - lastLoginFailureCleanupAt < 60_000 && loginFailures.size <= AUTH_LOGIN_FAILURE_MAX_ENTRIES) return

  for (const [key, entry] of loginFailures.entries()) {
    if (isLoginFailureExpired(entry, now)) loginFailures.delete(key)
  }

  while (loginFailures.size > AUTH_LOGIN_FAILURE_MAX_ENTRIES) {
    const oldestKey = loginFailures.keys().next().value
    if (!oldestKey) break
    loginFailures.delete(oldestKey)
  }
  lastLoginFailureCleanupAt = now
}

const getLoginFailure = (account) => {
  const key = normalizeAccountKey(account)
  if (!key) return null

  const now = Date.now()
  cleanupLoginFailures(now)
  const entry = loginFailures.get(key)
  if (!entry) return null

  if (isLoginFailureExpired(entry, now)) {
    loginFailures.delete(key)
    return null
  }
  return entry
}

const registerLoginFailure = (accountKey) => {
  const key = normalizeAccountKey(accountKey)
  if (!key) return

  const now = Date.now()
  cleanupLoginFailures(now)
  const existing = getLoginFailure(key)
  const entry = existing || { count: 0, lockedUntil: 0, lastFailureAt: now }
  entry.count += 1
  entry.lastFailureAt = now
  if (entry.count >= AUTH_LOGIN_MAX_FAILURES) {
    entry.lockedUntil = now + AUTH_LOGIN_LOCKOUT_MS
  }
  loginFailures.delete(key)
  loginFailures.set(key, entry)
  cleanupLoginFailures(now)
}

const clearLoginFailures = (accountKey) => {
  const key = normalizeAccountKey(accountKey)
  if (key) loginFailures.delete(key)
}

const assertLoginAllowed = (account) => {
  const entry = getLoginFailure(account)
  if (!entry?.lockedUntil || entry.lockedUntil <= Date.now()) return

  const remainingMinutes = Math.max(1, Math.ceil((entry.lockedUntil - Date.now()) / 60_000))
  const err = new Error(`登录失败次数过多，请在 ${remainingMinutes} 分钟后再试`)
  err.code = 'AUTH_LOGIN_LOCKED'
  err.statusCode = 429
  throw err
}

export const resetAuthRateLimitForTests = () => {
  authRateBuckets.clear()
  loginFailures.clear()
  lastLoginFailureCleanupAt = 0
}

const hashPassword = async (password) => {
  const salt = randomUUID().replace(/-/g, '')
  const derived = (await scrypt(password, salt, 64)).toString('hex')
  return `${salt}:${derived}`
}

const verifyPassword = async (password, storedHash) => {
  const [salt, expected] = String(storedHash || '').split(':')
  if (!salt || !expected) return false

  const actual = await scrypt(password, salt, 64)
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (actual.length !== expectedBuffer.length) return false
  return timingSafeEqual(actual, expectedBuffer)
}

const ensureMemoryAdmin = async () => {
  if (!ALLOW_MEMORY_FALLBACK) return null
  if (!DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD === 'admin123' || DEFAULT_ADMIN_PASSWORD.length < 10) {
    const error = new Error('启用认证内存回退前，请配置至少 10 位的 AUTH_DEFAULT_ADMIN_PASSWORD')
    error.code = 'AUTH_ADMIN_PASSWORD_REQUIRED'
    throw error
  }
  if (!memoryAdmin) {
    memoryAdmin = {
      id: 'memory-admin',
      username: DEFAULT_ADMIN_USERNAME,
      password_hash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
      display_name: DEFAULT_ADMIN_NAME,
      role: 'admin',
      email: AUTH_NOTIFY_EMAIL,
      created_at: new Date(),
    }
  }
  return memoryAdmin
}

const createAuthTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(64) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
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
  const rows = await query('SELECT id FROM auth_users WHERE username = ? LIMIT 1', [DEFAULT_ADMIN_USERNAME])
  if (Array.isArray(rows) && rows.length > 0) return

  if (!DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD === 'admin123' || DEFAULT_ADMIN_PASSWORD.length < 10) {
    const error = new Error('首次创建管理员前，请配置至少 10 位的 AUTH_DEFAULT_ADMIN_PASSWORD')
    error.code = 'AUTH_ADMIN_PASSWORD_REQUIRED'
    throw error
  }

  await query(
    `INSERT INTO auth_users (id, username, password_hash, display_name, role, email)
     VALUES (?, ?, ?, ?, 'admin', ?)`,
    [randomUUID(), DEFAULT_ADMIN_USERNAME, await hashPassword(DEFAULT_ADMIN_PASSWORD), DEFAULT_ADMIN_NAME, AUTH_NOTIFY_EMAIL],
  )
}

const ensureAuthSchema = async () => {
  if (!authSchemaReadyPromise) {
    authSchemaReadyPromise = (async () => {
      try {
        await createAuthTables()
        await ensureDefaultAdmin()
        return 'mysql'
      } catch (error) {
        if (!ALLOW_MEMORY_FALLBACK) throw error
        await ensureMemoryAdmin()
        console.warn(
          `[auth] MySQL unavailable, using explicit competition memory fallback: ${error?.code || error?.message || 'UNKNOWN_ERROR'}`,
        )
        return 'memory'
      }
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
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  return true
}

const sendRegistrationNotice = async (user) => {
  await sendMail({
    to: AUTH_NOTIFY_EMAIL,
    subject: '数智校答有新的校园用户注册',
    text: [
      '数智校答校园智能服务台收到新的校园用户注册信息。',
      `姓名/昵称：${user.displayName}`,
      `邮箱：${user.email}`,
      `注册时间：${user.createdAt}`,
    ].join('\n'),
  })
}

const sendRegisterCodeMail = async ({ email, code, displayName }) => {
  await sendMail({
    to: email,
    subject: '数智校答校园智能服务台注册验证码',
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

  try {
    enforceIpSendLimit(req)
  } catch (error) {
    return helpers.json(res, error?.statusCode || 429, {
      error: { code: error?.code || 'AUTH_CODE_IP_RATE_LIMITED', message: error?.message || '发送验证码过于频繁' },
    })
  }

  const backendMode = await ensureAuthSchema()
  if (backendMode === 'memory') {
    return helpers.json(res, 503, {
      error: { code: 'AUTH_DATABASE_REQUIRED', message: '数据库离线时暂不开放新用户注册' },
    })
  }

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
    console.error('[auth-mail] 验证码邮件发送失败：', error)
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

  const backendMode = await ensureAuthSchema()
  let user
  if (backendMode === 'memory') {
    const admin = await ensureMemoryAdmin()
    user = admin && (account === admin.username || account === admin.email) ? admin : null
  } else {
    const rows = await query('SELECT * FROM auth_users WHERE username = ? OR email = ? LIMIT 1', [account, account])
    user = Array.isArray(rows) ? rows[0] : null
  }

  const loginFailureKey = user?.id ? `user:${user.id}` : `account:${normalizeAccountKey(account)}`
  try {
    assertLoginAllowed(loginFailureKey)
  } catch (error) {
    return helpers.json(res, error?.statusCode || 429, {
      error: { code: error?.code || 'AUTH_LOGIN_LOCKED', message: error?.message || '登录失败次数过多，请稍后再试' },
    })
  }

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    registerLoginFailure(loginFailureKey)
    return helpers.json(res, 401, {
      error: { code: 'AUTH_INVALID', message: '账号或密码错误' },
    })
  }

  clearLoginFailures(loginFailureKey)

  const normalizedUser = normalizeUser(user)
  return helpers.json(res, 200, {
    data: {
      user: normalizedUser,
      ...issueSessionToken(normalizedUser),
      expiresAt: new Date(Date.now() + sessionConfig.ttlSeconds * 1000).toISOString(),
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

  const backendMode = await ensureAuthSchema()
  if (backendMode === 'memory') {
    return helpers.json(res, 503, {
      error: { code: 'AUTH_DATABASE_REQUIRED', message: '数据库离线时暂不开放新用户注册' },
    })
  }
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
    return helpers.json(res, 400, {
      error: { code: 'AUTH_CODE_INVALID', message: '验证码错误，请重新输入' },
    })
  }

  const id = randomUUID()
  await query(
    `INSERT INTO auth_users (id, username, password_hash, display_name, role, email)
     VALUES (?, ?, ?, ?, 'user', ?)`,
    [id, email, await hashPassword(password), displayName, email],
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
    console.error('[auth-mail] 注册通知邮件发送失败：', error)
  }

  return helpers.json(res, 201, {
    data: normalizeUser(user),
    message: '注册成功，请登录',
  })
}

export const handleAuthRoute = async (req, res, requestUrl, helpers) => {
  const isPath = (path) => requestUrl.pathname === path || requestUrl.pathname === `/api${path}`

  if (req.method === 'POST' && isPath('/auth/send-register-code')) {
    return handleSendRegisterCode(req, res, helpers)
  }

  if (req.method === 'POST' && isPath('/auth/login')) {
    return handleLogin(req, res, helpers)
  }

  if (req.method === 'POST' && isPath('/auth/register')) {
    return handleRegister(req, res, helpers)
  }

  return false
}
