import assert from 'node:assert/strict'
import test from 'node:test'

process.env.AUTH_SESSION_SECRET = 'competition-test-secret-at-least-32-chars'

const { issueSessionToken } = await import('../session.mjs')
const { handleCommunityRoute } = await import('../community.mjs')

const callRoute = async ({ method, path, authorization = '' }) => {
  const response = { statusCode: 0, payload: null }
  const req = {
    method,
    headers: authorization ? { authorization } : {},
  }
  const requestUrl = new URL(path, 'http://localhost:3000')
  const handled = await handleCommunityRoute(req, response, requestUrl, {
    json(res, statusCode, payload) {
      res.statusCode = statusCode
      res.payload = payload
      return payload
    },
    async parseJsonBody() {
      throw new Error('protected route parsed body before authorization')
    },
  })
  return { handled, response }
}

test('anonymous users cannot create community posts', async () => {
  const { handled, response } = await callRoute({ method: 'POST', path: '/community/posts' })
  assert.equal(handled, true)
  assert.equal(response.statusCode, 401)
  assert.equal(response.payload.code, 'AUTH_REQUIRED')
})

test('anonymous users cannot read review queues', async () => {
  const { handled, response } = await callRoute({ method: 'GET', path: '/community/review/posts' })
  assert.equal(handled, true)
  assert.equal(response.statusCode, 401)
  assert.equal(response.payload.code, 'AUTH_REQUIRED')
})

test('normal users cannot call administrator knowledge routes', async () => {
  const issued = issueSessionToken({
    id: 'user-1',
    username: 'student@example.com',
    displayName: '测试同学',
    role: 'user',
  })
  const { handled, response } = await callRoute({
    method: 'GET',
    path: '/community/knowledge',
    authorization: `Bearer ${issued.accessToken}`,
  })

  assert.equal(handled, true)
  assert.equal(response.statusCode, 403)
  assert.equal(response.payload.code, 'ADMIN_REQUIRED')
})
