import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getEmbeddingConfig, getVectorIndexStats } from '../vector-index.mjs'

const cwd = process.cwd()

const DEFAULT_PATHS = {
  knowledgeBase: 'server/data/knowledge-base.json',
  chunkedKnowledgeBase: 'server/data/chunked-knowledge-base.json',
  vectorIndex: 'server/data/vector-index.json',
}

const parseArgs = (argv) => {
  const args = { ...DEFAULT_PATHS, expectedProvider: '', expectedModel: '', expectedDimension: 0 }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--kb') args.knowledgeBase = argv[++i] || args.knowledgeBase
    else if (arg === '--chunked') args.chunkedKnowledgeBase = argv[++i] || args.chunkedKnowledgeBase
    else if (arg === '--vector') args.vectorIndex = argv[++i] || args.vectorIndex
    else if (arg === '--expect-provider') args.expectedProvider = argv[++i] || args.expectedProvider
    else if (arg === '--expect-model') args.expectedModel = argv[++i] || args.expectedModel
    else if (arg === '--expect-dimension') args.expectedDimension = Number(argv[++i] || 0)
  }

  return args
}

const readJsonArray = (filePath) => {
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

const sampleTextFromItem = (item) =>
  [
    item?.title,
    item?.sectionTitle,
    item?.category,
    item?.content,
    item?.contentPreview,
    Array.isArray(item?.keywords) ? item.keywords.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')

const MOJIBAKE_PATTERNS = [
  /鍏充簬/,
  /鏍囬/,
  /姝ｆ枃/,
  /閫氱煡/,
  /瀛︾敓/,
  /璇剧▼/,
  /锛/,
  /銆/,
  /鈥/,
  /\uFFFD/,
]

const detectMojibake = (items) => {
  let suspicious = 0
  const samples = []

  for (const item of items.slice(0, 20)) {
    const text = sampleTextFromItem(item)
    if (!text) continue

    if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(text))) {
      suspicious += 1
      if (samples.length < 3) samples.push(text.slice(0, 120))
    }
  }

  return {
    suspicious,
    samples,
    checked: Math.min(items.length, 20),
  }
}

