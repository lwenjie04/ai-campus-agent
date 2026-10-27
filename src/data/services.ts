import catalogRaw from '../../docs/service-catalog-v2.json'
import type { ServiceCategory, ServiceCategoryId, ServiceItem, ServiceSource } from '@/types/service'

// 5.2：前端只读取 5.1 已人工确认的事项清单，不在这里复制政策正文。
// 分类 ID 与事项清单一致；展示文案沿用 2.2 已验收的首页分类命名。
export type { ServiceCategory, ServiceCategoryId, ServiceItem, ServiceSource } from '@/types/service'

const teaching: ServiceCategory = {
  id: 'teaching',
  label: '教务办理',
  title: '转专业与选课',
  description: '资格、材料、办理入口。',
}

export const DEFAULT_SERVICE_CATEGORY = teaching

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  teaching,
  { id: 'scholarship', label: '奖助学金', title: '奖助学金申请', description: '条件、证明、提交方式。' },
  { id: 'exam', label: '考试安排', title: '补考与考试安排', description: '报名、时间、成绩查询。' },
  { id: 'life', label: '生活服务', title: '宿舍与生活服务', description: '宿舍、报修、校车服务。' },
]

export const isServiceCategoryId = (value: unknown): value is ServiceCategoryId =>
  SERVICE_CATEGORIES.some((category) => category.id === value)

const CATEGORY_INDEX = new Map(SERVICE_CATEGORIES.map((category) => [category.id, category]))

export const getServiceCategory = (id: ServiceCategoryId): ServiceCategory =>
  CATEGORY_INDEX.get(id) ?? DEFAULT_SERVICE_CATEGORY

// 事项清单的字段运行时校验：清单被人工修改后，缺字段或分类非法的条目不进入页面。
type RawServiceSource = {
  title?: unknown
  sourceDate?: unknown
  sourceLocator?: unknown
  referenceUrl?: unknown
  freshness?: unknown
  checkedAt?: unknown
}

type RawServiceItem = {
  id?: unknown
  category?: unknown
  title?: unknown
  keywords?: unknown
  purpose?: unknown
  questionTemplate?: unknown
  source?: RawServiceSource
  actionUrl?: unknown
}

const rawItems = (catalogRaw as unknown as { items?: RawServiceItem[] }).items ?? []

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const asOptionalText = (value: unknown) => {
  const text = asText(value)
  return text ? text : null
}

const asKeywordList = (value: unknown) =>
  Array.isArray(value) ? value.filter((keyword): keyword is string => typeof keyword === 'string') : []

const toServiceSource = (raw: RawServiceSource | undefined): ServiceSource => ({
  title: asText(raw?.title),
  sourceDate: asOptionalText(raw?.sourceDate),
  sourceLocator: asOptionalText(raw?.sourceLocator),
  referenceUrl: asOptionalText(raw?.referenceUrl),
  freshness: asOptionalText(raw?.freshness),
  checkedAt: asOptionalText(raw?.checkedAt),
})

const toServiceItem = (raw: RawServiceItem): ServiceItem | null => {
  const id = asText(raw.id)
  const title = asText(raw.title)
  const { category } = raw
  if (!id || !title || !isServiceCategoryId(category)) return null

  return {
    id,
    category,
    title,
    keywords: asKeywordList(raw.keywords),
    purpose: asText(raw.purpose),
    questionTemplate: asText(raw.questionTemplate),
    source: toServiceSource(raw.source),
    actionUrl: asOptionalText(raw.actionUrl),
  }
}

export const SERVICE_ITEMS: ServiceItem[] = rawItems.flatMap((raw) => {
  const item = toServiceItem(raw)
  return item ? [item] : []
})

const SERVICE_ITEM_INDEX = new Map(SERVICE_ITEMS.map((item) => [item.id, item]))

export const listServiceItems = (category: ServiceCategoryId): ServiceItem[] =>
  SERVICE_ITEMS.filter((item) => item.category === category)

export const getServiceItem = (id: unknown): ServiceItem | undefined => {
  const key = asText(id)
  return key ? SERVICE_ITEM_INDEX.get(key) : undefined
}
