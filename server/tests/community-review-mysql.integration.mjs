import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

const safeDatabaseName = 'ai_campus_agent_ci'
if (
  process.env.MYSQL_REVIEW_TEST !== '1' ||
  process.env.MYSQL_DATABASE !== safeDatabaseName ||
  (process.env.CI !== 'true' && process.env.MYSQL_REVIEW_TEST_ALLOW_LOCAL !== '1')
) {
  throw new Error(
    `MySQL review integration requires MYSQL_REVIEW_TEST=1 and disposable database ${safeDatabaseName}`,
  )
}

process.env.AUTH_SESSION_SECRET ||= randomUUID().replaceAll('-', '').padEnd(32, '0')

const reportPath = resolve(
  process.env.MYSQL_REVIEW_RESULT_PATH || 'server/evals/ci/latest-mysql-review-ci.json',
)
const steps = []
const fixturePostIds = new Set()
const fixtureReplyIds = new Set()
const fixtureKnowledgeIds = new Set()
const connectionConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: safeDatabaseName,
  charset: 'utf8mb4',
}

const trackId = (set) => {
  const id = `ci_${randomUUID().replaceAll('-', '').slice(0, 29)}`
  assert.ok(id.length <= 32)
  set.add(id)
  return id
}

const readStep = (name, fn) => async () => {
  try {
    const detail = await fn()
    steps.push({ name, ok: true, detail: detail || 'passed' })
  } catch (error) {
    steps.push({ name, ok: false, detail: error?.code || error?.message || 'failed' })
    throw error
  }
}

