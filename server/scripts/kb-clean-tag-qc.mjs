import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_INPUT = 'server/data/knowledge-base.json'
const DEFAULT_REPORT = 'server/data/knowledge-base.qc-report.json'

const CATEGORY_RULES = [
  { category: 'scholarship', keywords: ['奖学金', '助学金', '资助', '国家励志', '国家奖学金', '竞赛奖学金'] },
  { category: 'teaching', keywords: ['教务', '课程', '课表', '选课', '学分', '成绩', '转专业', '补退选'] },
  { category: 'exam', keywords: ['考试', '补考', '重修', '四六级', '考核'] },
  { category: 'student_affairs', keywords: ['学籍', '请假', '辅导员', '学生事务', '心理', '评优', '评先'] },
  { category: 'research', keywords: ['科研', '课题', '社科基金', '项目申报', '立项', '学术'] },
  { category: 'competition', keywords: ['竞赛', '大赛', '挑战杯', '互联网+', '创新创业'] },
  { category: 'life', keywords: ['宿舍', '食堂', '后勤', '报修', '交通车', '校车', '图书馆'] },
]

const QUALITY_REQUIRED_FIELDS = ['title', 'category', 'sourceType', 'updatedAt', 'content']
const MOJIBAKE_MARKERS = ['鍏充簬', '瀛', '鏃', '鐨', '閫氱煡', '锛', '銆', '锟']

const parseArgs = (argv) => {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_INPUT,
    report: DEFAULT_REPORT,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input' || arg === '-i') args.input = argv[++i]
    else if (arg === '--output' || arg === '-o') args.output = argv[++i]
    else if (arg === '--report' || arg === '-r') args.report = argv[++i]
    else if (arg === '--dry-run') args.dryRun = true
  }
  return args
}

const normalizeText = (value) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeForCompare = (value) => normalizeText(value).toLowerCase()

const normalizeDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const detectMojibake = (value) => {
  const text = String(value || '')
  if (!text) return false
  return MOJIBAKE_MARKERS.some((marker) => text.includes(marker))
}

const tryParseEmbeddedNotice = (contentText) => {
  const text = normalizeText(contentText)
  if (!text || !text.startsWith('{')) return null
  try {
    const parsed = JSON.parse(text)
    const notice = parsed?.notice
    if (!notice || typeof notice !== 'object') return null
    return {
      title: normalizeText(notice.title),
      publishedAt: normalizeDate(notice.publishedAt),
      content: normalizeText(notice.content),
      attachments: Array.isArray(notice.attachments) ? notice.attachments : [],
      pageUrl: normalizeText(parsed?.source?.pageUrl),
    }
  } catch {
    return null
  }
}

const uniqBy = (list, keyFn) => {
  const map = new Map()
  for (const item of list || []) {
    const key = keyFn(item)
    if (!key || map.has(key)) continue
    map.set(key, item)
  }
  return Array.from(map.values())
}

const inferCategory = (title, content) => {
  const pool = `${title || ''} ${content || ''}`.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => pool.includes(kw.toLowerCase()))) {
      return rule.category
    }
  }
  return 'general'
}

const inferSourceType = (item) => {
  if (item.sourceType) return item.sourceType
  if (Array.isArray(item.attachments) && item.attachments.length > 0) return 'official_notice'
  if (item.url) return 'official_notice'
  return 'local_text'
}

const generateKeywords = (title, content, category) => {
  const seeds = new Set()
  const pool = `${title || ''} ${content || ''}`

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (pool.includes(kw)) seeds.add(kw)
    }
  }
  if (category) seeds.add(category)

  return Array.from(seeds).slice(0, 15)
}

const makeStableId = (title, url, updatedAt) => {
  const basis = `${normalizeForCompare(title)}|${normalizeForCompare(url)}|${updatedAt}`
  const hash = createHash('md5').update(basis).digest('hex').slice(0, 8)
  return `${updatedAt || 'unknown'}-${hash}`
}

const scoreForKeep = (item) => {
  let score = 0
  const contentLen = normalizeText(item.content).length
  const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0

  if (item.url) score += 4
  if (item.sourceType === 'official_notice') score += 2
  if (item.sourceType === 'local_text') score += 1
  if (contentLen > 300) score += 2
  if (contentLen > 1000) score += 1
  if (attachmentCount > 0) score += 2
  if (normalizeText(item.content).startsWith('{"schemaVersion"')) score -= 2
  if (detectMojibake(item.title) || detectMojibake(item.content)) score -= 3

  return score
}

const mergeAttachments = (a = [], b = []) =>
  uniqBy(
    [...a, ...b]
      .map((x) => ({
        name: normalizeText(x?.name),
        url: normalizeText(x?.url),
      }))
      .filter((x) => x.url),
    (x) => x.url,
  )

const mergeEntry = (winner, loser) => {
  const merged = { ...winner }
  merged.attachments = mergeAttachments(winner.attachments, loser.attachments)
  merged.keywords = uniqBy([...(winner.keywords || []), ...(loser.keywords || [])], (x) => x).slice(0, 20)

  if (!merged.url && loser.url) merged.url = loser.url
  if (!normalizeText(merged.content) && normalizeText(loser.content)) merged.content = loser.content
  if (!merged.authority && loser.authority) merged.authority = loser.authority
  if (!merged.importedFrom && loser.importedFrom) merged.importedFrom = loser.importedFrom

  return merged
}

