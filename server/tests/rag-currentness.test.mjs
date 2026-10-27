import assert from 'node:assert/strict'
import test from 'node:test'

process.env.AUTH_SESSION_SECRET = 'rag-currentness-test-session-secret-32-chars'
process.env.RAG_LOG_ENABLED = 'false'
process.env.RAG_VECTOR_ENABLED = 'false'

const { buildRagContext } = await import('../rag.mjs')
const { formatLightragContext } = await import('../lightrag.mjs')

test('knowledge-base context labels source period and refuses to treat old or undated rules as current', () => {
  const context = buildRagContext([
    {
      title: '2025-2026学年通知',
      authority: '教务处',
      applicablePeriod: '2025-2026学年第二学期',
      publishedAt: '2026-03-10',
      updatedAt: '',
      validity: 'unknown',
      content: '标题和发布者信息',
    },
  ])

  assert.match(context, /适用时期：2025-2026学年第二学期/)
  assert.match(context, /发布日期：2026-03-10/)
  assert.match(context, /更新时间：未知/)
  assert.match(context, /旧年度通知只能作为历史参考/)
  assert.match(context, /只有标题、发布者、日期或附件线索而没有正文/)
  assert.match(context, /说明冲突和不确定性/)
})

test('LightRAG context carries the same currentness and missing-body rules', () => {
  const context = formatLightragContext('2025-2026学年第二学期通知：标题，无安排正文。', 'hybrid')

  assert.match(context, /旧年度通知只能作为历史参考/)
  assert.match(context, /只有标题、发布者、日期或附件线索而没有正文/)
  assert.match(context, /说明冲突和不确定性/)
})

test('empty retrieval contexts stay empty', () => {
  assert.equal(buildRagContext([]), '')
  assert.equal(formatLightragContext('', 'hybrid'), '')
})
