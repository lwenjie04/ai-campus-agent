import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const KB_PATH = resolve(process.cwd(), 'server/data/knowledge-base.json')

let knowledgeBaseCache = null

const safeParseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

const loadKnowledgeBase = () => {
  if (knowledgeBaseCache) return knowledgeBaseCache
  if (!existsSync(KB_PATH)) {
    knowledgeBaseCache = []
    return knowledgeBaseCache
  }

  const raw = readFileSync(KB_PATH, 'utf8')
  const parsed = safeParseJson(raw)
  knowledgeBaseCache = Array.isArray(parsed) ? parsed : []
  return knowledgeBaseCache
}

const normalize = (text) => String(text || '').toLowerCase().trim()

const CHINESE_KEYWORDS = [
  '奖学金',
  '国家奖学金',
  '国家励志奖学金',
  '竞赛奖学金',
  '助学金',
  '资助',
  '转专业',
  '补退选',
  '课程补退选',
  '成绩认定',
  '课程认定',
  '学分认定',
  '教务',
  '选课',
  '课表',
  '补考',
  '重修',
  '考试',
]

const generateChineseNGrams = (query) => {
  const grams = new Set()
  const segments = query.match(/[\u4e00-\u9fff]{2,}/g) || []

  for (const seg of segments) {
    if (seg.length <= 6) grams.add(seg)
    const maxGram = Math.min(4, seg.length)
    for (let size = 2; size <= maxGram; size += 1) {
      for (let i = 0; i <= seg.length - size; i += 1) {
        grams.add(seg.slice(i, i + size))
      }
    }
  }

  return grams
}

const extractQueryTerms = (query) => {
  const q = normalize(query)
  const terms = new Set()
  if (!q) return []

  terms.add(q)

  q.split(/[\s,，。！？；:：、（）()【】\[\]\-_/]+/).forEach((t) => {
    const term = t.trim()
    if (term.length >= 2) terms.add(term)
  })

  for (const gram of generateChineseNGrams(q)) {
    if (gram.length >= 2) terms.add(gram)
  }

  CHINESE_KEYWORDS.forEach((kw) => {
    if (q.includes(kw)) terms.add(kw)
  })

  return Array.from(terms)
}

const entrySearchText = (entry) =>
  normalize([entry.title, entry.content, ...(Array.isArray(entry.keywords) ? entry.keywords : [])].join(' '))

const scoreEntry = (entry, query, terms) => {
  const q = normalize(query)
  const title = normalize(entry.title)
  const content = normalize(entry.content)
  const category = normalize(entry.category)
  const keywords = Array.isArray(entry.keywords) ? entry.keywords.map(normalize) : []

  let score = 0
  const matched = new Set()

  if (title && q && title.includes(q)) {
    score += 10
    matched.add(q)
  }
  if (content && q && content.includes(q)) {
    score += 4
    matched.add(q)
  }

  for (const term of terms) {
    if (!term || term.length < 2) continue

    if (title.includes(term)) {
      score += term.length >= 4 ? 5 : 3
      matched.add(term)
    }
    if (keywords.some((k) => k.includes(term) || term.includes(k))) {
      score += 4
      matched.add(term)
    }
    if (content.includes(term)) {
      score += term.length >= 4 ? 2 : 1
      matched.add(term)
    }
    if (category && (term.includes(category) || category.includes(term))) {
      score += 2
      matched.add(term)
    }
  }

  if (/(奖学金|资助|助学金)/.test(q) && category === 'scholarship') score += 3
  if (/(转专业|补退选|成绩认定|课程认定|学分认定)/.test(q) && category === 'teaching') score += 3
  if (/(考试|补考|重修)/.test(q) && /(teaching|exam)/.test(category)) score += 2

  // Theme-specific bias to reduce scholarship cross-contamination.
  const text = `${title} ${content} ${keywords.join(' ')}`
  if (/竞赛.*奖学金|奖学金.*竞赛/.test(q)) {
    if (/竞赛/.test(text)) score += 12
    if (/国家奖学金|国家励志奖学金/.test(text) && !/竞赛/.test(text)) score -= 10
  }
  if (/国家励志奖学金/.test(q)) {
    if (/国家励志奖学金/.test(text)) score += 12
    if (/竞赛奖学金/.test(text)) score -= 8
  }
  if (/国家奖学金/.test(q) && !/国家励志奖学金/.test(q)) {
    if (/国家奖学金/.test(text)) score += 10
    if (/竞赛奖学金/.test(text)) score -= 8
  }

  return { score, matchedTerms: Array.from(matched) }
}

