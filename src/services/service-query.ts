import { DEFAULT_SERVICE_CATEGORY, isServiceCategoryId } from '@/data/services'
import type { ServiceCategoryId, ServiceItem } from '@/types/service'

// 5.2：办事指南列表只把分类筛选写入 URL；用户输入的问题文本不进入 URL。
type QueryLike = Record<string, unknown>

const firstString = (value: unknown) => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

// 非法或缺失的分类回落到默认分类，避免手改 URL 后出现空页面。
export const parseServiceListCategory = (query: QueryLike): ServiceCategoryId => {
  const value = firstString(query.category).trim()
  return isServiceCategoryId(value) ? value : DEFAULT_SERVICE_CATEGORY.id
}

export const buildServiceListQuery = (category: ServiceCategoryId): Record<string, string> => ({
  category,
})

export const serviceListLocation = (category: ServiceCategoryId) => ({
  path: '/services',
  query: buildServiceListQuery(category),
})

export const serviceDetailLocation = (item: Pick<ServiceItem, 'id'>) => ({
  path: `/services/${encodeURIComponent(item.id)}`,
})
