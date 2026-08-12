import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_TTL_SECONDS = Math.max(300, Number(process.env.AUTH_SESSION_TTL_SECONDS || 8 * 60 * 60))
const configuredSecret = String(process.env.AUTH_SESSION_SECRET || '').trim()
const sessionSecret = configuredSecret || randomBytes(32).toString('hex')

if (!configuredSecret) {
  console.warn('[auth-session] AUTH_SESSION_SECRET 未配置，当前使用进程级临时密钥；服务重启后需重新登录。')
}

const encodeJson = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

const decodeJson = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))

export const signOpaqueValue = (value) =>
  createHmac('sha256', sessionSecret).update(String(value)).digest('base64url')

export const verifyOpaqueValue = (value, signature) => {
  const expected = Buffer.from(signOpaqueValue(value))
  const actual = Buffer.from(String(signature || ''))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const issueSessionToken = (user) => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(user.id),
    username: String(user.username || ''),
    displayName: String(user.displayName || user.username || '用户'),
    role: user.role === 'admin' ? 'admin' : 'user',
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  }
  const encodedPayload = encodeJson(payload)
  return {
    accessToken: `${encodedPayload}.${signOpaqueValue(encodedPayload)}`,
    expiresInSeconds: SESSION_TTL_SECONDS,
  }
}

export const readSession = (req) => {
  const authorization = String(req?.headers?.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const [encodedPayload, signature] = match[1].split('.')
  if (!encodedPayload || !signature || !verifyOpaqueValue(encodedPayload, signature)) return null

  try {
    const payload = decodeJson(encodedPayload)
    if (!payload?.sub || !payload?.exp || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null
    return {
      userId: String(payload.sub),
      username: String(payload.username || ''),
      displayName: String(payload.displayName || payload.username || '用户'),
      role: payload.role === 'admin' ? 'admin' : 'user',
      expiresAt: Number(payload.exp) * 1000,
    }
  } catch {
    return null
  }
}

const authError = (code, message, statusCode) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

export const requireSession = (req) => {
  const session = readSession(req)
  if (!session) throw authError('AUTH_REQUIRED', '请先登录后再进行此操作', 401)
  return session
}

export const requireAdmin = (req) => {
  const session = requireSession(req)
  if (session.role !== 'admin') throw authError('ADMIN_REQUIRED', '该操作仅限管理员', 403)
  return session
}

export const sessionConfig = {
  ttlSeconds: SESSION_TTL_SECONDS,
  hasConfiguredSecret: Boolean(configuredSecret),
}
