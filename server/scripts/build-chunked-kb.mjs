import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMySqlConfigured, query } from '../mysql.mjs'

const cwd = process.cwd()

const parseArgs = (argv) => {
  const args = {
    input: 'server/data/knowledge-base.json',
    output: 'server/data/chunked-knowledge-base.json',
    minChunkLength: 300,
    maxChunkLength: 600,
    overlapLength: 80,
    includeCommunity: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || args.input
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || args.output
    else if (arg === '--min' || arg === '--min-chunk-length') args.minChunkLength = Number(argv[++i] || args.minChunkLength)
    else if (arg === '--max' || arg === '--max-chunk-length') args.maxChunkLength = Number(argv[++i] || args.maxChunkLength)
    else if (arg === '--overlap' || arg === '--overlap-length') args.overlapLength = Number(argv[++i] || args.overlapLength)
    else if (arg === '--official-only') args.includeCommunity = false
  }

  args.minChunkLength = Number.isFinite(args.minChunkLength) ? Math.max(80, args.minChunkLength) : 300
  args.maxChunkLength = Number.isFinite(args.maxChunkLength)
    ? Math.max(args.minChunkLength + 40, args.maxChunkLength)
    : 600
  args.overlapLength = Number.isFinite(args.overlapLength)
    ? Math.max(0, Math.min(args.overlapLength, Math.floor(args.maxChunkLength / 3)))
    : 80

  return args
}

