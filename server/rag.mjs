import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMySqlConfigured, query } from './mysql.mjs'
import { searchVectorIndex } from './vector-index.mjs'
import { getApprovedMockCommunityKnowledge } from './community.mjs'
import { formatPolicyUpdateContext } from './policy-updates.mjs'

const KB_PATH = resolve(
  process.cwd(),
  process.env.RAG_KNOWLEDGE_BASE_PATH || 'server/data/knowledge-base.json',
)
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
  // 2 字领域词（如“调宿”“补考”）不会进入 3 字以上的 n-gram，标题命中时单独加权，
  // 避免长句查询因只有短领域词可匹配而丢失正确事项。
  domainTitleBoost: toNumber(process.env.RAG_WEIGHT_DOMAIN_TITLE_BOOST, 7),
}

const TIME_DECAY = {
  enabled: (process.env.RAG_TIME_DECAY_ENABLED ?? 'true') === 'true',
  halfLifeDays: toNumber(process.env.RAG_TIME_DECAY_HALFLIFE_DAYS, 90),
  minFactor: toNumber(process.env.RAG_TIME_DECAY_MIN_FACTOR, 0.5),
}

const RAG_LOG_ENABLED = (process.env.RAG_LOG_ENABLED ?? 'true') === 'true'
const ROUTE_MIN_HITS = toNumber(process.env.RAG_ROUTE_MIN_HITS, 2)
const RAG_ROUTE_MIN_SCORE = toNumber(process.env.RAG_ROUTE_MIN_SCORE, 3)
const RAG_ANSWER_MIN_SCORE = Math.max(0, toNumber(process.env.RAG_ANSWER_MIN_SCORE, 3))
const VECTOR_SEARCH_ENABLED = (process.env.RAG_VECTOR_ENABLED ?? 'true') === 'true'
const VECTOR_SEARCH_LIMIT = toNumber(process.env.RAG_VECTOR_TOPK, 8)
const KEYWORD_SEARCH_MULTIPLIER = toNumber(process.env.RAG_KEYWORD_LIMIT_MULTIPLIER, 3)
const FINAL_VECTOR_WEIGHT = toNumber(process.env.RAG_WEIGHT_VECTOR_SCORE, 6)

const COMMUNITY_SOURCE_TYPES = new Set(['community_post', 'community_summary'])
const COMMUNITY_SOURCE_NOTE = '以下内容来自学生社区经验总结，仅供参考，请以学校最新官方通知为准。'

const CATEGORY_RULES = [
  {
    category: 'scholarship',
    patterns: [/奖学金/, /助学金/, /资助/, /国家奖学金/, /国家励志奖学金/, /竞赛奖学金/],
  },
  {
    category: 'teaching',
    patterns: [/学籍/, /转专业/, /补退选/, /课程认定/, /学分认定/, /成绩认定/, /选课/, /课表/, /教务/],
  },
  {
    category: 'exam',
    patterns: [/考试/, /补考/, /重修/, /考核/],
  },
  {
    category: 'life',
    patterns: [/宿舍/, /退宿/, /图书馆/, /食堂/, /后勤/, /报修/, /交通车/, /校车/, /肺结核/, /结核病/, /体检/],
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
    patterns: [/请假/, /考勤/, /评优/, /评先/, /辅导员/, /学生事务/],
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
  '退宿',
  '调宿',
  '复学',
  '床位',
  '报修',
  '挂失',
  '借阅',
  '补办',
  '缴费',
  '请假',
  '考勤',
  '学生证',
  '校园卡',
  '缓交',
  '减免',
  '图书馆',
  '食堂',
  '后勤',
  '科研',
  '课题',
  '立项',
  '项目申报',
  '肺结核',
  '结核病',
  '体检',
]

const DOMAIN_KEYWORD_SET = new Set(DOMAIN_KEYWORDS)

const QUERY_FILLER_PHRASES = [
  '请问',
  '帮我',
  '告诉我',
  '我想',
  '我绑定的',
  '学校附近',
  '学校的',
  '校园的',
  '具体',
  '分别',
  '最多',
  '需要经过',
  '需要',
  '怎么办理',
  '怎么申请',
  '怎么报名',
  '怎么处理',
  '怎么填写',
  '怎么做',
  '怎么办',
  '如何办理',
  '如何申请',
  '如何',
  '怎么',
  '什么时候',
  '什么时间',
  '什么',
  '哪些',
  '有哪些',
  '有什么',
  '多少',
  '多少钱',
  '是多久',
  '是什么',
  '怎么办',
  '吗',
  '呢',
  '吧',
  '一下',
  '今天',
  '明天',
  '现在',
  '上半年',
  '下半年',
  '和',
  '要',
  '的',
  '是',
]

const QUERY_FILLER_PATTERN = new RegExp(
  QUERY_FILLER_PHRASES.sort((left, right) => right.length - left.length).join('|'),
  'g',
)

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
  if (!isMySqlConfigured()) return getApprovedMockCommunityKnowledge()

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
  } catch (error) {
    console.warn(
      `[rag] community knowledge query failed, falling back to mock: ${error?.code || error?.message || 'UNKNOWN_ERROR'}`,
    )
    return getApprovedMockCommunityKnowledge()
  }
}

