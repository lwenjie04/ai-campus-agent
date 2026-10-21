import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

process.env.AUTH_SESSION_SECRET = 'community-review-test-secret-at-least-32-chars'
process.env.MYSQL_HOST = '127.0.0.1'
process.env.MYSQL_PORT = '1'
process.env.COMMUNITY_ENABLE_TEST_HELPERS = 'true'

const { issueSessionToken } = await import('../session.mjs')
const { communityTestSupport, handleCommunityRoute } = await import('../community.mjs')

const adminToken = issueSessionToken({
  id: 'review-admin',
  username: 'review-admin@example.test',
  displayName: '审核管理员',
  role: 'admin',
}).accessToken

const memberToken = issueSessionToken({
  id: 'review-member',
  username: 'review-member@example.test',
  displayName: '投稿同学',
  role: 'user',
}).accessToken

const callRoute = async ({ method, path, token = '', body = {} }) => {
  const response = { statusCode: 0, payload: null }
  const req = {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  }
  const handled = await handleCommunityRoute(
    req,
    response,
    new URL(path, 'http://localhost:3000'),
    {
      json(res, statusCode, payload) {
        res.statusCode = statusCode
        res.payload = payload
        return payload
      },
      async parseJsonBody(request) {
        return request.body
      },
    },
  )

  assert.notEqual(handled, false)
  return response
}

const createPendingPost = async () => {
  const response = await callRoute({
    method: 'POST',
    path: '/api/community/posts',
    token: memberToken,
    body: {
      title: `审核状态测试 ${Math.random().toString(36).slice(2, 9)}`,
      content: '这是用于审核状态测试的帖子内容。',
      category: 'teaching',
      tags: ['测试'],
    },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.payload.data.status, 'pending')
  return response.payload.data.id
}

const reviewPost = (postId, action) =>
  callRoute({
    method: 'POST',
    path: `/api/community/review/posts/${postId}/${action}`,
    token: adminToken,
  })

const generateKnowledge = (postId) =>
  callRoute({
    method: 'POST',
    path: '/api/community/knowledge/generate',
    token: adminToken,
    body: { postId },
  })

const logsFor = (targetType, targetId) =>
  communityTestSupport
    .snapshot()
    .reviewLogs.filter((item) => item.targetType === targetType && item.targetId === targetId)

test('pending post approval is idempotent and opposite review returns 409 without a second log', async () => {
  const postId = await createPendingPost()

  const firstApprove = await reviewPost(postId, 'approve')
  const repeatedApprove = await reviewPost(postId, 'approve')
  const rejectApproved = await reviewPost(postId, 'reject')

  assert.equal(firstApprove.statusCode, 200)
  assert.deepEqual(repeatedApprove.payload.data, firstApprove.payload.data)
  assert.equal(rejectApproved.statusCode, 409)
  assert.equal(rejectApproved.payload.error.code, 'REVIEW_STATE_CONFLICT')
  assert.equal(rejectApproved.payload.error.currentStatus, 'approved')
  assert.equal(
    communityTestSupport.snapshot().posts.find((item) => item.id === postId).status,
    'approved',
  )
  assert.equal(logsFor('post', postId).length, 1)
})

test('pending post rejection is idempotent and cannot later be approved', async () => {
  const postId = await createPendingPost()

  const firstReject = await reviewPost(postId, 'reject')
  const repeatedReject = await reviewPost(postId, 'reject')
  const approveRejected = await reviewPost(postId, 'approve')

  assert.equal(firstReject.statusCode, 200)
  assert.deepEqual(repeatedReject.payload.data, firstReject.payload.data)
  assert.equal(approveRejected.statusCode, 409)
  assert.equal(approveRejected.payload.error.currentStatus, 'rejected')
  assert.equal(logsFor('post', postId).length, 1)
})

test('approve and reject racing for one pending post produce one transition and one review log', async () => {
  const postId = await createPendingPost()

  const results = await Promise.all([reviewPost(postId, 'approve'), reviewPost(postId, 'reject')])

  assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409])
  assert.equal(logsFor('post', postId).length, 1)
})

