import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_GOLDEN_PATH = 'server/evals/competition-golden-questions.json'

const parseArgs = (argv) => {
  const args = {
    goldenPath: DEFAULT_GOLDEN_PATH,
    limit: 3,
    minScore: 3,
    useVector: false,
    threshold: null,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--golden') args.goldenPath = argv[++index] || args.goldenPath
    else if (arg === '--limit') args.limit = Number(argv[++index] || args.limit)
    else if (arg === '--min-score') args.minScore = Number(argv[++index] || args.minScore)
    else if (arg === '--threshold') args.threshold = Number(argv[++index])
    else if (arg === '--vector') args.useVector = true
    else if (arg === '--json') args.json = true
  }

  return args
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s（）()《》“”"'：:，,。.!！?？、·—-]/g, '')

const isExpectedHit = (hit, item) => {
  if (!hit) return false
  const normalizedTitle = normalizeText(hit.title)
  const expectedTitles = Array.isArray(item.expectedTitleIncludes) ? item.expectedTitleIncludes : []
  return expectedTitles.some((expected) => normalizedTitle.includes(normalizeText(expected)))
}

const readGolden = (filePath) => {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
  if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
    throw new Error(`Golden set has no items: ${filePath}`)
  }
  return parsed
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  process.env.RAG_VECTOR_ENABLED = args.useVector ? 'true' : 'false'

  const goldenPath = resolve(process.cwd(), args.goldenPath)
  const golden = readGolden(goldenPath)
  const threshold = Number.isFinite(args.threshold)
    ? args.threshold
    : Number(golden.targetTop1Accuracy || 0.9)
  const { searchKnowledgeBase } = await import('../rag.mjs')

  const results = []

  for (const item of golden.items) {
    const hits = await searchKnowledgeBase(item.query, {
      limit: args.limit,
      minScore: args.minScore,
      includeCommunity: false,
    })
    const topHit = Array.isArray(hits) ? hits[0] : null
    const passed = isExpectedHit(topHit, item)

    results.push({
      id: item.id,
      category: item.category,
      query: item.query,
      passed,
      actualTitle: topHit?.title || '',
      actualScore: Number((Number(topHit?.score) || 0).toFixed(4)),
      expectedTitleIncludes: item.expectedTitleIncludes,
    })
  }

  const passedCount = results.filter((item) => item.passed).length
  const accuracy = passedCount / results.length
  const summary = {
    goldenPath: args.goldenPath,
    vectorEnabled: args.useVector,
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    top1Accuracy: Number(accuracy.toFixed(4)),
    threshold,
    status: accuracy >= threshold ? 'pass' : 'fail',
  }

  if (args.json) {
    console.log(JSON.stringify({ summary, results }, null, 2))
  } else {
    for (const result of results) {
      const icon = result.passed ? 'PASS' : 'FAIL'
      console.log(`[${icon}] ${result.id}: ${result.query}`)
      console.log(`       top1: ${result.actualTitle || '(no hit)'}`)
      if (!result.passed) {
        console.log(`       expected: ${result.expectedTitleIncludes.join(' | ')}`)
      }
    }
    console.log('')
    console.log(
      `[competition-rag] ${summary.status.toUpperCase()} ${summary.passed}/${summary.total} ` +
        `top1=${(summary.top1Accuracy * 100).toFixed(1)}% threshold=${(threshold * 100).toFixed(1)}%`,
    )
  }

  if (summary.status === 'fail') process.exitCode = 1
}

main().catch((error) => {
  console.error('[competition-rag] failed:', error)
  process.exitCode = 1
})