const expandBySynonyms = (terms) => {
  const set = new Set(terms)
  for (const term of terms) {
    if (term.length < 3) continue
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(term)) {
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

  const focusedQuery = q.replace(QUERY_FILLER_PATTERN, '')

  const terms = new Set(focusedQuery ? [focusedQuery] : [])

  focusedQuery.split(/[\s,，。！？；:：、（）()[\]\-_/]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .forEach((item) => terms.add(item))

  for (const gram of generateChineseNgrams(focusedQuery)) {
    if (gram.length >= 3) terms.add(gram)
  }

  for (const keyword of DOMAIN_KEYWORDS) {
    if (focusedQuery.includes(keyword)) terms.add(keyword)
  }

  return expandBySynonyms(Array.from(terms))
}

const createQueryTermWeights = (entries, terms) => {
  const uniqueTerms = new Set(terms.filter((term) => term.length >= 2))
  const weights = new Map()
  const searchableEntries = entries.map((entry) =>
    [entry.title, entry.content, ...(entry.keywords || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  )

  for (const term of uniqueTerms) {
    if (term.length === 2) {
      weights.set(term, 1)
      continue
    }
    let documentFrequency = 0
    for (const searchableText of searchableEntries)
      if (searchableText.includes(term)) documentFrequency += 1
    const inverseDocumentFrequency = 1 + Math.log((entries.length + 1) / (documentFrequency + 1))
    weights.set(term, Math.min(2.5, inverseDocumentFrequency))
  }

  return weights
}

const isExplicitlyUnsupportedQuery = (query) => {
  const value = normalize(query)
  return (
    /(?:银行卡|账号|密码|验证码).{0,10}(?:是多少|是什么|告诉我|查一下)/.test(value) ||
    /(?:食堂|餐厅|菜品|饭菜).{0,12}(?:多少钱|价格|售价)/.test(value) ||
    /(?:代写|写一封).{0,20}(?:邮件|英文|实习)/.test(value)
  )
}

const matchesExplicitQueryYear = (entry, query) => {
  const years = [...String(query || '').matchAll(/\b(20\d{2})\b/g)].map((match) => match[1])
  if (years.length === 0) return true

  const dateSpecificQuery = /(?:何时|哪天|什么时候|报名|日期|时间|安排|哪一年)/.test(String(query || ''))
  if (!dateSpecificQuery) return true

  const sourceYears = [entry.title, entry.content].join(' ').match(/\b20\d{2}\b/g)
  if (!sourceYears?.length) return true
  return years.some((year) => sourceYears.includes(year))
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

const scoreEntry = (entry, query, terms, preferredCategories = [], termWeights = new Map()) => {
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
    const termWeight = termWeights.get(term) || 1

    if (title.includes(term)) {
      baseScore +=
        (term.length >= 4 ? RAG_WEIGHTS.termTitleLong : RAG_WEIGHTS.termTitleShort) * termWeight
      if (term.length === 2 && DOMAIN_KEYWORD_SET.has(term)) {
        baseScore += RAG_WEIGHTS.domainTitleBoost * termWeight
      }
      matchedTerms.add(term)
    }

    if (content.includes(term)) {
      baseScore +=
        (term.length >= 4 ? RAG_WEIGHTS.termContentLong : RAG_WEIGHTS.termContentShort) * termWeight
      matchedTerms.add(term)
    }

    if (keywords.includes(term)) {
      baseScore += RAG_WEIGHTS.keywordMatch * termWeight
      matchedTerms.add(term)
    }

    if (category && (category.includes(term) || term.includes(category))) {
      baseScore += RAG_WEIGHTS.categoryMatch * termWeight
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

const rankEntries = (entries, query, terms, preferredCategories, options, termWeights) =>
  entries
    .map((entry) => {
      const { score, baseScore, decayFactor, matchedTerms } = scoreEntry(
        entry,
        query,
        terms,
        preferredCategories,
        termWeights,
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

const createHitMergeKey = (hit) => {
  const sourceType = String(hit.sourceType || 'official_notice')
  const docId = String(hit.docId || hit.id || '')
  const postId = String(hit.postId || '')
  const url = String(hit.url || '')
  return [sourceType, docId, postId, url].filter(Boolean).join('::')
}

const mergeHybridHits = (keywordHits, vectorHits) => {
  const merged = new Map()

  for (const hit of keywordHits) {
    const key = createHitMergeKey(hit)
    merged.set(key, {
      ...hit,
      keywordScore: hit.score || 0,
      vectorScore: 0,
      score: hit.score || 0,
    })
  }

  for (const hit of vectorHits) {
    const key = createHitMergeKey(hit)
    const existing = merged.get(key)

    if (existing) {
      merged.set(key, {
        ...existing,
        docId: existing.docId || hit.docId || hit.id,
        postId: existing.postId || hit.postId || '',
        title: existing.title || hit.title,
        content: existing.content || hit.content,
        snippet: existing.snippet || hit.contentPreview || '',
        contentPreview: existing.contentPreview || hit.contentPreview || '',
        sourceType: existing.sourceType || hit.sourceType,
        sourceStatus: existing.sourceStatus || hit.sourceStatus,
        updatedAt: existing.updatedAt || hit.updatedAt,
        isOfficial: typeof existing.isOfficial === 'boolean' ? existing.isOfficial : hit.isOfficial,
        priority: Number(existing.priority ?? hit.priority ?? 0),
        vectorScore: Math.max(existing.vectorScore || 0, hit.vectorScore || 0),
      })
      continue
    }

    merged.set(key, {
      ...hit,
      docId: hit.docId || hit.id,
      keywordScore: 0,
      vectorScore: hit.vectorScore || 0,
      baseScore: 0,
      decayFactor: 1,
      matchedTerms: [],
      snippet: hit.contentPreview || '',
      score: 0,
    })
  }

  return Array.from(merged.values())
}

const rerankHybridHits = (hits) =>
  hits
    .map((hit) => {
      const vectorScore = Math.max(0, Number(hit.vectorScore) || 0)
      const keywordScore = Number(hit.keywordScore ?? hit.score ?? 0) || 0
      const finalScore = keywordScore + vectorScore * FINAL_VECTOR_WEIGHT

      return {
        ...hit,
        vectorScore,
        keywordScore,
        score: finalScore,
      }
    })
    .sort((a, b) => b.score - a.score)

export const getKnowledgeBaseEntryById = (id) => {
  const kb = loadKnowledgeBase()
  return kb.find((item) => String(item.id) === String(id)) || null
}

export const searchKnowledgeBase = async (query, options = {}) => {
  const limit = options.limit ?? 3
  const minScore = options.minScore ?? RAG_ROUTE_MIN_SCORE
  if (options.signal?.aborted) throw options.signal.reason
  const q = normalize(query)
  if (!q) return []
  if (isExplicitlyUnsupportedQuery(q)) return []

  const officialKnowledge = loadKnowledgeBase()
  const communityKnowledge = options.includeCommunity === false ? [] : await loadCommunityKnowledge()
  if (options.signal?.aborted) throw options.signal.reason
  const requestedEntries = [...officialKnowledge, ...communityKnowledge]
  const allEntries = requestedEntries.filter((entry) => matchesExplicitQueryYear(entry, query))
  const terms = extractQueryTerms(q)
  const termWeights = createQueryTermWeights(allEntries, terms)
  const preferredCategories = inferQueryCategories(query)

  let ranked = []
  let routeMode = 'global_only'
  const keywordLimit = Math.max(limit, limit * Math.max(1, KEYWORD_SEARCH_MULTIPLIER))

  if (preferredCategories.length > 0) {
    const routedEntries = allEntries.filter((entry) =>
      preferredCategories.includes(String(entry.category || '')),
    )
    const routedRanked = rankEntries(
      routedEntries,
      q,
      terms,
      preferredCategories,
      { minScore },
      termWeights,
    )

    if (routedRanked.length >= ROUTE_MIN_HITS) {
      ranked = dedupeRankedHits(routedRanked)
      routeMode = 'category_only'
    } else {
      const globalRanked = rankEntries(
        allEntries,
        q,
        terms,
        preferredCategories,
        { minScore },
        termWeights,
      )
      ranked = dedupeRankedHits(globalRanked)
      routeMode = routedRanked.length > 0 ? 'category_then_global' : 'global_fallback'
    }
  } else {
    ranked = dedupeRankedHits(rankEntries(allEntries, q, terms, [], { minScore }, termWeights))
  }

  const keywordHits = ranked.slice(0, keywordLimit)

  let vectorHits = []
  if (VECTOR_SEARCH_ENABLED) {
    try {
      vectorHits = await searchVectorIndex(query, {
        limit: Math.max(limit, VECTOR_SEARCH_LIMIT),
        signal: options.signal,
      })
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason || error
      vectorHits = []
    }
  }

  if (options.signal?.aborted) throw options.signal.reason

  const finalHits = rerankHybridHits(mergeHybridHits(keywordHits, vectorHits))
    .filter((hit) => hit.score >= minScore)
    .slice(0, limit)
  logSearch(query, { limit, minScore }, finalHits, {
    preferredCategories,
    routeMode,
    keywordHits: keywordHits.length,
    vectorHits: vectorHits.length,
  })
  return finalHits
}

// Retrieval may intentionally run with a permissive cutoff so candidate recall can be inspected.
// Only candidates that clear this separate answer threshold are safe to expose as grounding or sources.
export const filterConfidentRagHits = (hits, options = {}) => {
  if (!Array.isArray(hits)) return []

  const minScore = Math.max(0, toNumber(options.minScore, RAG_ANSWER_MIN_SCORE))
  return hits.filter((hit) => {
    const score = Number(hit?.score)
    return Number.isFinite(score) && score >= minScore
  })
}

export const buildRagContext = (hits, options = {}) => {
  if (!Array.isArray(hits) || hits.length === 0) return ''

  const policyContext = formatPolicyUpdateContext(options.query)

  const blocks = hits.map((hit, index) =>
    [
      `[参考资料 ${index + 1}]`,
      `标题：${hit.title || '未知'}`,
      `分类：${hit.category || 'unknown'}`,
      `来源类型：${COMMUNITY_SOURCE_TYPES.has(String(hit.sourceType || '')) ? '学生社区经验' : '官方资料'}`,
      `来源标注：${hit.authority || '未知'}`,
      `适用时期：${hit.applicablePeriod || '未知'}`,
      `发布日期：${hit.publishedAt || '未知'}`,
      `更新时间：${hit.updatedAt || '未知'}`,
      `现行状态：${hit.validity || '未知，需核验'}`,
      `内容摘要：${hit.content || ''}`,
    ].join('\n'),
  )

  return [
    '以下是与当前问题相关的校园知识资料。请优先参考官方通知；若使用学生社区经验，请明确它仅作辅助参考，不可替代学校正式通知。',
    '时效与依据规则：回答“本学年/本学期/最新/当前”等问题时，先核对资料的适用时期和发布日期。旧年度通知只能作为历史参考，不得表述为当前安排；未标明适用时期或现行状态未知的制度，不得声称仍然有效。',
    '如果资料只有标题、发布者、日期或附件线索而没有正文，不得据此推断条件、材料、办理时间、系统入口或结论；当前资料缺失时要明确说无法确认，并建议向对应学校部门核实。',
    '不同来源内容冲突时，只有明确适用于问题所问时期且可核验的正式来源才能支持当前结论；无法确认优先级或现行性时，说明冲突和不确定性，不要拼凑答案。',
    ...(policyContext ? [policyContext] : []),
    ...blocks,
    '请直接回答，不要写空泛开场白，也不要重复用户问题。',
    '输出格式要求：',
    '1. 先用“结论”给出 1 到 2 句直接答案；',
    '2. 再用“办理步骤/关键信息”列出 3 到 5 条最关键的信息；',
    '3. 如有时间、材料、适用对象或风险提示，再用“提醒”补充；',
    '4. 语言简洁，像办事指引，不要写成长篇宣传文；',
    '5. 如果引用学生社区经验，请明确写出“仅供参考，请以学校最新官方通知为准”；如果信息不足，请明确说“目前无法确认”或“请以学校最新官方通知为准”。',
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
      id: hit.id || hit.docId || hit.postId,
      attachments: Array.isArray(hit.attachments)
        ? hit.attachments
            .map((attachment) => ({
              name: typeof attachment?.name === 'string' ? attachment.name : '',
              url: typeof attachment?.url === 'string' ? attachment.url : '',
              ...(typeof attachment?.mimeType === 'string' && attachment.mimeType.trim()
                ? { mimeType: attachment.mimeType.trim() }
                : {}),
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
      publishedAt: hit.publishedAt || null,
      updatedAt: hit.updatedAt || null,
      applicablePeriod: hit.applicablePeriod || null,
      validity: hit.validity || 'unknown',
      loginRequiredHint: false,
      snippet: hit.snippet || undefined,
      note: isCommunity ? COMMUNITY_SOURCE_NOTE : undefined,
    }
  })
}
