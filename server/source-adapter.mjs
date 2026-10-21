import { createHash } from 'node:crypto'

const SOURCE_TYPES = new Set(['official', 'knowledge_base', 'community', 'rule', 'lightrag'])
const COMMUNITY_TYPES = new Set(['community_post', 'community_summary'])
const OFFICIAL_TYPES = new Set(['official_notice', 'student_handbook', 'official'])
const RULE_TYPES = new Set([
  'official_site',
  'academic_system',
  'academic_notice',
  'student_affairs',
  'logistics_service',
  'library_service',
  'rule_match',
])

const optionalText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

const normalizeIsoDate = (value) => {
  const text = optionalText(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00.000Z`)
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text ? null : text
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return null
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

const normalizeDownloadUrl = (value) => {
  const url = optionalText(value)
  if (!url) return undefined
  return url.replace(/^\/(?:api\/)?kb\/download(?=\?|$)/, '/api/kb/download')
}

const normalizeSourceType = (source) => {
  const type = String(source.type || source.sourceType || '').trim().toLowerCase()
  if (SOURCE_TYPES.has(type)) return type
  if (COMMUNITY_TYPES.has(type) || source.postId) return 'community'
  if (RULE_TYPES.has(type)) return 'rule'
  if (OFFICIAL_TYPES.has(type) || source.isOfficial === true) return 'official'
  return 'knowledge_base'
}

const stableSourceId = (source, type) => {
  const explicitId = optionalText(source.sourceId || source.id || source.docId || source.postId)
  if (explicitId) return `${type}:${explicitId}`

  const identity = [type, source.type || source.sourceType || '', source.title || '', source.url || ''].join('|')
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 20)
  return `${type}:${digest}`
}

const normalizeAttachments = (attachments) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => ({
      name: optionalText(attachment?.name) || '',
      url: normalizeDownloadUrl(attachment?.url),
      ...(optionalText(attachment?.mimeType) ? { mimeType: optionalText(attachment.mimeType) } : {}),
    }))
    .filter((attachment) => attachment.name && attachment.url)

export const adaptMessageSources = (sources) => {
  if (!Array.isArray(sources)) return []

  return sources
    .filter((source) => source && typeof source === 'object')
    .map((source) => {
      const type = normalizeSourceType(source)
      const validity = ['current', 'expired', 'unknown'].includes(source.validity)
        ? source.validity
        : 'unknown'
      const postId = optionalText(source.postId)

      return {
        sourceId: stableSourceId(source, type),
        type,
        title: optionalText(source.title) || '未命名来源',
        ...(normalizeDownloadUrl(source.url) ? { url: normalizeDownloadUrl(source.url) } : {}),
        attachments: normalizeAttachments(source.attachments),
        publishedAt: normalizeIsoDate(source.publishedAt),
        updatedAt: normalizeIsoDate(source.updatedAt),
        applicablePeriod: optionalText(source.applicablePeriod),
        validity,
        ...(postId ? { postId } : {}),
        ...(optionalText(source.snippet) ? { snippet: optionalText(source.snippet) } : {}),
        ...(optionalText(source.note) ? { note: optionalText(source.note) } : {}),
      }
    })
}