test('reply approval and rejection follow the same pending-only state machine', async () => {
  const replyApproved = await callRoute({
    method: 'POST',
    path: '/api/community/posts/post_demo_001/replies',
    token: memberToken,
    body: { content: '用于验证回复审核状态转换。' },
  })
  const replyRejected = await callRoute({
    method: 'POST',
    path: '/api/community/posts/post_demo_001/replies',
    token: memberToken,
    body: { content: '用于验证回复拒绝状态转换。' },
  })
  const approvedId = replyApproved.payload.data.id
  const rejectedId = replyRejected.payload.data.id

  assert.equal(
    (
      await callRoute({
        method: 'POST',
        path: `/api/community/review/replies/${approvedId}/approve`,
        token: adminToken,
      })
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await callRoute({
        method: 'POST',
        path: `/api/community/review/replies/${approvedId}/approve`,
        token: adminToken,
      })
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await callRoute({
        method: 'POST',
        path: `/api/community/review/replies/${approvedId}/reject`,
        token: adminToken,
      })
    ).statusCode,
    409,
  )
  assert.equal(
    (
      await callRoute({
        method: 'POST',
        path: `/api/community/review/replies/${rejectedId}/reject`,
        token: adminToken,
      })
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await callRoute({
        method: 'POST',
        path: `/api/community/review/replies/${rejectedId}/approve`,
        token: adminToken,
      })
    ).statusCode,
    409,
  )
  assert.equal(logsFor('reply', approvedId).length, 1)
  assert.equal(logsFor('reply', rejectedId).length, 1)
})

test('knowledge generation rejects unreviewed posts and leaves their state unchanged', async () => {
  const postId = await createPendingPost()

  const response = await generateKnowledge(postId)

  assert.equal(response.statusCode, 409)
  assert.equal(response.payload.error.code, 'POST_NOT_APPROVED')
  assert.equal(response.payload.error.postStatus, 'pending')
  assert.equal(response.payload.error.retryable, false)
  assert.equal(
    communityTestSupport.snapshot().knowledge.some((item) => item.postId === postId),
    false,
  )
})

test('generation failure reports that approval remains complete and retrying only generation succeeds', async () => {
  const postId = await createPendingPost()
  assert.equal((await reviewPost(postId, 'approve')).statusCode, 200)
  communityTestSupport.failNextKnowledgeGeneration(
    Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }),
  )

  const failed = await generateKnowledge(postId)
  const retried = await generateKnowledge(postId)

  assert.equal(failed.statusCode, 503)
  assert.equal(failed.payload.error.code, 'KNOWLEDGE_GENERATION_FAILED')
  assert.equal(failed.payload.error.retryable, true)
  assert.equal(failed.payload.error.postStatus, 'approved')
  assert.equal(retried.statusCode, 200)
  assert.equal(
    communityTestSupport.snapshot().posts.find((item) => item.id === postId).status,
    'approved',
  )
  assert.equal(logsFor('post', postId).length, 1)
  assert.equal(logsFor('knowledge', retried.payload.data.knowledgeId).length, 1)
})

test('three concurrent generation requests return one knowledgeId and create one row', async () => {
  const postId = await createPendingPost()
  await reviewPost(postId, 'approve')

  const responses = await Promise.all([
    generateKnowledge(postId),
    generateKnowledge(postId),
    generateKnowledge(postId),
  ])
  const knowledgeIds = responses.map((response) => response.payload.data.knowledgeId)
  const snapshot = communityTestSupport.snapshot()

  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [200, 200, 200],
  )
  assert.equal(new Set(knowledgeIds).size, 1)
  assert.equal(snapshot.knowledge.filter((item) => item.postId === postId).length, 1)
  assert.equal(logsFor('knowledge', knowledgeIds[0]).length, 1)
})

test('community schema enforces one knowledge row per post', async () => {
  const schema = await readFile(new URL('../sql/community-feature-v1.sql', import.meta.url), 'utf8')
  assert.match(schema, /UNIQUE KEY `uk_knowledge_post_id`\s*\(`post_id`\)/)
})