const pushCheck = (checks, status, name, detail, extra = undefined) => {
  checks.push({ status, name, detail, extra })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const kbPath = resolve(cwd, args.knowledgeBase)
  const chunkedPath = resolve(cwd, args.chunkedKnowledgeBase)
  const vectorPath = resolve(cwd, args.vectorIndex)
  const embedding = getEmbeddingConfig()
  const expectedEmbedding = {
    provider: args.expectedProvider || embedding.provider,
    model: args.expectedModel || (args.expectedProvider === 'hash' ? `hash-${args.expectedDimension || embedding.dimension}` : embedding.model),
    dimension: args.expectedDimension || embedding.dimension,
  }
  const checks = []

  const kbItems = readJsonArray(kbPath)
  const kbEncoding = detectMojibake(kbItems)

  if (!existsSync(kbPath)) {
    pushCheck(checks, 'error', 'knowledge-base', `missing file: ${args.knowledgeBase}`)
  } else if (kbItems.length === 0) {
    pushCheck(checks, 'error', 'knowledge-base', 'knowledge base is empty')
  } else {
    pushCheck(checks, 'ok', 'knowledge-base', `loaded ${kbItems.length} source documents`)
  }

  if (kbItems.length > 0 && kbEncoding.suspicious > 0) {
    pushCheck(
      checks,
      'warn',
      'knowledge-base-encoding',
      `found suspicious mojibake in ${kbEncoding.suspicious}/${kbEncoding.checked} sampled items`,
      kbEncoding.samples,
    )
  } else if (kbItems.length > 0) {
    pushCheck(checks, 'ok', 'knowledge-base-encoding', 'no obvious mojibake detected in sampled source documents')
  }

  const chunkedItems = readJsonArray(chunkedPath)
  if (!existsSync(chunkedPath)) {
    pushCheck(checks, 'warn', 'chunked-kb', `missing file: ${args.chunkedKnowledgeBase}`, ['run: npm run kb:chunk'])
  } else if (chunkedItems.length === 0) {
    pushCheck(checks, 'warn', 'chunked-kb', 'chunked knowledge base is empty', ['run: npm run kb:chunk'])
  } else {
    pushCheck(checks, 'ok', 'chunked-kb', `loaded ${chunkedItems.length} chunked items`)
  }

  if (embedding.provider === 'hash') {
    pushCheck(
      checks,
      'warn',
      'embedding-provider',
      'provider=hash (local fallback, suitable for pipeline testing but not ideal for final semantic retrieval)',
      ['set VECTOR_EMBEDDING_PROVIDER=openai_compatible when ready to use a real embedding service'],
    )
  } else if (embedding.provider === 'openai_compatible') {
    const missingKeys = [
      ['VECTOR_EMBEDDING_API_BASE_URL', process.env.VECTOR_EMBEDDING_API_BASE_URL || process.env.EMBEDDING_API_BASE_URL],
      ['VECTOR_EMBEDDING_API_KEY', process.env.VECTOR_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY],
      ['VECTOR_EMBEDDING_MODEL', process.env.VECTOR_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL],
    ].filter(([, value]) => !String(value || '').trim())

    if (missingKeys.length > 0) {
      pushCheck(
        checks,
        'error',
        'embedding-provider',
        'openai_compatible provider is selected but config is incomplete',
        missingKeys.map(([key]) => key),
      )
    } else {
      pushCheck(checks, 'ok', 'embedding-provider', `provider=openai_compatible, model=${embedding.model}`)
    }
  } else {
    pushCheck(checks, 'error', 'embedding-provider', `unsupported provider: ${embedding.provider}`)
  }

  if (!existsSync(vectorPath)) {
    pushCheck(checks, 'warn', 'vector-index', `missing file: ${args.vectorIndex}`, ['run: npm run kb:vector'])
  } else {
    const vectorStats = getVectorIndexStats(vectorPath)
    const providerMatches = vectorStats.provider === expectedEmbedding.provider
    const modelMatches = expectedEmbedding.provider === 'hash' || vectorStats.model === expectedEmbedding.model
    const dimensionMatches =
      expectedEmbedding.provider !== 'hash' || Number(vectorStats.dimension) === Number(expectedEmbedding.dimension)
    const usesSelfDescribedLocalIndex = vectorStats.provider === 'hash' && dimensionMatches
    const compatible = providerMatches && modelMatches && dimensionMatches
    const usable = compatible || usesSelfDescribedLocalIndex
    pushCheck(
      checks,
      compatible ? 'ok' : usable ? 'warn' : 'error',
      'vector-index',
      compatible
        ? `loaded ${vectorStats.totalChunks} compatible vector chunks (official=${vectorStats.officialChunks}, community=${vectorStats.communityChunks})`
        : usable
          ? `loaded ${vectorStats.totalChunks} self-described local hash chunks; runtime queries will stay local`
          : 'vector index is incompatible with the current runtime embedding configuration',
      [
        `index=${vectorStats.provider}/${vectorStats.model || 'n/a'}/${vectorStats.dimension || 'n/a'}`,
        `expected=${expectedEmbedding.provider}/${expectedEmbedding.model || 'n/a'}/${expectedEmbedding.dimension || 'n/a'}`,
        ...(compatible
          ? []
          : usable
            ? ['semantic quality is lower than a real embedding index; keyword retrieval remains enabled']
            : ['rebuild the index with the current VECTOR_EMBEDDING_* configuration']),
      ],
    )
  }

  console.log(
    JSON.stringify(
      {
        embedding,
        expectedEmbedding,
        files: args,
        checks,
        nextSteps: [
          '1. fix encoding issues in source knowledge documents if warned',
          '2. run npm run kb:chunk',
          '3. configure VECTOR_EMBEDDING_* in server/.env',
          '4. run npm run kb:vector',
        ],
      },
      null,
      2,
    ),
  )

  for (const check of checks.filter((item) => item.status === 'warn')) {
    console.warn(`[vector-readiness] WARN ${check.name}: ${check.detail}`)
  }

  if (checks.some((item) => item.status === 'error')) {
    process.exitCode = 1
  }
}

main()
