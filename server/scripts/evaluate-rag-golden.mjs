import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRagGoldenSummary, isExpectedHit, isExpectedNoHit } from '../rag-golden-evaluator.mjs'

const DEFAULT_GOLDEN_PATH = 'server/evals/campus-service-golden-questions.json'

const parseArgs = (argv) => {
  const args = {
    goldenPath: DEFAULT_GOLDEN_PATH,
    knowledgeBasePath: '',
    limit: 3,
    minScore: 3,
    useVector: false,
    threshold: null,
    json: false,
    output: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--golden') args.goldenPath = argv[++index] || args.goldenPath
    else if (arg === '--knowledge-base') args.knowledgeBasePath = argv[++index] || ''
    else if (arg === '--limit') args.limit = Number(argv[++index] || args.limit)
    else if (arg === '--min-score') args.minScore = Number(argv[++index] || args.minScore)
    else if (arg === '--threshold') args.threshold = Number(argv[++index])
    else if (arg === '--vector') args.useVector = true
    else if (arg === '--json') args.json = true
    else if (arg === '--output') args.output = argv[++index] || ''
  }

  return args
}

const readGolden = (filePath, ancestry = []) => {
  const resolvedPath = resolve(process.cwd(), filePath)
  if (ancestry.includes(resolvedPath)) {
    throw new Error(`GOLDEN_EXTENDS_CYCLE:${[...ancestry, resolvedPath].join(' -> ')}`)
  }
  const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, ''))
  if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
    throw new Error(`Golden set has no items: ${resolvedPath}`)
  }
  if (!Array.isArray(parsed.negativeItems ?? [])) {
    throw new Error(`Golden negativeItems must be an array: ${resolvedPath}`)
  }
  for (const item of parsed.negativeItems || []) {
    if (item.expectedNoHit !== true) {
      throw new Error(`NEGATIVE_CASE_EXPECTED_NO_HIT_REQUIRED:${item.id || 'unknown'}`)
    }
  }
  if (!parsed.extends) return { ...parsed, negativeItems: parsed.negativeItems || [] }

  const basePath = resolve(dirname(resolvedPath), parsed.extends)
  const base = readGolden(basePath, [...ancestry, resolvedPath])
  return {
    ...base,
    ...parsed,
    items: [...base.items, ...parsed.items],
    negativeItems: [...(base.negativeItems || []), ...(parsed.negativeItems || [])],
  }
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  process.env.RAG_VECTOR_ENABLED = args.useVector ? 'true' : 'false'
  if (args.knowledgeBasePath) {
    process.env.RAG_KNOWLEDGE_BASE_PATH = resolve(process.cwd(), args.knowledgeBasePath)
  }

  const goldenPath = resolve(process.cwd(), args.goldenPath)
  const golden = readGolden(goldenPath)
  const threshold = Number.isFinite(args.threshold)
    ? args.threshold
    : Number(golden.targetTop1Accuracy || 0.9)
  const negativeThreshold = Number(golden.targetNegativeAccuracy ?? 1)
  const { searchKnowledgeBase } = await import('../rag.mjs')

  const positiveResults = []
  const negativeResults = []

  for (const item of golden.items) {
    const hits = await searchKnowledgeBase(item.query, {
      limit: args.limit,
      minScore: args.minScore,
      includeCommunity: false,
    })
    const topHit = Array.isArray(hits) ? hits[0] : null
    const passed = isExpectedHit(topHit, item)

    positiveResults.push({
      kind: 'positive',
      id: item.id,
      category: item.category,
      query: item.query,
      passed,
      actualTitle: topHit?.title || '',
      actualScore: Number((Number(topHit?.score) || 0).toFixed(4)),
      expectedTitleIncludes: item.expectedTitleIncludes,
    })
  }

  for (const item of golden.negativeItems || []) {
    const hits = await searchKnowledgeBase(item.query, {
      limit: args.limit,
      minScore: args.minScore,
      includeCommunity: false,
    })
    const topHit = Array.isArray(hits) ? hits[0] : null

    negativeResults.push({
      kind: 'negative',
      id: item.id,
      category: item.category,
      query: item.query,
      passed: isExpectedNoHit(Array.isArray(hits) ? hits : [], item),
      actualTitle: topHit?.title || '',
      actualScore: Number((Number(topHit?.score) || 0).toFixed(4)),
      expectedNoHit: item.expectedNoHit,
      rationale: item.rationale || '',
    })
  }

  const summary = {
    goldenPath: args.goldenPath,
    vectorEnabled: args.useVector,
    ...createRagGoldenSummary(positiveResults, negativeResults, {
      threshold,
      negativeThreshold,
    }),
  }
  const results = [...positiveResults, ...negativeResults]
  const report = JSON.stringify({ summary, results }, null, 2)
  if (args.output) {
    const outputPath = resolve(process.cwd(), args.output)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${report}\n`, 'utf8')
  }

  if (args.json) {
    console.log(report)
  } else {
    for (const result of positiveResults) {
      const icon = result.passed ? 'PASS' : 'FAIL'
      console.log(`[${icon}] ${result.id}: ${result.query}`)
      console.log(`       top1: ${result.actualTitle || '(no hit)'}`)
      if (!result.passed) {
        console.log(`       expected: ${result.expectedTitleIncludes.join(' | ')}`)
      }
    }
    for (const result of negativeResults) {
      const icon = result.passed ? 'PASS' : 'FAIL'
      console.log(`[${icon}] ${result.id}: ${result.query}`)
      if (!result.passed)
        console.log(`       unexpected hit: ${result.actualTitle || '(no title)'}`)
    }
    console.log('')
    console.log(
      `[rag-golden] ${summary.status.toUpperCase()} positive=${summary.passed}/${summary.total} ` +
        `top1=${(summary.top1Accuracy * 100).toFixed(1)}% threshold=${(threshold * 100).toFixed(1)}% ` +
        `negative=${summary.negativePassed}/${summary.negativeTotal} ` +
        `threshold=${(summary.negativeThreshold * 100).toFixed(1)}%`,
    )
  }

  if (summary.status === 'fail') process.exitCode = 1
}

main().catch((error) => {
  console.error('[rag-golden] failed:', error)
  process.exitCode = 1
})