const snippetFromContent = (content, query, maxLen = 72) => {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const terms = extractQueryTerms(query)
  const hit = terms.find((t) => t && t.length >= 2 && text.includes(t))
  if (!hit) return `${text.slice(0, maxLen)}${text.length > maxLen ? '...' : ''}`

  const idx = text.indexOf(hit)
  const start = Math.max(0, idx - 16)
  const end = Math.min(text.length, idx + maxLen - 16)
  const piece = text.slice(start, end)
  return `${start > 0 ? '...' : ''}${piece}${end < text.length ? '...' : ''}`
}

const applyThemeFilter = (results, query) => {
  const q = normalize(query)
  if (!q) return results

  const byText = (item) => entrySearchText(item)

  if (/竞赛.*奖学金|奖学金.*竞赛/.test(q)) {
    const narrowed = results.filter((item) => /竞赛/.test(byText(item)))
    return narrowed.length > 0 ? narrowed : results
  }

  if (/国家励志奖学金/.test(q)) {
    const narrowed = results.filter((item) => /国家励志奖学金/.test(byText(item)))
    return narrowed.length > 0 ? narrowed : results
  }

  if (/国家奖学金/.test(q) && !/国家励志奖学金/.test(q)) {
    const narrowed = results.filter((item) => /国家奖学金/.test(byText(item)) && !/竞赛奖学金/.test(byText(item)))
    return narrowed.length > 0 ? narrowed : results
  }

  return results
}

export const getKnowledgeBaseEntryById = (id) => {
  const kb = loadKnowledgeBase()
  return kb.find((item) => item.id === id) || null
}

export const searchKnowledgeBase = (query, options = {}) => {
  const limit = options.limit ?? 3
  const minScore = options.minScore ?? 3
  const kb = loadKnowledgeBase()
  if (!normalize(query)) return []

  const terms = extractQueryTerms(query)

  const ranked = kb
    .map((entry) => {
      const { score, matchedTerms } = scoreEntry(entry, query, terms)
      return {
        ...entry,
        score,
        matchedTerms,
        snippet: snippetFromContent(entry.content, query),
      }
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return applyThemeFilter(ranked, query).slice(0, limit)
}

export const buildRagContext = (hits) => {
  if (!Array.isArray(hits) || hits.length === 0) return ''

  const blocks = hits.map((hit, index) =>
    [
      `[参考资料 ${index + 1}]`,
      `标题：${hit.title}`,
      `分类：${hit.category || 'unknown'}`,
      `更新时间：${hit.updatedAt || '未知'}`,
      `内容摘要：${hit.content || ''}`,
    ].join('\n'),
  )

  return [
    '以下是与当前问题相关的校园知识库资料（优先参考；若与通用知识冲突，请以资料内容和学校最新通知为准）：',
    ...blocks,
    '请基于以上资料直接回答用户问题，不要先输出空泛说明。',
    '输出格式要求：',
    '1. 使用“**结论总结**”标题，先给1-3句直接结论。',
    '2. 使用“**关键信息/办理步骤**”标题，按条目列出条件、材料、时间、步骤。',
    '3. 使用“**核实渠道**”标题，给出官网/部门/老师等核实路径。',
    '4. 如资料不足或信息有时效性，明确写出“以学校最新通知为准”。',
    '5. 不要大段复述原文；优先总结、归纳、可执行建议。',
  ].join('\n\n')
}

export const ragHitsToSources = (hits) => {
  if (!Array.isArray(hits)) return []

  return hits.map((hit) => ({
    attachments: Array.isArray(hit.attachments)
      ? hit.attachments
          .map((a) => ({
            name: typeof a?.name === 'string' ? a.name : '',
            url: typeof a?.url === 'string' ? a.url : '',
          }))
          .filter((a) => a.name || a.url)
      : [],
    type: hit.sourceType || 'knowledge_base',
    confidence: Math.min(0.95, 0.55 + Math.min(0.35, (hit.score || 0) * 0.03)),
    title: hit.title,
    url: hit.url || (hit.id ? `/kb/download?id=${encodeURIComponent(hit.id)}` : undefined),
    loginRequiredHint:
      typeof hit.url === 'string' &&
      /https?:\/\/(?:www\.)?gdei\.edu\.cn\/nw\//i.test(hit.url) &&
      hit.sourceType === 'official_notice',
    snippet: hit.snippet || undefined,
  }))
}

