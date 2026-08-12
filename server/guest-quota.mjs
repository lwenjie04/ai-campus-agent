import { randomUUID } from 'node:crypto'
import { readSession, signOpaqueValue, verifyOpaqueValue } from './session.mjs'

const COOKIE_NAME = 'campus_guest_id'
const QUOTA_LIMIT = Math.max(1, Number(process.env.GUEST_CHAT_LIMIT || 1))
const SESSION_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.GUEST_SESSION_TTL_DAYS || 30) * 86_400_000)
const guestSessions = new Map()

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
  if (!guestId || !signature || !verifyOpaqueValue(guestId, signature)) return ''
  return guestId
}

const serializeGuestCookie = (guestId) => {
  const value = `${guestId}.${signOpaqueValue(guestId)}`
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`
}

const cleanupExpiredSessions = () => {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [guestId, state] of guestSessions.entries()) {
    if (state.updatedAt < cutoff) guestSessions.delete(guestId)
  }
}

const quotaError = () => {
  const error = new Error('本次游客体验已使用，请登录后继续提问')
  error.code = 'GUEST_LOGIN_REQUIRED'
  error.statusCode = 401
  return error
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
    },
    rollback() {
      if (settled) return
      settled = true
      state.reserved = false
      state.updatedAt = Date.now()
    },
  }
}

export const getGuestQuotaSnapshotForTests = (guestId) => {
  const state = guestSessions.get(guestId)
  return state ? { used: state.used, reserved: state.reserved } : null
}

export const resetGuestQuotaForTests = () => guestSessions.clear()
