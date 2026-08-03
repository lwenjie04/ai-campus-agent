const DEFAULT_QUERIES = [
  '国家励志奖学金什么时候申请',
  '补考怎么报名',
  '宿舍报修怎么申请',
  '清明节放假怎么安排',
  '转专业需要什么条件',
]

const parseArgs = (argv) => {
  const args = {
    limit: 5,
    minScore: 3,
    query: '',
    noVector: false,
    noCommunity: false,
    vectorTimeoutMs: 8000,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit' || arg === '-l') args.limit = Number(argv[++i] || args.limit)
    else if (arg === '--min-score') args.minScore = Number(argv[++i] || args.minScore)
    else if (arg === '--query' || arg === '-q') args.query = argv[++i] || args.query
    else if (arg === '--no-vector') args.noVector = true
    else if (arg === '--no-community') args.noCommunity = true
    else if (arg === '--vector-timeout-ms') args.vectorTimeoutMs = Number(argv[++i] || args.vectorTimeoutMs)
  }

  return args
}

const toSafeNumber = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits))

const printHit = (hit, index) => {
  const payload = {
    rank: index + 1,
    title: hit.title || '',
    category: hit.category || '',
    sourceType: hit.sourceType || '',
    score: toSafeNumber(hit.score),
    keywordScore: toSafeNumber(hit.keywordScore ?? hit.baseScore ?? hit.score),
    vectorScore: toSafeNumber(hit.vectorScore),
    decayFactor: toSafeNumber(hit.decayFactor || 1),
    matchedTerms: Array.isArray(hit.matchedTerms) ? hit.matchedTerms : [],
    snippet: hit.snippet || hit.contentPreview || '',
  }

  console.log(JSON.stringify(payload, null, 2))
}

const printQueryResult = async (query, options, searchKnowledgeBase) => {
  console.log(`\n=== QUERY: ${query} ===`)
  const hits = await searchKnowledgeBase(query, {
    limit: options.limit,
    minScore: options.minScore,
    includeCommunity: !options.noCommunity,
  })

  if (!Array.isArray(hits) || hits.length === 0) {
    console.log('No hits.')
    return
  }

  hits.forEach((hit, index) => printHit(hit, index))
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.noVector) {
    process.env.RAG_VECTOR_ENABLED = 'false'
  } else if (!process.env.VECTOR_EMBEDDING_TIMEOUT_MS) {
    process.env.VECTOR_EMBEDDING_TIMEOUT_MS = String(args.vectorTimeoutMs)
  }

  const { searchKnowledgeBase } = await import('../rag.mjs')
  const queries = args.query ? [args.query] : DEFAULT_QUERIES

  console.log(
    JSON.stringify(
      {
        limit: args.limit,
        minScore: args.minScore,
        vectorEnabled: process.env.RAG_VECTOR_ENABLED !== 'false',
        communityEnabled: !args.noCommunity,
        vectorTimeoutMs: process.env.VECTOR_EMBEDDING_TIMEOUT_MS || null,
        queries,
      },
      null,
      2,
    ),
  )

  for (const query of queries) {
    await printQueryResult(query, args, searchKnowledgeBase)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('[test-rag-retrieval] failed:', error)
  process.exitCode = 1
})
