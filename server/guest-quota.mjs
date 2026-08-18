import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { readRequestClientIp } from './client-ip.mjs'
import { readSession } from './session.mjs'

const COOKIE_NAME = 'campus_guest_id'
const configuredGuestSecret = String(process.env.GUEST_COOKIE_SECRET || '').trim()
// 游客 Cookie 使用独立密钥；未配置时回退到会话密钥，并在控制台提示生产环境应配置独立密钥。
const guestCookieSecret =
  configuredGuestSecret || String(process.env.AUTH_SESSION_SECRET || '').trim() || randomBytes(32).toString('hex')

if (!configuredGuestSecret) {
  console.warn(
    '[guest-quota] GUEST_COOKIE_SECRET 未配置，游客 Cookie 当前复用 AUTH_SESSION_SECRET；生产环境请配置独立的 32 位以上随机密钥。',
  )
}

const signGuestId = (guestId) =>
  createHmac('sha256', guestCookieSecret).update(String(guestId)).digest('base64url')

const verifyGuestId = (guestId, signature) => {
  const expected = Buffer.from(signGuestId(guestId))
  const actual = Buffer.from(String(signature || ''))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const QUOTA_LIMIT = Math.max(1, Number(process.env.GUEST_CHAT_LIMIT || 1))
const SESSION_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.GUEST_SESSION_TTL_DAYS || 30) * 86_400_000)
const IP_QUOTA_LIMIT = Math.max(QUOTA_LIMIT, Number(process.env.GUEST_IP_CHAT_LIMIT || 20))
const IP_WINDOW_MS = Math.max(60_000, Number(process.env.GUEST_IP_WINDOW_MINUTES || 60) * 60_000)
const guestSessions = new Map()
const guestIpWindows = new Map()

const parseCookies = (req) => {
  const result = {}
  for (const part of String(req?.headers?.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) result[key] = decodeURIComponent(value)
  }
  return result
}

const readSignedGuestId = (req) => {
  const raw = parseCookies(req)[COOKIE_NAME]
  if (!raw) return ''
  const [guestId, signature] = raw.split('.')
  if (!guestId || !signature || !verifyGuestId(guestId, signature)) return ''
  return guestId
}

const serializeGuestCookie = (guestId) => {
  const value = `${guestId}.${signGuestId(guestId)}`
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`
}

const readClientIp = (req) =>
  readRequestClientIp(req, { trustProxy: process.env.GUEST_TRUST_PROXY === 'true' })

const cleanupExpiredSessions = () => {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [guestId, state] of guestSessions.entries()) {
    if (state.updatedAt < cutoff) guestSessions.delete(guestId)
  }

  const now = Date.now()
  for (const [ipAddress, state] of guestIpWindows.entries()) {
    if (state.reserved === 0 && now - state.windowStartedAt >= IP_WINDOW_MS) {
      guestIpWindows.delete(ipAddress)
    }
  }
}

const quotaError = () => {
  const error = new Error('本次游客体验已使用，请登录后继续提问')
  error.code = 'GUEST_LOGIN_REQUIRED'
  error.statusCode = 401
  return error
}

const rateLimitError = () => {
  const error = new Error('当前网络的游客试问较多，请登录后继续')
  error.code = 'GUEST_RATE_LIMITED'
  error.statusCode = 429
  return error
}

const reserveIpQuota = (req) => {
  const ipAddress = readClientIp(req)
  if (!ipAddress) return null

  const now = Date.now()
  let state = guestIpWindows.get(ipAddress)
  if (!state || now - state.windowStartedAt >= IP_WINDOW_MS) {
    state = { used: 0, reserved: 0, windowStartedAt: now, updatedAt: now }
    guestIpWindows.set(ipAddress, state)
  }

  if (state.used + state.reserved >= IP_QUOTA_LIMIT) throw rateLimitError()
  state.reserved += 1
  state.updatedAt = now
  return state
}

export const beginChatAccess = (req) => {
  const session = readSession(req)
  if (session) {
    return {
      kind: 'authenticated',
      session,
      responseHeaders: {},
      commit() {},
      rollback() {},
    }
  }

  cleanupExpiredSessions()
  let guestId = readSignedGuestId(req)
  let isNewGuest = false
  if (!guestId) {
    guestId = randomUUID()
    isNewGuest = true
  }

  const state = guestSessions.get(guestId) || { used: 0, reserved: false, updatedAt: Date.now() }
  if (state.used >= QUOTA_LIMIT || state.reserved) throw quotaError()

  const ipState = reserveIpQuota(req)

  state.reserved = true
  state.updatedAt = Date.now()
  guestSessions.set(guestId, state)

  let settled = false
  return {
    kind: 'guest',
    guestId,
    responseHeaders: isNewGuest ? { 'Set-Cookie': serializeGuestCookie(guestId) } : {},
    commit() {
      if (settled) return
      settled = true
      state.used += 1
      state.reserved = false
      state.updatedAt = Date.now()
      if (ipState) {
        ipState.used += 1
        ipState.reserved = Math.max(0, ipState.reserved - 1)
        ipState.updatedAt = Date.now()
      }
    },
    rollback() {
      if (settled) return
      settled = true
      state.reserved = false
      state.updatedAt = Date.now()
      if (ipState) {
        ipState.reserved = Math.max(0, ipState.reserved - 1)
        ipState.updatedAt = Date.now()
      }
    },
  }
}

export const getGuestQuotaSnapshotForTests = (guestId) => {
  const state = guestSessions.get(guestId)
  return state ? { used: state.used, reserved: state.reserved } : null
}

export const resetGuestQuotaForTests = () => {
  guestSessions.clear()
  guestIpWindows.clear()
}
