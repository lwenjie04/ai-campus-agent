import assert from 'node:assert/strict'
import test from 'node:test'

process.env.AUTH_SESSION_SECRET = 'competition-test-secret-at-least-32-chars'
process.env.GUEST_CHAT_LIMIT = '1'
process.env.GUEST_IP_CHAT_LIMIT = '2'

const { issueSessionToken, readSession, requireAdmin, requireSession } = await import('../session.mjs')
const { beginChatAccess, resetGuestQuotaForTests } = await import('../guest-quota.mjs')

const requestWith = (headers = {}, remoteAddress = '') => ({
  headers,
  ...(remoteAddress ? { socket: { remoteAddress } } : {}),
})

const cookieHeaderFrom = (setCookie) => String(setCookie || '').split(';')[0]

test.beforeEach(() => {
  resetGuestQuotaForTests()
})

test('signed session token restores user identity and role', () => {
  const issued = issueSessionToken({
    id: 'user-1',
    username: 'student@example.com',
    displayName: '测试同学',
    role: 'user',
  })
  const req = requestWith({ authorization: `Bearer ${issued.accessToken}` })
  const session = readSession(req)

  assert.equal(session?.userId, 'user-1')
  assert.equal(session?.displayName, '测试同学')
  assert.equal(session?.role, 'user')
  assert.equal(requireSession(req).userId, 'user-1')
  assert.throws(() => requireAdmin(req), { code: 'ADMIN_REQUIRED', statusCode: 403 })
})

test('tampered token is rejected', () => {
  const issued = issueSessionToken({ id: 'admin-1', username: 'admin', displayName: '管理员', role: 'admin' })
  const tampered = `${issued.accessToken.slice(0, -1)}x`
  const req = requestWith({ authorization: `Bearer ${tampered}` })

  assert.equal(readSession(req), null)
  assert.throws(() => requireSession(req), { code: 'AUTH_REQUIRED', statusCode: 401 })
})

test('guest receives one successful chat and is blocked on the second', () => {
  const first = beginChatAccess(requestWith())
  const cookie = cookieHeaderFrom(first.responseHeaders['Set-Cookie'])
  assert.equal(first.kind, 'guest')
  assert.ok(cookie.startsWith('campus_guest_id='))

  first.commit()

  assert.throws(() => beginChatAccess(requestWith({ cookie })), {
    code: 'GUEST_LOGIN_REQUIRED',
    statusCode: 401,
  })
})

test('failed guest chat rolls back and does not consume the trial', () => {
  const first = beginChatAccess(requestWith())
  const cookie = cookieHeaderFrom(first.responseHeaders['Set-Cookie'])
  first.rollback()

  const retry = beginChatAccess(requestWith({ cookie }))
  assert.equal(retry.kind, 'guest')
  retry.commit()
})

test('fresh private sessions share a modest per-IP abuse ceiling', () => {
  const remoteAddress = '203.0.113.18'
  const first = beginChatAccess(requestWith({}, remoteAddress))
  first.commit()
  const second = beginChatAccess(requestWith({}, remoteAddress))
  second.commit()

  assert.throws(() => beginChatAccess(requestWith({}, remoteAddress)), {
    code: 'GUEST_RATE_LIMITED',
    statusCode: 429,
  })
})

test('authenticated users bypass guest quota', () => {
  const issued = issueSessionToken({
    id: 'admin-1',
    username: 'admin',
    displayName: '管理员',
    role: 'admin',
  })
  const req = requestWith({ authorization: `Bearer ${issued.accessToken}` })

  const first = beginChatAccess(req)
  first.commit()
  const second = beginChatAccess(req)

  assert.equal(first.kind, 'authenticated')
  assert.equal(second.kind, 'authenticated')
  assert.equal(requireAdmin(req).role, 'admin')
})
