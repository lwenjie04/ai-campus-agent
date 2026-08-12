import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildEmbeddingText, embedText, getEmbeddingConfig } from '../vector-index.mjs'

const cwd = process.cwd()

const parseArgs = (argv) => {
  const args = {
    input: 'server/data/chunked-knowledge-base.json',
    output: 'server/data/vector-index.json',
    provider: '',
    dimension: 0,
    limit: 0,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || args.input
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || args.output
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i] || args.provider
    else if (arg === '--dimension' || arg === '-d') args.dimension = Number(argv[++i] || args.dimension)
    else if (arg === '--limit') args.limit = Number(argv[++i] || args.limit)
  }

  return args
}

const readJsonArray = (filePath) => {
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

const pickIndexFields = (item) => ({
  id: item.id,
  docId: item.docId,
  chunkIndex: item.chunkIndex,
  title: item.title,
  sectionTitle: item.sectionTitle,
  category: item.category,
  sourceType: item.sourceType,
  sourceStatus: item.sourceStatus,
  url: item.url,
  updatedAt: item.updatedAt,
  keywords: Array.isArray(item.keywords) ? item.keywords : [],
  isOfficial: Boolean(item.isOfficial),
  priority: Number(item.priority) || 0,
  content: item.content || '',
  contentPreview: item.contentPreview || '',
  postId: item.postId || '',
})

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = resolve(cwd, args.input)
  const outputPath = resolve(cwd, args.output)
  const sourceItems = readJsonArray(inputPath)
  const embeddingConfig = getEmbeddingConfig()

  const provider = args.provider || embeddingConfig.provider
  const dimension = args.dimension || embeddingConfig.dimension
  const model = provider === 'hash' ? `hash-${dimension}` : embeddingConfig.model
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.min(args.limit, sourceItems.length) : sourceItems.length

  const indexItems = []

  for (let i = 0; i < limit; i += 1) {
    const item = sourceItems[i]
    const embeddingText = buildEmbeddingText(item)
    const embedding = await embedText(embeddingText, { provider, dimension })

    indexItems.push({
      ...pickIndexFields(item),
      embeddingProvider: provider,
      embeddingModel: model,
      embeddingDimension: embedding.length,
      embeddingText,
      embedding,
    })

    if ((i + 1) % 25 === 0 || i === limit - 1) {
      console.log(`[build-vector-index] embedded ${i + 1}/${limit}`)
    }
  }

  const outputDir = resolve(outputPath, '..')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(indexItems, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        input: args.input,
        output: args.output,
        provider,
        model,
        dimension,
        sourceChunks: sourceItems.length,
        indexedChunks: indexItems.length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('[build-vector-index] failed:', error)
  process.exitCode = 1
})
