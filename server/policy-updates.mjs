import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 5.4：现行政策提示数据。只收录已核实、且与仓库语料冲突的现行结论；
// 仅在问题命中金额/标准等意图时注入上下文，不改写学生手册原文。
const POLICY_UPDATES_PATH = resolve(
  process.cwd(),
  process.env.POLICY_UPDATES_PATH || 'server/data/policy-updates.json',
)

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s（）()《》“”"'：:，,。.!！?？、·—-]/g, '')

let cache = null

const isEntryValid = (entry) =>
  Boolean(entry) &&
  typeof entry === 'object' &&
  typeof entry.id === 'string' &&
  entry.id.trim().length > 0 &&
  typeof entry.title === 'string' &&
  entry.title.trim().length > 0 &&
  typeof entry.statement === 'string' &&
  entry.statement.trim().length > 0 &&
  Array.isArray(entry.topics) &&
  Array.isArray(entry.intentKeywords) &&
  Array.isArray(entry.sources)

const loadPolicyUpdates = () => {
  if (cache) return cache

  try {
    if (!existsSync(POLICY_UPDATES_PATH)) {
      cache = []
      return cache
    }
    const parsed = JSON.parse(readFileSync(POLICY_UPDATES_PATH, 'utf8').replace(/^\uFEFF/, ''))
    cache = Array.isArray(parsed?.entries) ? parsed.entries.filter(isEntryValid) : []
  } catch {
    cache = []
  }

  return cache
}

const matchesEntry = (entry, query) => {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return false

  const topics = entry.topics.map(normalize).filter(Boolean)
  const intents = entry.intentKeywords.map(normalize).filter(Boolean)
  return (
    topics.some((topic) => normalizedQuery.includes(topic)) &&
    intents.some((intent) => normalizedQuery.includes(intent))
  )
}

export const matchPolicyUpdates = (query) => loadPolicyUpdates().filter((entry) => matchesEntry(entry, query))

const formatEntry = (entry, index) =>
  [
    `[现行政策 ${index + 1}] ${entry.title}`,
    `- 现行结论：${entry.statement}`,
    entry.supersedes ? `- 冲突/取代：${entry.supersedes}` : '',
    entry.appliesFrom ? `- 生效时间：${entry.appliesFrom}` : '',
    `- 核实来源：${entry.sources.map((source) => source.title).join('；')}`,
  ]
    .filter(Boolean)
    .join('\n')

/**
 * 生成注入模型的现行政策上下文；未命中金额/标准等意图时返回空串。
 */
export const formatPolicyUpdateContext = (query) => {
  const matched = matchPolicyUpdates(query)
  if (matched.length === 0) return ''

  return [
    '以下为已核实的现行政策提示，优先于学生手册中的旧条文；引用时请说明来源与生效时间，并提示用户以学校最新通知为准。',
    ...matched.map((entry, index) => formatEntry(entry, index)),
    '使用边界：本提示只用于对应主题的金额/标准等问题；如果用户问的是其他主题、尚未发布的新年度安排或非金额内容，不要套用本提示。',
  ].join('\n\n')
}

/**
 * 将命中的现行政策来源转成与 ragHitsToSources 一致的来源对象，供前端来源卡展示。
 */
export const policyUpdatesToSources = (query) =>
  matchPolicyUpdates(query).flatMap((entry) =>
    entry.sources
      .filter((source) => source && typeof source.title === 'string' && source.title.trim())
      .map((source, index) => ({
        id: `${entry.id}-source-${index + 1}`,
        type: 'official_notice',
        title: source.title.trim(),
        ...(typeof source.url === 'string' && source.url.trim() ? { url: source.url.trim() } : {}),
        publishedAt: source.publishedAt || null,
        updatedAt: null,
        applicablePeriod: entry.appliesFrom || null,
        validity: 'current',
        loginRequiredHint: false,
        snippet: entry.statement,
      })),
  )
