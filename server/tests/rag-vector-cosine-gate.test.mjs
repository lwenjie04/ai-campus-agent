import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { filterVectorHitsByMinCosine } from '../rag.mjs'
import { embedText } from '../vector-index.mjs'

const RAG_URL = new URL('../rag.mjs', import.meta.url).href
const QUERY = '补考怎么报名'

// Runs searchKnowledgeBase in a child process whose cwd is a throwaway fixture
// root, so rag.mjs/vector-index.mjs resolve their data paths inside the fixture
// instead of the repository's generated index.
const runSearchInFixture = (cwd, env) =>
  new Promise((resolve, reject) => {
    const script = [
      `const { searchKnowledgeBase } = await import(${JSON.stringify(RAG_URL)})`,
      `const hits = await searchKnowledgeBase(${JSON.stringify(QUERY)}, { limit: 5, minScore: 0, includeCommunity: false })`,
      `process.stdout.write(JSON.stringify(hits.map((hit) => ({ id: hit.id, score: Number((Number(hit.score) || 0).toFixed(3)) }))))`,
    ].join('\n')

    execFile(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        cwd,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`fixture search failed: ${error.message}\n${stderr}`))
          return
        }
        try {
          resolve(JSON.parse(stdout))
        } catch {
          reject(new Error(`unexpected fixture output: ${stdout}\n${stderr}`))
        }
      },
    )
  })

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'rag-vector-cosine-'))
  const dataDir = join(root, 'server', 'data')
  await mkdir(dataDir, { recursive: true })

  const queryEmbedding = await embedText(QUERY, { provider: 'hash', dimension: 4 })
  // 与查询向量正交，余弦相似度为 0，模拟弱语义命中。
  const orthogonalEmbedding = [
    queryEmbedding[1],
    -queryEmbedding[0],
    queryEmbedding[3],
    -queryEmbedding[2],
  ]

  const buildChunk = ({ id, title, content, embedding }) => ({
    id,
    docId: id,
    chunkIndex: 1,
    title,
    sectionTitle: 'body',
    category: 'exam',
    sourceType: 'official_notice',
    sourceStatus: 'approved',
    url: '',
    keywords: [],
    isOfficial: true,
    priority: 0,
    content,
    contentPreview: content,
    postId: '',
    embeddingProvider: 'hash',
    embeddingModel: 'hash-4',
    embeddingDimension: 4,
    embedding,
  })

  const index = [
    buildChunk({
      id: 'cosine-high',
      title: '补考报名安排',
      content: '补考报名、考试安排与成绩录入说明。',
      embedding: queryEmbedding,
    }),
    buildChunk({
      id: 'cosine-low',
      title: '校园卡挂失补办',
      content: '校园卡丢失后的挂失与补办流程。',
      embedding: orthogonalEmbedding,
    }),
  ]
  await writeFile(join(dataDir, 'vector-index.json'), JSON.stringify(index), 'utf8')

  // 知识库只放强命中条目，确保弱命中只能通过向量通道进入结果。
  const knowledgeBase = [
    {
      id: 'cosine-high',
      title: '补考报名安排',
      content: '补考报名、考试安排与成绩录入说明。',
      category: 'exam',
      keywords: [],
      sourceType: 'official_notice',
      isOfficial: true,
      url: '',
    },
  ]
  const kbPath = join(root, 'knowledge-base.json')
  await writeFile(kbPath, JSON.stringify(knowledgeBase), 'utf8')

  return { root, kbPath }
}

test('filterVectorHitsByMinCosine filters weak hits only when a threshold is configured', () => {
  const hits = [
    { id: 'strong', vectorScore: 0.72 },
    { id: 'weak', vectorScore: 0.31 },
    { id: 'missing-score' },
  ]

  assert.deepEqual(
    filterVectorHitsByMinCosine(hits, { minCosine: 0.6 }).map((hit) => hit.id),
    ['strong'],
  )
  assert.equal(filterVectorHitsByMinCosine(hits, { minCosine: 0 }).length, 3)
  assert.deepEqual(filterVectorHitsByMinCosine([], { minCosine: 0.6 }), [])
  assert.deepEqual(filterVectorHitsByMinCosine(null, { minCosine: 0.6 }), [])
})

test('searchKnowledgeBase applies the vector cosine gate only when configured', async () => {
  const fixture = await createFixture()
  const baseEnv = {
    RAG_KNOWLEDGE_BASE_PATH: fixture.kbPath,
    RAG_VECTOR_ENABLED: 'true',
    RAG_LOG_ENABLED: 'false',
    LIGHTRAG_PRIMARY: 'false',
    MYSQL_PORT: '1',
    RAG_WEIGHT_VECTOR_SCORE: '6',
  }

  try {
    const gated = await runSearchInFixture(fixture.root, {
      ...baseEnv,
      RAG_VECTOR_MIN_COSINE: '0.6',
    })
    const ungated = await runSearchInFixture(fixture.root, {
      ...baseEnv,
      RAG_VECTOR_MIN_COSINE: '0',
    })

    const gatedIds = gated.map((hit) => hit.id)
    const ungatedIds = ungated.map((hit) => hit.id)

    assert.ok(gatedIds.includes('cosine-high'), 'strong semantic hit should stay')
    assert.ok(!gatedIds.includes('cosine-low'), 'weak semantic hit should be gated out')
    assert.ok(ungatedIds.includes('cosine-high'))
    assert.ok(ungatedIds.includes('cosine-low'), 'gate disabled keeps weak hits')
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
