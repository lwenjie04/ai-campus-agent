import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEmbeddingText, embedText, searchVectorIndex } from '../vector-index.mjs'

const buildHashItem = async ({ id, title, content }) => {
  const item = {
    id,
    title,
    content,
    category: 'teaching',
    keywords: [],
  }
  const embeddingText = buildEmbeddingText(item)
  const embedding = await embedText(embeddingText, { provider: 'hash', dimension: 64 })
  return {
    ...item,
    embeddingProvider: 'hash',
    embeddingModel: 'hash-64',
    embeddingDimension: 64,
    embedding,
  }
}

test('self-described hash index stays local even when runtime config uses another provider', async () => {
  const indexItems = await Promise.all([
    buildHashItem({
      id: 'makeup',
      title: '补考报名安排',
      content: '学生补考报名、考试安排和成绩录入办理说明。',
    }),
    buildHashItem({
      id: 'dorm',
      title: '宿舍报修说明',
      content: '学生宿舍空调、热水器和门锁报修流程。',
    }),
  ])

  const results = await searchVectorIndex('补考怎么报名', { indexItems, limit: 2 })
  assert.equal(results.length, 2)
  assert.equal(results[0].id, 'makeup')
})

test('mixed-provider indexes are rejected instead of producing misleading scores', async () => {
  const hashItem = await buildHashItem({
    id: 'makeup',
    title: '补考报名安排',
    content: '补考报名说明。',
  })
  const results = await searchVectorIndex('补考报名', {
    indexItems: [hashItem, { ...hashItem, id: 'mixed', embeddingProvider: 'openai_compatible' }],
  })
  assert.deepEqual(results, [])
})
