import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMySqlConfigured, query } from './mysql.mjs'

const KB_PATH = resolve(process.cwd(), 'server/data/knowledge-base.json')
const LOG_DIR = resolve(process.cwd(), 'server/logs')
const LOG_PATH = resolve(LOG_DIR, 'rag-search.log.ndjson')

let kbCache = null

const toNumber = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const RAG_WEIGHTS = {
  exactTitle: toNumber(process.env.RAG_WEIGHT_EXACT_TITLE, 10),
  exactContent: toNumber(process.env.RAG_WEIGHT_EXACT_CONTENT, 4),
  termTitleLong: toNumber(process.env.RAG_WEIGHT_TERM_TITLE_LONG, 5),
  termTitleShort: toNumber(process.env.RAG_WEIGHT_TERM_TITLE_SHORT, 3),
  termContentLong: toNumber(process.env.RAG_WEIGHT_TERM_CONTENT_LONG, 2),
  termContentShort: toNumber(process.env.RAG_WEIGHT_TERM_CONTENT_SHORT, 1),
  keywordMatch: toNumber(process.env.RAG_WEIGHT_KEYWORD_MATCH, 4),
  categoryMatch: toNumber(process.env.RAG_WEIGHT_CATEGORY_MATCH, 2),
  categoryScholarshipBoost: toNumber(process.env.RAG_WEIGHT_CATEGORY_SCHOLARSHIP_BOOST, 3),
  categoryTeachingBoost: toNumber(process.env.RAG_WEIGHT_CATEGORY_TEACHING_BOOST, 3),
  categoryExamBoost: toNumber(process.env.RAG_WEIGHT_CATEGORY_EXAM_BOOST, 2),
  routeBoost: toNumber(process.env.RAG_WEIGHT_ROUTE_BOOST, 6),
}

const TIME_DECAY = {
  enabled: (process.env.RAG_TIME_DECAY_ENABLED ?? 'true') === 'true',
  halfLifeDays: toNumber(process.env.RAG_TIME_DECAY_HALFLIFE_DAYS, 90),
  minFactor: toNumber(process.env.RAG_TIME_DECAY_MIN_FACTOR, 0.5),
}

const RAG_LOG_ENABLED = (process.env.RAG_LOG_ENABLED ?? 'true') === 'true'
const ROUTE_MIN_HITS = toNumber(process.env.RAG_ROUTE_MIN_HITS, 2)

const COMMUNITY_SOURCE_TYPES = new Set(['community_post', 'community_summary'])
const COMMUNITY_SOURCE_NOTE = '以下内容来自学生社区经验总结，仅供参考，请以学校最新官方通知为准。'

const CATEGORY_RULES = [
  {
    category: 'scholarship',
    patterns: [/奖学金/, /助学金/, /资助/, /国家奖学金/, /国家励志奖学金/, /竞赛奖学金/],
  },
  {
    category: 'teaching',
    patterns: [/转专业/, /补退选/, /课程认定/, /学分认定/, /成绩认定/, /选课/, /课表/, /教务/],
  },
  {
    category: 'exam',
    patterns: [/考试/, /补考/, /重修/, /考核/],
  },
  {
    category: 'life',
    patterns: [/宿舍/, /图书馆/, /食堂/, /后勤/, /报修/, /交通车/, /校车/],
  },
  {
    category: 'research',
    patterns: [/科研/, /课题/, /立项/, /项目申报/, /社科基金/, /学术/],
  },
  {
    category: 'competition',
    patterns: [/竞赛/, /大赛/, /挑战杯/, /互联网\+/, /创新创业/],
  },
  {
    category: 'student_affairs',
    patterns: [/学籍/, /请假/, /评优/, /评先/, /辅导员/, /学生事务/],
  },
]

const DOMAIN_KEYWORDS = [
  '奖学金',
  '助学金',
  '国家奖学金',
  '国家励志奖学金',
  '竞赛奖学金',
  '转专业',
  '补退选',
  '课程认定',
  '学分认定',
  '成绩认定',
  '选课',
  '课表',
  '教务',
  '考试',
  '补考',
  '重修',
  '宿舍',
  '图书馆',
  '食堂',
  '后勤',
  '科研',
  '课题',
  '立项',
  '项目申报',
]

