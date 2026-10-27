import assert from 'node:assert/strict'
import test from 'node:test'

process.env.RAG_KNOWLEDGE_BASE_PATH = 'server/data/knowledge-base.json'
process.env.RAG_VECTOR_ENABLED = 'false'
process.env.RAG_LOG_ENABLED = 'false'

const { searchKnowledgeBase } = await import('../rag.mjs')

// 5.4：长句查询里只有 2 字领域词（调宿/补考等）时，仍要召回对应事项通知。
test('long colloquial dorm query still retrieves the adjustment notice', async () => {
  const hits = await searchKnowledgeBase(
    '我需要办理调宿，请查找当前通知和表单，并确认办理时间；不要沿用往年截止日期。',
    { limit: 3, includeCommunity: false },
  )

  assert.match(hits[0]?.title || '', /宿舍退宿、调宿办理/)
})

test('long exam query prefers the semester notice over generic documents', async () => {
  const hits = await searchKnowledgeBase(
    '我想查询本学期课程补考安排或补考成绩录入时间，请提供最新教务通知；如果通知未覆盖我的课程，请建议我向教务部门确认。',
    { limit: 3, includeCommunity: false },
  )

  assert.match(hits[0]?.title || '', /第二学期补考、成绩录入和毕业审核安排/)
})
