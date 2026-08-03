import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import '../env-loader.mjs'
import { insertLightRagTexts } from '../lightrag.mjs'

const DEFAULT_KB_PATH = 'server/data/knowledge-base.json'

const parseArgs = (argv) => {
  const args = {
    batchSize: 8,
    dryRun: false,
    limit: 0,
    source: DEFAULT_KB_PATH,
    start: 0,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source') args.source = argv[++i] || args.source
    else if (arg === '--batch-size') args.batchSize = Number(argv[++i] || args.batchSize)
    else if (arg === '--limit') args.limit = Number(argv[++i] || args.limit)
    else if (arg === '--start') args.start = Number(argv[++i] || args.start)
    else if (arg === '--dry-run') args.dryRun = true
  }

  args.batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? Math.floor(args.batchSize) : 8
  args.limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.floor(args.limit) : 0
  args.start = Number.isFinite(args.start) && args.start > 0 ? Math.floor(args.start) : 0
  return args
}

const safeJsonArray = (text) => {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return []
}

const sanitizeSourcePart = (value) =>
  String(value || '')
    .replace(/[\\/:*?"<>|#]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 120)

const buildDocumentText = (item) => {
  const lines = [
    `标题：${item.title || '未命名资料'}`,
    `分类：${item.category || 'general'}`,
    item.sourceType ? `来源类型：${item.sourceType}` : '',
    item.updatedAt ? `更新时间：${item.updatedAt}` : '',
    item.url ? `原始链接：${item.url}` : '',
    normalizeArray(item.keywords).length > 0 ? `关键词：${normalizeArray(item.keywords).join('、')}` : '',
    '',
    '正文：',
    item.content || item.summary || item.contentPreview || '',
  ]

  return lines.filter((line) => line !== '').join('\n').trim()
}

const chunk = (items, size) => {
  const groups = []
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size))
  }
  return groups
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const sourcePath = resolve(process.cwd(), args.source)

  if (!existsSync(sourcePath)) {
    throw new Error(`source file not found: ${args.source}`)
  }

  const allItems = safeJsonArray(readFileSync(sourcePath, 'utf8'))
  const selectedItems = allItems
    .slice(args.start)
    .filter((item) => item && typeof item === 'object')
    .filter((item) => String(item.content || item.summary || item.contentPreview || '').trim())
    .slice(0, args.limit || undefined)

  const documents = selectedItems.map((item, index) => ({
    text: buildDocumentText(item),
    source: `${args.source}#${sanitizeSourcePart(item.id || item.title || `doc-${args.start + index + 1}`)}`,
  }))

  console.log(
    JSON.stringify(
      {
        source: args.source,
        totalSourceItems: allItems.length,
        selectedItems: selectedItems.length,
        batchSize: args.batchSize,
        dryRun: args.dryRun,
      },
      null,
      2,
    ),
  )

  if (args.dryRun) {
    console.log(documents[0]?.text || 'No document text generated.')
    return
  }

  let importedCount = 0
  const batches = chunk(documents, args.batchSize)
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    await insertLightRagTexts(batch.map((item) => item.text), {
      fileSources: batch.map((item) => item.source),
      metadata: {
        project: 'ai-campus-agent',
        source: args.source,
        batchIndex: index + 1,
      },
    })
    importedCount += batch.length
    console.log(`[lightrag:import] batch ${index + 1}/${batches.length}, imported=${importedCount}`)
  }

  console.log(`[lightrag:import] done, imported=${importedCount}`)
}

main().catch((error) => {
  console.error('[import-kb-to-lightrag] failed:', error?.data || error)
  process.exitCode = 1
})
