import { apiUrl } from '@/config/app'
import type { MessageSource, MessageSourceValidity } from '@/types/agent'

// 4.4：来源展示统一收口，聊天消息、桌面来源栏和手机抽屉共用同一套文案。

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official: '官方来源',
  knowledge_base: '知识库',
  community: '社区经验',
  rule: '规则依据',
  lightrag: '知识库',
}

export const sourceTypeLabel = (type?: string) => (type ? SOURCE_TYPE_LABELS[type] || '资料来源' : '资料来源')

export const sourceTypeTagLabel = (type?: string) => {
  if (type === 'community') return '社区经验'
  if (type === 'official') return '官方来源'
  if (type === 'rule') return '规则依据'
  return '知识库'
}

export const resolveSourceHref = (url?: string) => (url ? apiUrl(url) : '')

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const normalizeDate = (value?: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

const formatDate = (value?: string | null) => {
  const parsed = normalizeDate(value)
  return parsed ? dateFormatter.format(parsed) : '未提供'
}

export const sourcePublishedText = (source: MessageSource) => formatDate(source.publishedAt)

export const sourceUpdatedText = (source: MessageSource) => formatDate(source.updatedAt)

export const sourceMetaText = (source: MessageSource) => {
  const parts: string[] = []
  if (source.applicablePeriod) parts.push(`适用 ${source.applicablePeriod}`)
  const published = normalizeDate(source.publishedAt)
  if (published) parts.push(`发布 ${dateFormatter.format(published)}`)
  const updated = normalizeDate(source.updatedAt)
  if (updated) parts.push(`更新 ${dateFormatter.format(updated)}`)
  return parts.length > 0 ? parts.join(' · ') : '日期未提供'
}

export const sourceValidityLabel = (validity?: MessageSourceValidity) => {
  if (validity === 'current') return '现行有效'
  if (validity === 'expired') return '已失效'
  return '时效未知'
}

// 来源栏底部的时效提醒：有明确状态时说清楚，没有就回到中性提示。
export const sourceValidityNote = (sources: MessageSource[]) => {
  if (sources.some((source) => source.validity === 'expired')) {
    return '当前资料为历史通知，条件、名额与截止时间需要核对本学年正式通知。'
  }
  if (sources.some((source) => source.validity === 'current')) {
    return '当前资料在有效期内，办理前仍建议核对学校最新通知。'
  }
  return '来源未标注时效，办理前请以学校最新通知为准。'
}