const SYNONYM_GROUPS = [
  ['奖学金', '奖助', '资助', '助学金'],
  ['转专业', '转系', '专业调整'],
  ['补退选', '退选', '补选', '改选'],
  ['课程认定', '学分认定', '成绩认定', '学分转换'],
  ['考试', '考核', '补考', '重修'],
  ['宿舍', '宿舍管理', '公寓'],
  ['图书馆', '借阅', '馆藏'],
  ['食堂', '餐厅', '餐饮'],
  ['科研', '课题', '立项', '项目申报'],
  ['竞赛', '大赛', '比赛'],
]

const safeParseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

const loadKnowledgeBase = () => {
  if (kbCache) return kbCache
  if (!existsSync(KB_PATH)) {
    kbCache = []
    return kbCache
  }

  const raw = readFileSync(KB_PATH, 'utf8')
  const parsed = safeParseJson(raw)
  kbCache = Array.isArray(parsed) ? parsed : []
  return kbCache
}

const normalize = (text) => String(text || '').toLowerCase().trim()

const normalizeJsonArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch {
      return []
    }
  }
  return []
}

const mapCommunityKnowledgeRow = (row) => ({
  id: row.id,
  postId: row.post_id,
  title: row.title,
  content: row.content || row.summary || '',
  category: row.category || 'general',
  keywords: normalizeJsonArray(row.keywords),
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  sourceType: row.source_type || 'community_summary',
  sourceStatus: row.status || 'pending',
  confidenceBase: Number(row.confidence || 0.45),
})

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
          confidence,
          status,
          source_type,
          updated_at
        FROM community_knowledge
        WHERE status = 'approved'
        ORDER BY updated_at DESC
      `,
    )

    return rows.map(mapCommunityKnowledgeRow)
  } catch {
    return []
  }
}

const expandBySynonyms = (terms) => {
  const set = new Set(terms)
  for (const term of terms) {
    for (const group of SYNONYM_GROUPS) {
      if (group.some((item) => term.includes(item) || item.includes(term))) {
        group.forEach((item) => set.add(item))
      }
    }
  }
  return Array.from(set)
}

const generateChineseNgrams = (query) => {
  const grams = new Set()
  const chunks = query.match(/[\u4e00-\u9fff]{2,}/g) || []

  for (const chunk of chunks) {
    const maxGram = Math.min(4, chunk.length)
    for (let size = 2; size <= maxGram; size += 1) {
      for (let i = 0; i <= chunk.length - size; i += 1) {
        grams.add(chunk.slice(i, i + size))
      }
    }
  }

  return grams
}

const extractQueryTerms = (query) => {
  const q = normalize(query)
  if (!q) return []

  const terms = new Set([q])

  q.split(/[\s,，。！？；:：、（）()\[\]\-_/]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .forEach((item) => terms.add(item))

  for (const gram of generateChineseNgrams(q)) {
    if (gram.length >= 2) terms.add(gram)
  }

  for (const keyword of DOMAIN_KEYWORDS) {
    if (q.includes(keyword)) terms.add(keyword)
  }

  return expandBySynonyms(Array.from(terms))
}

const inferQueryCategories = (query) => {
  const matched = []
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(String(query || '')))) {
      matched.push(rule.category)
    }
  }
  return Array.from(new Set(matched))
}

const computeTimeDecayFactor = (updatedAt) => {
  if (!TIME_DECAY.enabled) return 1

  const ts = Date.parse(String(updatedAt || ''))
  if (!Number.isFinite(ts)) return 1

  const ageDays = Math.max(0, (Date.now() - ts) / (24 * 3600 * 1000))
  const halfLife = Math.max(1, TIME_DECAY.halfLifeDays)
  const factor = Math.pow(0.5, ageDays / halfLife)
  return Math.max(TIME_DECAY.minFactor, factor)
}

const scoreEntry = (entry, query, terms, preferredCategories = []) => {
  const q = normalize(query)
  const title = normalize(entry.title)
  const content = normalize(entry.content)
  const category = normalize(entry.category)
  const keywords = Array.isArray(entry.keywords) ? entry.keywords.map(normalize) : []
  const preferred = preferredCategories.map(normalize)

  let baseScore = 0
  const matchedTerms = new Set()

  if (q && title.includes(q)) {
    baseScore += RAG_WEIGHTS.exactTitle
    matchedTerms.add(q)
  }

  if (q && content.includes(q)) {
    baseScore += RAG_WEIGHTS.exactContent
    matchedTerms.add(q)
  }

  for (const term of terms) {
    if (!term || term.length < 2) continue

    if (title.includes(term)) {
      baseScore += term.length >= 4 ? RAG_WEIGHTS.termTitleLong : RAG_WEIGHTS.termTitleShort
      matchedTerms.add(term)
    }

    if (content.includes(term)) {
      baseScore += term.length >= 4 ? RAG_WEIGHTS.termContentLong : RAG_WEIGHTS.termContentShort
      matchedTerms.add(term)
    }

    if (keywords.some((keyword) => keyword.includes(term) || term.includes(keyword))) {
      baseScore += RAG_WEIGHTS.keywordMatch
      matchedTerms.add(term)
    }

    if (category && (category.includes(term) || term.includes(category))) {
      baseScore += RAG_WEIGHTS.categoryMatch
      matchedTerms.add(term)
    }
  }

  if (preferred.includes(category)) {
    baseScore += RAG_WEIGHTS.routeBoost
  }

  if (/(奖学金|助学金|资助)/.test(q) && category === 'scholarship') {
    baseScore += RAG_WEIGHTS.categoryScholarshipBoost
  }

  if (/(转专业|补退选|课程认定|学分认定|成绩认定|选课|课表|教务)/.test(q) && category === 'teaching') {
    baseScore += RAG_WEIGHTS.categoryTeachingBoost
  }

  if (/(考试|补考|重修)/.test(q) && /^(exam|teaching)$/.test(category)) {
    baseScore += RAG_WEIGHTS.categoryExamBoost
  }

  if (COMMUNITY_SOURCE_TYPES.has(String(entry.sourceType || ''))) {
    baseScore *= entry.sourceStatus === 'approved' ? 0.72 : 0.58
  }

  const decayFactor = computeTimeDecayFactor(entry.updatedAt)
  const score = baseScore * decayFactor

  return {
    score,
    baseScore,
    decayFactor,
    matchedTerms: Array.from(matchedTerms),
  }
}

const snippetFromContent = (content, query, maxLen = 96) => {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const terms = extractQueryTerms(query)
  const hit = terms.find((term) => term.length >= 2 && text.includes(term))
  if (!hit) return `${text.slice(0, maxLen)}${text.length > maxLen ? '...' : ''}`

  const idx = text.indexOf(hit)
  const start = Math.max(0, idx - 24)
  const end = Math.min(text.length, idx + maxLen - 24)
  const piece = text.slice(start, end)
  return `${start > 0 ? '...' : ''}${piece}${end < text.length ? '...' : ''}`
}

const logSearch = (query, options, hits, meta = {}) => {
  if (!RAG_LOG_ENABLED) return

  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

    const item = {
      ts: new Date().toISOString(),
      query,
      limit: options.limit,
      minScore: options.minScore,
      preferredCategories: meta.preferredCategories || [],
      routeMode: meta.routeMode || 'global_only',
      hits: hits.map((hit) => ({
        id: hit.id,
        title: hit.title,
        category: hit.category,
        sourceType: hit.sourceType || 'official_notice',
        score: Number((hit.score || 0).toFixed(4)),
        baseScore: Number((hit.baseScore || 0).toFixed(4)),
        decayFactor: Number((hit.decayFactor || 1).toFixed(4)),
        updatedAt: hit.updatedAt || '',
        matchedTerms: hit.matchedTerms || [],
      })),
    }

    appendFileSync(LOG_PATH, `${JSON.stringify(item)}\n`, 'utf8')
  } catch {
    // 日志失败不影响主流程。
  }
}

const rankEntries = (entries, query, terms, preferredCategories, options) =>
  entries
    .map((entry) => {
      const { score, baseScore, decayFactor, matchedTerms } = scoreEntry(
        entry,
        query,
        terms,
        preferredCategories,
      )

      return {
        ...entry,
        score,
        baseScore,
        decayFactor,
        matchedTerms,
        snippet: snippetFromContent(entry.content, query),
      }
    })
    .filter((item) => item.score >= options.minScore)
    .sort((a, b) => b.score - a.score)

const dedupeRankedHits = (hits) => {
  const seen = new Set()

  return hits.filter((hit) => {
    const titleKey = String(hit.title || '').trim()
    const key = titleKey || String(hit.id || '') || String(hit.url || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const getKnowledgeBaseEntryById = (id) => {
  const kb = loadKnowledgeBase()
  return kb.find((item) => String(item.id) === String(id)) || null
}

export const searchKnowledgeBase = async (query, options = {}) => {
  const limit = options.limit ?? 3
  const minScore = options.minScore ?? 3
  const q = normalize(query)
  if (!q) return []

  const officialKnowledge = loadKnowledgeBase()
  const communityKnowledge = options.includeCommunity === false ? [] : await loadCommunityKnowledge()
  const allEntries = [...officialKnowledge, ...communityKnowledge]
  const terms = extractQueryTerms(q)
  const preferredCategories = inferQueryCategories(query)

  let ranked = []
  let routeMode = 'global_only'

  if (preferredCategories.length > 0) {
    const routedEntries = allEntries.filter((entry) =>
      preferredCategories.includes(String(entry.category || '')),
    )
    const routedRanked = rankEntries(routedEntries, q, terms, preferredCategories, { minScore })

    if (routedRanked.length >= ROUTE_MIN_HITS) {
      ranked = dedupeRankedHits(routedRanked)
      routeMode = 'category_only'
    } else {
      const globalRanked = rankEntries(allEntries, q, terms, preferredCategories, { minScore })
      ranked = dedupeRankedHits(globalRanked)
      routeMode = routedRanked.length > 0 ? 'category_then_global' : 'global_fallback'
    }
  } else {
    ranked = dedupeRankedHits(rankEntries(allEntries, q, terms, [], { minScore }))
  }

  const finalHits = ranked.slice(0, limit)
  logSearch(query, { limit, minScore }, finalHits, { preferredCategories, routeMode })
  return finalHits
}

export const buildRagContext = (hits) => {
  if (!Array.isArray(hits) || hits.length === 0) return ''

  const blocks = hits.map((hit, index) =>
    [
      `[参考资料 ${index + 1}]`,
      `标题：${hit.title || '未知'}`,
      `分类：${hit.category || 'unknown'}`,
      `来源类型：${COMMUNITY_SOURCE_TYPES.has(String(hit.sourceType || '')) ? '学生社区经验' : '官方资料'}`,
      `更新时间：${hit.updatedAt || '未知'}`,
      `内容摘要：${hit.content || ''}`,
    ].join('\n'),
  )

  return [
    '以下是与当前问题相关的校园知识资料。请优先参考官方通知；若使用学生社区经验，请明确它仅作辅助参考，不可替代学校正式通知。',
    ...blocks,
    '请直接给出结论，不要先输出空泛说明。',
    '输出格式要求：',
    '1. 使用“**结论总结**”先给 1-3 句明确结论；',
    '2. 使用“**关键信息/办理步骤**”按条列出条件、材料、时间或办理步骤；',
    '3. 如果引用学生社区经验，请明确写出“仅供参考，请以学校最新官方通知为准”。',
  ].join('\n\n')
}

export const ragHitsToSources = (hits) => {
  if (!Array.isArray(hits)) return []

  return hits.map((hit) => {
    const isCommunity = COMMUNITY_SOURCE_TYPES.has(String(hit.sourceType || ''))
    const communityConfidence = Math.min(
      0.6,
      Math.max(0.35, Number(hit.confidenceBase || 0.45) - (hit.sourceStatus === 'approved' ? 0 : 0.05)),
    )

    return {
      attachments: Array.isArray(hit.attachments)
        ? hit.attachments
            .map((attachment) => ({
              name: typeof attachment?.name === 'string' ? attachment.name : '',
              url: typeof attachment?.url === 'string' ? attachment.url : '',
            }))
            .filter((attachment) => attachment.name || attachment.url)
        : [],
      type: hit.sourceType || 'knowledge_base',
      confidence: isCommunity
        ? communityConfidence
        : Math.min(0.95, 0.55 + Math.min(0.35, (hit.score || 0) * 0.03)),
      title: hit.title || '知识库来源',
      postId: isCommunity && hit.postId ? hit.postId : undefined,
      url: isCommunity ? undefined : hit.url || (hit.id ? `/kb/download?id=${encodeURIComponent(hit.id)}` : undefined),
      loginRequiredHint: false,
      snippet: hit.snippet || undefined,
      note: isCommunity ? COMMUNITY_SOURCE_NOTE : undefined,
    }
  })
}