const makeDedupeKey = (item) => {
  const urlKey = normalizeForCompare(item.url)
  if (urlKey) return `url:${urlKey}`

  const titleKey = normalizeForCompare(item.title)
  const dateKey = normalizeDate(item.updatedAt)
  if (titleKey && dateKey) return `title-date:${titleKey}|${dateKey}`

  return `id:${normalizeForCompare(item.id)}`
}

const sanitizeEntry = (raw) => {
  const embedded = tryParseEmbeddedNotice(raw.content)
  const normalizedAttachmentsFromRaw = Array.isArray(raw.attachments) ? raw.attachments : []
  const mergedRawAttachments = [
    ...normalizedAttachmentsFromRaw,
    ...(embedded?.attachments || []),
  ]

  const entry = {
    ...raw,
    title: normalizeText(raw.title) || normalizeText(embedded?.title),
    category: normalizeText(raw.category),
    sourceType: normalizeText(raw.sourceType),
    authority: normalizeText(raw.authority),
    updatedAt: normalizeDate(raw.updatedAt) || normalizeDate(embedded?.publishedAt) || normalizeDate(Date.now()),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map((x) => normalizeText(x)).filter(Boolean) : [],
    url: normalizeText(raw.url) || normalizeText(embedded?.pageUrl),
    content: normalizeText(embedded?.content || raw.content),
    attachments: mergedRawAttachments,
    importedFrom: normalizeText(raw.importedFrom),
    downloadPath: normalizeText(raw.downloadPath),
    downloadName: normalizeText(raw.downloadName),
  }

  entry.attachments = uniqBy(
    entry.attachments
      .map((x) => ({
        name: normalizeText(x?.name),
        url: normalizeText(x?.url),
      }))
      .filter((x) => x.name || x.url),
    (x) => x.url || x.name,
  )

  entry.category = entry.category || inferCategory(entry.title, entry.content)
  entry.sourceType =
    entry.sourceType ||
    (entry.url || entry.attachments.length > 0 ? 'official_notice' : inferSourceType(entry))
  entry.keywords = generateKeywords(entry.title, entry.content, entry.category)
  entry.id = normalizeText(raw.id) || makeStableId(entry.title, entry.url, entry.updatedAt)

  return entry
}

const runQualityCheck = (entries) => {
  const issues = []

  const pushIssue = (severity, code, message, entryId) => {
    issues.push({ severity, code, message, entryId: entryId || '' })
  }

  const idSet = new Set()
  for (const item of entries) {
    if (idSet.has(item.id)) pushIssue('error', 'duplicate_id', `重复 ID: ${item.id}`, item.id)
    else idSet.add(item.id)

    for (const field of QUALITY_REQUIRED_FIELDS) {
      if (!normalizeText(item[field])) {
        pushIssue('error', 'missing_field', `缺少字段 ${field}`, item.id)
      }
    }

    if (item.url && !/^https?:\/\//i.test(item.url)) {
      pushIssue('error', 'invalid_url', 'url 不是合法的 http(s) 地址', item.id)
    }

    if (normalizeText(item.content).length < 30) {
      pushIssue('warn', 'short_content', 'content 过短，检索命中效果可能差', item.id)
    }

    if (detectMojibake(item.title) || detectMojibake(item.content)) {
      pushIssue('warn', 'possible_mojibake', '疑似乱码（编码异常）', item.id)
    }

    for (const att of item.attachments || []) {
      if (!att.url) pushIssue('warn', 'attachment_missing_url', '附件缺少 url', item.id)
    }
  }

  const summary = {
    total: entries.length,
    errors: issues.filter((x) => x.severity === 'error').length,
    warnings: issues.filter((x) => x.severity === 'warn').length,
    byCode: Object.fromEntries(
      Array.from(issues.reduce((m, x) => m.set(x.code, (m.get(x.code) || 0) + 1), new Map()).entries()).sort(
        (a, b) => b[1] - a[1],
      ),
    ),
  }

  return { summary, issues }
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = resolve(process.cwd(), args.input)
  const outputPath = resolve(process.cwd(), args.output)
  const reportPath = resolve(process.cwd(), args.report)

  if (!existsSync(inputPath)) {
    throw new Error(`知识库文件不存在: ${inputPath}`)
  }

  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : []
  const sanitized = entries.map(sanitizeEntry)

  const grouped = new Map()
  for (const item of sanitized) {
    const key = makeDedupeKey(item)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  }

  const deduped = []
  let removedByDedupe = 0

  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => scoreForKeep(b) - scoreForKeep(a))
    let merged = sorted[0]
    for (let i = 1; i < sorted.length; i += 1) {
      merged = mergeEntry(merged, sorted[i])
      removedByDedupe += 1
    }

    merged.id = makeStableId(merged.title, merged.url, merged.updatedAt)
    merged.category = inferCategory(merged.title, merged.content)
    merged.sourceType = inferSourceType(merged)
    merged.keywords = generateKeywords(merged.title, merged.content, merged.category)
    deduped.push(merged)
  }

  deduped.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))

  const qc = runQualityCheck(deduped)
  const report = {
    runAt: new Date().toISOString(),
    input: args.input,
    output: args.output,
    dryRun: args.dryRun,
    scanned: entries.length,
    kept: deduped.length,
    removedByDedupe,
    quality: qc.summary,
    sampleIssues: qc.issues.slice(0, 100),
  }

  if (!args.dryRun) {
    writeFileSync(outputPath, `${JSON.stringify(deduped, null, 2)}\n`, 'utf8')
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify(report, null, 2))
}

main()
