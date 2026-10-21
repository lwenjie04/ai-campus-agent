import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adaptMessageSources } from '../source-adapter.mjs'
import { lightragContextToSources } from '../lightrag.mjs'
import { ragHitsToSources } from '../rag.mjs'
import { buildRuleBasedSources } from '../sources-rules.mjs'

test('source adapter normalizes knowledge-base metadata and canonical download routes', () => {
  const [source] = adaptMessageSources([
    {
      id: 'notice-2026-01',
      type: 'official_notice',
      title: '考试安排',
      url: '/kb/download?id=notice-2026-01',
      attachments: [{ name: '通知.pdf', url: '/kb/download?id=file-1', mimeType: 'application/pdf' }],
      publishedAt: '2026-03-14',
      updatedAt: 'March 2026',
      applicablePeriod: '2025-2026 学年第二学期',
      confidence: 0.92,
      validity: 'unverified-current',
    },
  ])

  assert.equal(source.sourceId, 'official:notice-2026-01')
  assert.equal(source.type, 'official')
  assert.equal(source.url, '/api/kb/download?id=notice-2026-01')
  assert.deepEqual(source.attachments, [
    { name: '通知.pdf', url: '/api/kb/download?id=file-1', mimeType: 'application/pdf' },
  ])
  assert.equal(source.publishedAt, '2026-03-14')
  assert.equal(source.updatedAt, null)
  assert.equal(source.applicablePeriod, '2025-2026 学年第二学期')
  assert.equal(source.validity, 'unknown')
  assert.equal('confidence' in source, false)
})

test('source adapter maps community, rule, and LightRAG origins to stable contract types', () => {
  const sources = adaptMessageSources([
    { id: 'community-1', postId: 'post-1', type: 'community_summary', title: '同学经验' },
    { type: 'academic_system', title: '教务系统 / 教务通知（规则匹配）' },
    { id: 'ref-1', type: 'lightrag', title: 'handbook.pdf' },
    { id: 'kb-1', type: 'attachment_index', title: '手册章节', isOfficial: true },
  ])

  assert.deepEqual(sources.map(({ type }) => type), ['community', 'rule', 'lightrag', 'official'])
  assert.equal(sources[0].sourceId, 'community:community-1')
  assert.match(sources[1].sourceId, /^rule:[a-f0-9]{20}$/)
  assert.equal(sources[2].sourceId, 'lightrag:ref-1')
  assert.equal(sources[3].sourceId, 'official:kb-1')
  assert.equal(sources[0].postId, 'post-1')
  assert.ok(sources.every((source) => source.validity === 'unknown'))
  assert.ok(sources.every((source) => source.publishedAt === null && source.updatedAt === null))
})

test('source adapter skips invalid values and does not infer dates or validity', () => {
  assert.deepEqual(adaptMessageSources(null), [])
  const [source] = adaptMessageSources([null, 'ignore', { title: '未知时效', publishedAt: '2026', validity: null }])
  assert.equal(source.publishedAt, null)
  assert.equal(source.validity, 'unknown')
  assert.match(source.sourceId, /^knowledge_base:[a-f0-9]{20}$/)
})

test('RAG, LightRAG, and rule sources all pass through the canonical adapter', () => {
  const rag = ragHitsToSources([
    { id: 'official-1', sourceType: 'official_notice', title: '教务通知', updatedAt: '2026-10-20' },
    { id: 'community-1', sourceType: 'community_summary', postId: 'post-1', title: '学生经验' },
  ])
  const lightrag = lightragContextToSources('', [
    { reference_id: 'ref-1', file_path: 'handbook.pdf', content: '手册内容' },
  ])
  const rule = buildRuleBasedSources('选课安排', 'teaching', 'real')

  assert.deepEqual(
    [
      ...adaptMessageSources(rag),
      ...adaptMessageSources(lightrag),
      ...adaptMessageSources(rule),
    ].map(({ type }) => type),
    ['official', 'community', 'lightrag', 'rule', 'rule'],
  )
  assert.equal(adaptMessageSources(rag)[0].updatedAt, '2026-10-20')
  assert.equal(adaptMessageSources(rag)[1].postId, 'post-1')
  assert.equal(adaptMessageSources(lightrag)[0].sourceId, 'lightrag:ref-1')
})
