import assert from 'node:assert/strict'
import test from 'node:test'

process.env.AUTH_SESSION_SECRET = 'rag-confidence-test-session-secret-32-chars'
process.env.RAG_LOG_ENABLED = 'false'
process.env.RAG_VECTOR_ENABLED = 'false'

const { filterConfidentRagHits } = await import('../rag.mjs')

test('answer confidence filtering removes weak candidates and preserves strong matches unchanged', () => {
  const weak = { id: 'weak', title: 'Unrelated candidate', score: 0.5 }
  const boundary = { id: 'boundary', title: 'Minimum trusted candidate', score: 3 }
  const strong = { id: 'strong', title: 'Exact campus match', score: 24 }

  const filtered = filterConfidentRagHits([weak, boundary, strong], { minScore: 3 })

  assert.deepEqual(
    filtered.map((hit) => hit.id),
    ['boundary', 'strong'],
  )
  assert.equal(filtered[0], boundary)
  assert.equal(filtered[1], strong)
})

test('answer confidence filtering rejects missing and non-numeric scores', () => {
  assert.deepEqual(
    filterConfidentRagHits([{ id: 'missing' }, { id: 'invalid', score: 'not-a-number' }]),
    [],
  )
})
