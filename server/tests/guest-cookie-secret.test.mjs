import assert from 'node:assert/strict'
import test from 'node:test'

// 在动态导入 guest-quota.mjs 前设置环境变量，验证独立游客 Cookie 密钥路径。
process.env.AUTH_SESSION_SECRET = 'session-secret-competition-test-32-chars'
process.env.GUEST_COOKIE_SECRET = 'guest-secret-competition-test-32-chars'
process.env.GUEST_CHAT_LIMIT = '1'
process.env.GUEST_IP_CHAT_LIMIT = '2'

const { beginChatAccess, resetGuestQuotaForTests } = await import('../guest-quota.mjs')

const cookieHeaderFrom = (setCookie) => String(setCookie || '').split(';')[0]

test.beforeEach(() => {
  resetGuestQuotaForTests()
})

test('M1: guest cookie signed with GUEST_COOKIE_SECRET keeps quota across calls', () => {
  const first = beginChatAccess({ headers: {} })
  const cookie = cookieHeaderFrom(first.responseHeaders['Set-Cookie'])
  assert.ok(cookie.startsWith('campus_guest_id='))

  first.commit()

  // 同一个带独立密钥签名的 Cookie 能恢复原游客身份，因此第二次会被配额拦截。
  assert.throws(() => beginChatAccess({ headers: { cookie } }), {
    code: 'GUEST_LOGIN_REQUIRED',
    statusCode: 401,
  })
})

test('M1: tampered guest cookie does not restore the original guest identity', () => {
  const first = beginChatAccess({ headers: {} })
  first.commit()

  const tamperedCookie = `campus_guest_id=${first.guestId}.tampered-signature`
  const fresh = beginChatAccess({ headers: { cookie: tamperedCookie } })

  assert.equal(fresh.kind, 'guest')
  assert.notEqual(fresh.guestId, first.guestId)
  fresh.commit()
})