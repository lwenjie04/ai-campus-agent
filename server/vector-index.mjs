import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return

  const text = readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), 'server/.env'))
loadEnvFile(resolve(process.cwd(), '.env.server'))

const DEFAULT_INDEX_PATH = resolve(process.cwd(), 'server/data/vector-index.json')

const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const EMBEDDING_TIMEOUT_MS = toNumber(process.env.VECTOR_EMBEDDING_TIMEOUT_MS, 30000)

const normalizeText = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const tokenizeText = (input) => {
  const text = normalizeText(input).toLowerCase()
  if (!text) return []

  const tokens = new Set()
  const words = text
    .split(/[\s,，。！？；:：、（）()\[\]{}"'“”‘’<>《》【】「」\-_\\/]+/g)
    .filter(Boolean)

  for (const word of words) {
    if (word.length >= 2) tokens.add(word)
  }

  const chineseRuns = text.match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const run of chineseRuns) {
    const maxGram = Math.min(4, run.length)
    for (let size = 2; size <= maxGram; size += 1) {
      for (let i = 0; i <= run.length - size; i += 1) {
        tokens.add(run.slice(i, i + size))
      }
    }
  }

  return Array.from(tokens)
}

const hashToken = (token) => {
  let hash = 2166136261
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!norm) return vector
  return vector.map((value) => value / norm)
}

const buildHashEmbedding = (text, dimension) => {
  const vector = new Array(dimension).fill(0)
  const tokens = tokenizeText(text)

  for (const token of tokens) {
    const hash = hashToken(token)
    const index = hash % dimension
    const sign = (hash & 1) === 0 ? 1 : -1
    const weight = Math.max(1, Math.min(4, token.length / 2))
    vector[index] += sign * weight
  }

  return normalizeVector(vector)
}

const createOpenAICompatibleEmbeddingClient = () => {
  const baseUrl =
    process.env.VECTOR_EMBEDDING_API_BASE_URL ||
    process.env.EMBEDDING_API_BASE_URL ||
    ''
  const apiKey =
    process.env.VECTOR_EMBEDDING_API_KEY ||
    process.env.EMBEDDING_API_KEY ||
    ''
  const model =
    process.env.VECTOR_EMBEDDING_MODEL ||
    process.env.EMBEDDING_MODEL ||
    ''

  if (!baseUrl || !apiKey || !model) {
    const error = new Error('VECTOR_EMBEDDING_CONFIG_MISSING')
    error.code = 'VECTOR_EMBEDDING_CONFIG_MISSING'
    throw error
  }

  return async (text) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS)

    let response
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`VECTOR_EMBEDDING_TIMEOUT:${EMBEDDING_TIMEOUT_MS}`)
        timeoutError.code = 'VECTOR_EMBEDDING_TIMEOUT'
        throw timeoutError
      }
      throw error
    } finally {
      clearTimeout(timer)
    }

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Embedding HTTP ${response.status}`)
      error.code = 'VECTOR_EMBEDDING_UPSTREAM_ERROR'
      error.details = payload
      throw error
    }

    const embedding = payload?.data?.[0]?.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      const error = new Error('VECTOR_EMBEDDING_EMPTY')
      error.code = 'VECTOR_EMBEDDING_EMPTY'
      error.details = payload
      throw error
    }

    return normalizeVector(embedding.map((value) => Number(value) || 0))
  }
}

const EMBEDDING_PROVIDER = (process.env.VECTOR_EMBEDDING_PROVIDER || 'hash').trim().toLowerCase()
const HASH_EMBEDDING_DIM = toNumber(process.env.VECTOR_EMBEDDING_DIM, 256)

let openAICompatibleEmbedding = null

export const getEmbeddingConfig = () => ({
  provider: EMBEDDING_PROVIDER,
  dimension: HASH_EMBEDDING_DIM,
  model:
    process.env.VECTOR_EMBEDDING_MODEL ||
    process.env.EMBEDDING_MODEL ||
    (EMBEDDING_PROVIDER === 'hash' ? `hash-${HASH_EMBEDDING_DIM}` : ''),
})

export const buildEmbeddingText = (item) => {
  const keywords = Array.isArray(item.keywords) ? item.keywords.filter(Boolean).join(' ') : ''
  return [
    item.title ? `title: ${item.title}` : '',
    item.sectionTitle ? `section: ${item.sectionTitle}` : '',
    item.category ? `category: ${item.category}` : '',
    keywords ? `keywords: ${keywords}` : '',
    item.content ? `content: ${item.content}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const embedText = async (text, options = {}) => {
  const provider = String(options.provider || EMBEDDING_PROVIDER).trim().toLowerCase()
  const dimension = toNumber(options.dimension, HASH_EMBEDDING_DIM)
  const normalized = normalizeText(text)

  if (!normalized) return new Array(dimension).fill(0)

  if (provider === 'hash') {
    return buildHashEmbedding(normalized, dimension)
  }

  if (provider === 'openai_compatible') {
    if (!openAICompatibleEmbedding) {
      openAICompatibleEmbedding = createOpenAICompatibleEmbeddingClient()
    }
    return openAICompatibleEmbedding(normalized)
  }

  const error = new Error(`UNSUPPORTED_VECTOR_PROVIDER:${provider}`)
  error.code = 'UNSUPPORTED_VECTOR_PROVIDER'
  throw error
}

export const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
    return 0
  }

  const length = Math.min(left.length, right.length)
  let sum = 0
  for (let i = 0; i < length; i += 1) {
    sum += (Number(left[i]) || 0) * (Number(right[i]) || 0)
  }
  return sum
}

let cachedIndexPath = ''
let cachedVectorIndex = null

export const loadVectorIndex = (inputPath = DEFAULT_INDEX_PATH) => {
  const resolved = resolve(process.cwd(), inputPath)
  if (cachedVectorIndex && cachedIndexPath === resolved) return cachedVectorIndex
  if (!existsSync(resolved)) return []

  const raw = readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '')
  const parsed = JSON.parse(raw)
  const items = Array.isArray(parsed) ? parsed : []
  cachedIndexPath = resolved
  cachedVectorIndex = items
  return items
}

export const clearVectorIndexCache = () => {
  cachedIndexPath = ''
  cachedVectorIndex = null
}

export const searchVectorIndex = async (query, options = {}) => {
  const limit = Math.max(1, toNumber(options.limit, 8))
  const indexItems = Array.isArray(options.indexItems) ? options.indexItems : loadVectorIndex(options.inputPath)
  if (!query || indexItems.length === 0) return []

  const queryEmbedding = await embedText(query, options)

  return indexItems
    .map((item) => ({
      ...item,
      vectorScore: cosineSimilarity(queryEmbedding, item.embedding),
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .filter((item) => Number.isFinite(item.vectorScore))
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, limit)
}

export const getVectorIndexStats = (inputPath = DEFAULT_INDEX_PATH) => {
  const items = loadVectorIndex(inputPath)
  return {
    totalChunks: items.length,
    officialChunks: items.filter((item) => item.isOfficial).length,
    communityChunks: items.filter((item) => !item.isOfficial).length,
    provider: getEmbeddingConfig().provider,
    model: getEmbeddingConfig().model,
  }
}
