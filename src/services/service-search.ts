import { SERVICE_ITEMS } from '@/data/services'
import type { ServiceItem } from '@/types/service'

// 5.3：只匹配事项标题与关键词，不检索用途、来源或政策正文。
const normalize = (value: string) => value.trim().toLocaleLowerCase()

export const matchServiceItem = (item: ServiceItem, term: string): boolean => {
  const keyword = normalize(term)
  if (!keyword) return false
  return [item.title, ...item.keywords].some((value) => normalize(value).includes(keyword))
}

export const searchServiceItems = (term: string): ServiceItem[] => {
  if (!term.trim()) return []
  return SERVICE_ITEMS.filter((item) => matchServiceItem(item, term))
}

// 无结果转问：问题文本只进入本地草稿，不写入 URL，也不自动发送。
export const buildAskQuestion = (term: string): string => {
  const keyword = term.trim()
  if (!keyword) return ''
  return `帮我查一下「${keyword}」相关的办事事项和学校最新通知。`
}