const normalizeText = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const normalizeDate = (value) => {
  const date = new Date(String(value || '').trim())
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const normalizeKeywords = (keywords) => {
  if (!keywords) return []
  if (Array.isArray(keywords)) {
    return keywords.map((item) => String(item || '').trim()).filter(Boolean)
  }

  if (typeof keywords === 'string') {
    try {
      const parsed = JSON.parse(keywords)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch {
      return []
    }
  }

  return []
}

const readJsonArray = (filePath) => {
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

const SECTION_HEADING_RE = /^(?:\d+[.)、]|[一二三四五六七八九十]+[、.]|第[一二三四五六七八九十百千0-9]+(?:章|节|部分|条)|附件|附录)/

const splitParagraphs = (content) => {
  const normalized = normalizeText(content)
  if (!normalized) return []

  return normalized
    .split(/\n{2,}/)
    .flatMap((block) => {
      const parts = []
      let current = ''

      for (const rawLine of block.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue

        if (SECTION_HEADING_RE.test(line) && current) {
          parts.push(current)
          current = line
          continue
        }

        current = current ? `${current} ${line}` : line
      }

      if (current) parts.push(current)
      return parts
    })
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const splitLongParagraph = (paragraph, maxChunkLength, overlapLength) => {
  const sentences = paragraph
    .split(/(?<=[。！？；;.!?])/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (sentences.length <= 1 && paragraph.length <= maxChunkLength) return [paragraph]

  const chunks = []
  let current = ''

  const pushCurrent = () => {
    const cleaned = current.trim()
    if (!cleaned) return
    chunks.push(cleaned)
    current = overlapLength > 0 ? cleaned.slice(-overlapLength) : ''
  }

  for (const sentence of sentences.length > 0 ? sentences : [paragraph]) {
    if (!current) {
      current = sentence
      continue
    }

    if ((current + sentence).length <= maxChunkLength) {
      current += sentence
      continue
    }

    pushCurrent()
    current = current ? `${current}${sentence}` : sentence

    if (current.length > maxChunkLength) {
      while (current.length > maxChunkLength) {
        chunks.push(current.slice(0, maxChunkLength))
        current = overlapLength > 0 ? current.slice(maxChunkLength - overlapLength) : current.slice(maxChunkLength)
      }
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

const chunkText = (content, { minChunkLength, maxChunkLength, overlapLength }) => {
  const paragraphs = splitParagraphs(content)
  if (paragraphs.length === 0) return []

  const chunks = []
  let buffer = ''

  const flushBuffer = () => {
    const cleaned = buffer.trim()
    if (!cleaned) return
    chunks.push(cleaned)
    buffer = ''
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkLength) {
      if (buffer.trim()) flushBuffer()
      const splitChunks = splitLongParagraph(paragraph, maxChunkLength, overlapLength)
      chunks.push(...splitChunks)
      continue
    }

    if (!buffer) {
      buffer = paragraph
      continue
    }

    if ((buffer + '\n\n' + paragraph).length <= maxChunkLength) {
      buffer += `\n\n${paragraph}`
      continue
    }

    if (buffer.length >= minChunkLength) {
      flushBuffer()
      buffer = paragraph
      continue
    }

    const merged = `${buffer}\n\n${paragraph}`
    if (merged.length <= maxChunkLength + Math.floor(overlapLength / 2)) {
      buffer = merged
      flushBuffer()
      continue
    }

    flushBuffer()
    buffer = paragraph
  }

  if (buffer.trim()) flushBuffer()

  return chunks.map((item) => item.trim()).filter(Boolean)
}

const toPreview = (content, maxLength = 120) => {
  const text = normalizeText(content).replace(/\n/g, ' ')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

const createChunkId = (docId, chunkIndex) =>
  `chunk_${String(docId || 'unknown').replace(/[^\w-]/g, '_')}_${String(chunkIndex).padStart(2, '0')}`

const mapOfficialEntryToChunks = (entry, options) => {
  const content = normalizeText(entry.content)
  if (!content) return []

  const docId = String(entry.id || '')
  const title = normalizeText(entry.title)
  const chunks = chunkText(content, options)

  return chunks.map((chunk, index) => ({
    id: createChunkId(docId, index + 1),
    docId,
    chunkIndex: index + 1,
    title,
    sectionTitle: index === 0 ? 'body' : `body_cont_${index}`,
    category: normalizeText(entry.category) || 'general',
    sourceType: normalizeText(entry.sourceType) || 'official_notice',
    sourceStatus: 'approved',
    url: normalizeText(entry.url),
    updatedAt: normalizeDate(entry.updatedAt),
    keywords: normalizeKeywords(entry.keywords),
    isOfficial: true,
    priority: 1,
    content: chunk,
    contentPreview: toPreview(chunk),
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
  }))
}

const loadCommunityKnowledge = async () => {
  if (!isMySqlConfigured()) return []

  try {
    const rows = await query(
      `
        SELECT
          id,
          post_id,
          title,
          summary,
          content,
          category,
          keywords,
          status,
          source_type,
          updated_at
        FROM community_knowledge
        WHERE status = 'approved'
        ORDER BY updated_at DESC
      `,
    )

    return rows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      title: normalizeText(row.title),
      content: normalizeText(row.content || row.summary),
      category: normalizeText(row.category) || 'general',
      keywords: normalizeKeywords(row.keywords),
      updatedAt: normalizeDate(row.updated_at),
      status: normalizeText(row.status) || 'approved',
      sourceType: normalizeText(row.source_type) || 'community_summary',
    }))
  } catch {
    return []
  }
}

const mapCommunityEntryToChunks = (entry, options) => {
  const content = normalizeText(entry.content)
  if (!content) return []

  const docId = String(entry.id || '')
  const chunks = content.length <= options.maxChunkLength ? [content] : chunkText(content, options)

  return chunks.map((chunk, index) => ({
    id: createChunkId(docId, index + 1),
    docId,
    chunkIndex: index + 1,
    title: normalizeText(entry.title),
    sectionTitle: index === 0 ? 'community_summary' : `community_summary_cont_${index}`,
    category: normalizeText(entry.category) || 'general',
    sourceType: normalizeText(entry.sourceType) || 'community_summary',
    sourceStatus: normalizeText(entry.status) || 'approved',
    url: '',
    updatedAt: normalizeDate(entry.updatedAt),
    keywords: normalizeKeywords(entry.keywords),
    isOfficial: false,
    priority: 0.6,
    content: chunk,
    contentPreview: toPreview(chunk),
    postId: entry.postId ? String(entry.postId) : '',
  }))
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = resolve(cwd, args.input)
  const outputPath = resolve(cwd, args.output)
  const officialEntries = readJsonArray(inputPath)
  const communityEntries = args.includeCommunity ? await loadCommunityKnowledge() : []

  const officialChunks = officialEntries.flatMap((entry) => mapOfficialEntryToChunks(entry, args))
  const communityChunks = communityEntries.flatMap((entry) => mapCommunityEntryToChunks(entry, args))
  const allChunks = [...officialChunks, ...communityChunks]

  const outputDir = resolve(outputPath, '..')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(allChunks, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        input: args.input,
        output: args.output,
        officialDocs: officialEntries.length,
        communityDocs: communityEntries.length,
        officialChunks: officialChunks.length,
        communityChunks: communityChunks.length,
        totalChunks: allChunks.length,
        chunkRules: {
          minChunkLength: args.minChunkLength,
          maxChunkLength: args.maxChunkLength,
          overlapLength: args.overlapLength,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('[build-chunked-kb] failed:', error)
  process.exitCode = 1
})