const report = async () => {
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        version: 1,
        completedAt: new Date().toISOString(),
        mode: 'mysql_ci',
        database: safeDatabaseName,
        ok: steps.length > 0 && steps.every((step) => step.ok),
        steps,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

test('MySQL 8 community review transactions', async (t) => {
  const mysql = await import('mysql2/promise')
  const { closeMySqlPool, query } = await import('../mysql.mjs')
  const { handleCommunityRoute } = await import('../community.mjs')
  const { issueSessionToken } = await import('../session.mjs')
  let connection = null
  let triggerName = ''

  const runStep = async (name, fn) => t.test(name, readStep(name, fn))
  const adminToken = issueSessionToken({
    id: 'ci-review-admin',
    username: 'ci-review-admin@example.test',
    displayName: 'CI 审核员',
    role: 'admin',
  }).accessToken

  const callRoute = async ({ method, path, body = {} }) => {
    const response = { statusCode: 0, payload: null }
    const req = {
      method,
      headers: { authorization: `Bearer ${adminToken}` },
      body,
    }
    const handled = await handleCommunityRoute(req, response, new URL(path, 'http://localhost'), {
      json(res, statusCode, payload) {
        res.statusCode = statusCode
        res.payload = payload
        return payload
      },
      async parseJsonBody(request) {
        return request.body
      },
    })
    assert.notEqual(handled, false)
    return response
  }

  const createPost = async (status = 'pending') => {
    const id = trackId(fixturePostIds)
    await query(
      `INSERT INTO community_posts
        (id, author_name, author_role, title, content, category, tags, status)
       VALUES (?, 'CI 测试同学', 'student', ?, '用于审核事务集成测试的内容。', 'teaching', ?, ?)`,
      [id, `MySQL CI 审核 ${id}`, JSON.stringify(['CI', '审核']), status],
    )
    return id
  }

  const createReply = async (postId) => {
    const id = trackId(fixtureReplyIds)
    await query(
      `INSERT INTO community_replies (id, post_id, author_name, author_role, content, status)
       VALUES (?, ?, 'CI 回复同学', 'student', '用于回复审核事务测试。', 'pending')`,
      [id, postId],
    )
    return id
  }

  const reviewPost = (postId, action) =>
    callRoute({ method: 'POST', path: `/api/community/review/posts/${postId}/${action}` })
  const reviewReply = (replyId, action) =>
    callRoute({ method: 'POST', path: `/api/community/review/replies/${replyId}/${action}` })
  const generateKnowledge = (postId) =>
    callRoute({
      method: 'POST',
      path: '/api/community/knowledge/generate',
      body: { postId },
    })
  const scalar = async (sql, params = []) => {
    const rows = await query(sql, params)
    return Number(rows[0]?.total || 0)
  }
  const reviewLogCount = (targetType, targetId) =>
    scalar(
      'SELECT COUNT(*) AS total FROM community_review_logs WHERE target_type = ? AND target_id = ?',
      [targetType, targetId],
    )

  try {
    await runStep('MySQL 8 disposable database and create-only schema', async () => {
      connection = await mysql.createConnection(connectionConfig)
      const schema = await readFile(
        new URL('../sql/community-review-ci.sql', import.meta.url),
        'utf8',
      )
      const [versionRows] = await connection.query('SELECT VERSION() AS version')
      assert.match(String(versionRows[0].version), /^8\./)
      assert.doesNotMatch(
        schema.replace(/--.*$/gm, ''),
        /\bDROP\s+TABLE\b|\bTRUNCATE\b|\bCREATE\s+DATABASE\b|^\s*USE\b/im,
      )
      for (const statement of schema
        .split(';')
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await connection.query(statement)
      }
      const [schemaRows] = await connection.query(
        `SELECT COUNT(*) AS total FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = 'community_knowledge'
           AND index_name = 'uk_knowledge_post_id' AND non_unique = 0`,
        [safeDatabaseName],
      )
      assert.equal(Number(schemaRows[0].total), 1)
      return `MySQL ${versionRows[0].version}; ${safeDatabaseName}; no DROP statements`
    })

    await runStep('pending approval idempotency and opposite-state 409', async () => {
      const postId = await createPost()
      const first = await reviewPost(postId, 'approve')
      const replay = await reviewPost(postId, 'approve')
      const conflict = await reviewPost(postId, 'reject')
      assert.equal(first.statusCode, 200)
      assert.deepEqual(replay.payload.data, first.payload.data)
      assert.equal(conflict.statusCode, 409)
      assert.equal(conflict.payload.error.code, 'REVIEW_STATE_CONFLICT')
      assert.equal(conflict.payload.error.currentStatus, 'approved')
      const rows = await query('SELECT status FROM community_posts WHERE id = ?', [postId])
      assert.equal(rows[0].status, 'approved')
      assert.equal(await reviewLogCount('post', postId), 1)
      return 'same-state replay=200; opposite state=409; review logs=1'
    })

    await runStep('pending rejection idempotency and opposite-state 409', async () => {
      const postId = await createPost()
      const first = await reviewPost(postId, 'reject')
      const replay = await reviewPost(postId, 'reject')
      const conflict = await reviewPost(postId, 'approve')
      assert.equal(first.statusCode, 200)
      assert.deepEqual(replay.payload.data, first.payload.data)
      assert.equal(conflict.statusCode, 409)
      assert.equal(conflict.payload.error.code, 'REVIEW_STATE_CONFLICT')
      assert.equal(conflict.payload.error.currentStatus, 'rejected')
      const rows = await query('SELECT status FROM community_posts WHERE id = ?', [postId])
      assert.equal(rows[0].status, 'rejected')
      assert.equal(await reviewLogCount('post', postId), 1)
      return 'same-state replay=200; opposite state=409; review logs=1'
    })

    await runStep('concurrent approve/reject commits exactly one transition', async () => {
      const postId = await createPost()
      const results = await Promise.all([
        reviewPost(postId, 'approve'),
        reviewPost(postId, 'reject'),
      ])
      assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409])
      const rows = await query('SELECT status FROM community_posts WHERE id = ?', [postId])
      assert.ok(['approved', 'rejected'].includes(rows[0].status))
      assert.equal(await reviewLogCount('post', postId), 1)
      return `status=${rows[0].status}; review logs=1`
    })

    await runStep('reply state transition is pending-only and logs once', async () => {
      const postId = await createPost('approved')
      const replyId = await createReply(postId)
      const first = await reviewReply(replyId, 'approve')
      const replay = await reviewReply(replyId, 'approve')
      const conflict = await reviewReply(replyId, 'reject')
      assert.equal(first.statusCode, 200)
      assert.deepEqual(replay.payload.data, first.payload.data)
      assert.equal(conflict.statusCode, 409)
      assert.equal(conflict.payload.error.currentStatus, 'approved')
      const rows = await query('SELECT status FROM community_replies WHERE id = ?', [replyId])
      assert.equal(rows[0].status, 'approved')
      assert.equal(await reviewLogCount('reply', replyId), 1)
      return `reply=${replyId}; review logs=1`
    })

    await runStep('unapproved post generation is rejected', async () => {
      const postId = await createPost('pending')
      const response = await generateKnowledge(postId)
      assert.equal(response.statusCode, 409)
      assert.equal(response.payload.error.code, 'POST_NOT_APPROVED')
      assert.equal(response.payload.error.postStatus, 'pending')
      assert.equal(
        await scalar('SELECT COUNT(*) AS total FROM community_knowledge WHERE post_id = ?', [
          postId,
        ]),
        0,
      )
      return 'POST_NOT_APPROVED; no knowledge row'
    })

    await runStep('generation failure preserves approval and retry succeeds', async () => {
      const postId = await createPost('approved')
      triggerName = `ci_fail_${randomUUID().replaceAll('-', '').slice(0, 20)}`
      await connection.query(
        `CREATE TRIGGER \`${triggerName}\` BEFORE INSERT ON community_knowledge
         FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ci generation failure'`,
      )
      const failed = await generateKnowledge(postId)
      assert.equal(failed.statusCode, 500)
      assert.equal(failed.payload.error.code, 'KNOWLEDGE_GENERATION_FAILED')
      assert.equal(failed.payload.error.retryable, false)
      assert.equal(failed.payload.error.postStatus, 'approved')
      const beforeRetry = await query('SELECT status FROM community_posts WHERE id = ?', [postId])
      assert.equal(beforeRetry[0].status, 'approved')
      await connection.query(`DROP TRIGGER \`${triggerName}\``)
      triggerName = ''
      const retried = await generateKnowledge(postId)
      assert.equal(retried.statusCode, 200)
      fixtureKnowledgeIds.add(retried.payload.data.knowledgeId)
      assert.equal(
        await scalar('SELECT COUNT(*) AS total FROM community_knowledge WHERE post_id = ?', [
          postId,
        ]),
        1,
      )
      return 'structured failure; post remains approved; generate-only retry succeeds'
    })

    await runStep(
      'three concurrent generate calls return one knowledge row and unique key rejects duplicates',
      async () => {
        const postId = await createPost('approved')
        const results = await Promise.all([
          generateKnowledge(postId),
          generateKnowledge(postId),
          generateKnowledge(postId),
        ])
        assert.deepEqual(
          results.map((result) => result.statusCode),
          [200, 200, 200],
        )
        const ids = results.map((result) => result.payload.data.knowledgeId)
        fixtureKnowledgeIds.add(ids[0])
        assert.equal(new Set(ids).size, 1)
        assert.equal(
          await scalar('SELECT COUNT(*) AS total FROM community_knowledge WHERE post_id = ?', [
            postId,
          ]),
          1,
        )
        assert.equal(await reviewLogCount('knowledge', ids[0]), 1)
        await query("UPDATE community_knowledge SET status = 'approved' WHERE id = ?", [ids[0]])
        const replay = await generateKnowledge(postId)
        assert.equal(replay.statusCode, 200)
        assert.equal(replay.payload.data.knowledgeId, ids[0])
        assert.equal(replay.payload.data.status, 'approved')
        assert.equal(await reviewLogCount('knowledge', ids[0]), 1)
        await assert.rejects(
          connection.query(
            `INSERT INTO community_knowledge
            (id, post_id, title, summary, content, category, keywords)
           VALUES (?, ?, 'duplicate', 'duplicate', 'duplicate', 'teaching', JSON_ARRAY())`,
            [`ck_${randomUUID().slice(0, 8)}`, postId],
          ),
          (error) => error?.code === 'ER_DUP_ENTRY',
        )
        return `knowledgeId=${ids[0]}; approved replay preserves status; rows=1; duplicate post_id=ER_DUP_ENTRY`
      },
    )
  } finally {
    if (connection && triggerName) {
      await connection.query(`DROP TRIGGER IF EXISTS \`${triggerName}\``).catch(() => {})
    }
    try {
      const targetIds = [...fixturePostIds, ...fixtureReplyIds, ...fixtureKnowledgeIds]
      if (targetIds.length) {
        await query('DELETE FROM community_review_logs WHERE target_id IN (?)', [targetIds])
      }
      if (fixturePostIds.size) {
        const postIds = [...fixturePostIds]
        await query('DELETE FROM community_knowledge WHERE post_id IN (?)', [postIds])
        await query('DELETE FROM community_replies WHERE post_id IN (?)', [postIds])
        await query('DELETE FROM community_posts WHERE id IN (?)', [postIds])
      }
    } finally {
      if (connection) await connection.end()
      await closeMySqlPool().catch(() => {})
      await report()
    }
  }
})
