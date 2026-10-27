import assert from 'node:assert/strict'
import test from 'node:test'

process.env.RAG_VECTOR_ENABLED = 'false'
process.env.RAG_LOG_ENABLED = 'false'

const { formatPolicyUpdateContext, matchPolicyUpdates, mergePolicySources, policyUpdatesToSources } =
  await import('../policy-updates.mjs')
const { buildRagContext } = await import('../rag.mjs')
const { formatLightragContext } = await import('../lightrag.mjs')

test('amount question matches the current policy note', () => {
  const matched = matchPolicyUpdates('现在国家奖助学金实施办法标准是多少？')

  assert.equal(matched.length, 1)
  assert.equal(matched[0].id, 'national-scholarship-amounts-2024')
})

test('question needs both topic and amount intent to inject the note', () => {
  assert.equal(formatPolicyUpdateContext('国家奖学金金额是多少？').length > 0, true)
  assert.equal(formatPolicyUpdateContext('申请国家奖学金对年级和成绩排名有什么要求？'), '')
  assert.equal(formatPolicyUpdateContext('学校有哪些奖学金？'), '')
})

test('RAG and LightRAG contexts include current amounts and the supersede rule', () => {
  const hits = [
    {
      title: '广东第二师范学院国家奖助学金实施办法',
      content: '国家奖学金 8000 元、国家励志奖学金 5000 元。',
      sourceType: 'student_handbook',
    },
  ]

  const ragContext = buildRagContext(hits, { query: '国家奖学金金额是多少？' })
  assert.match(ragContext, /现行政策提示/)
  assert.match(ragContext, /10000 元/)
  assert.match(ragContext, /6000 元/)
  assert.match(ragContext, /旧标准已不适用/)

  const lightragContext = formatLightragContext('学生手册：国家奖学金 8000 元', 'hybrid', {
    query: '国家奖学金金额是多少？',
  })
  assert.match(lightragContext, /现行政策提示/)
  assert.match(lightragContext, /10000 元/)
})

test('policy sources expose the verified official notices', () => {
  const sources = policyUpdatesToSources('国家励志奖学金奖励标准是多少？')

  assert.equal(sources.length, 2)
  assert.match(sources[0].title, /财政部、教育部/)
  assert.equal(sources[0].validity, 'current')
  assert.match(sources[1].url, /gdei\.edu\.cn/)
})

test('policy sources replace duplicate knowledge-base sources with the same title', () => {
  const duplicate = {
    title: '关于做好2024-2025学年国家奖学金和国家励志奖学金评审工作的通知',
    type: 'official_notice',
    url: '/kb/download?id=abc',
  }
  const other = { title: '其他来源', type: 'knowledge_base', url: '/kb/download?id=other' }

  const merged = mergePolicySources('国家奖学金金额是多少？', [duplicate, other])

  assert.equal(merged.length, 3)
  assert.match(merged[0].title, /财政部、教育部/)
  assert.equal(merged.filter((source) => source.title === duplicate.title).length, 1)
  assert.match(merged.find((source) => source.title === duplicate.title)?.url || '', /gdei\.edu\.cn/)
  assert.equal(merged.at(-1).title, '其他来源')
})

test('non-matching query keeps original sources untouched', () => {
  const sources = [{ title: '示例来源', type: 'knowledge_base', url: '/kb/download?id=1' }]

  assert.deepEqual(mergePolicySources('国家奖学金申请条件是什么？', sources), sources)
})

test('context stays unchanged without a matching query', () => {
  const context = buildRagContext([{ title: '示例资料', content: '示例内容' }])

  assert.doesNotMatch(context, /现行政策提示/)
  assert.equal(buildRagContext([], { query: '国家奖学金金额是多少？' }), '')
})
