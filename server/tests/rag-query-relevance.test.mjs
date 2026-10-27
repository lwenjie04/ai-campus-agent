import assert from 'node:assert/strict'
import test from 'node:test'

process.env.RAG_KNOWLEDGE_BASE_PATH = 'server/data/knowledge-base.json'
process.env.RAG_VECTOR_ENABLED = 'false'
process.env.RAG_LOG_ENABLED = 'false'

const { searchKnowledgeBase } = await import('../rag.mjs')

test('supported queries still retrieve a matching campus notice', async () => {
  const hits = await searchKnowledgeBase('补考怎么报名？', {
    limit: 3,
    includeCommunity: false,
  })

  assert.match(hits[0]?.title || '', /第二学期补考、成绩录入和毕业审核安排/)
})

test('future dated campus notices are not reused for a different year', async () => {
  const hits = await searchKnowledgeBase('2027年上半年英语四六级报名的具体日期是哪天？', {
    limit: 3,
    includeCommunity: false,
  })

  assert.deepEqual(hits, [])
})

test('personal secrets and unsupported real-time cafeteria prices return no sources', async () => {
  const privateDataHits = await searchKnowledgeBase('我绑定的银行卡密码是多少？', {
    limit: 3,
    includeCommunity: false,
  })
  const cafeteriaPriceHits = await searchKnowledgeBase('今天花都校区食堂二楼红烧排骨多少钱？', {
    limit: 3,
    includeCommunity: false,
  })

  assert.deepEqual(privateDataHits, [])
  assert.deepEqual(cafeteriaPriceHits, [])
})

test('generic nearby housing queries do not cite unrelated campus documents', async () => {
  const hits = await searchKnowledgeBase('学校附近哪个小区租房最便宜？', {
    limit: 3,
    includeCommunity: false,
  })

  assert.deepEqual(hits, [])
})
