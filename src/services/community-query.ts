// 6.1：社区列表筛选/分页与 URL 的纯函数，便于单测和列表/详情复用。
export type CommunitySort = 'latest' | 'hot'

export type CommunityQueryState = {
  keyword: string
  category: string
  sort: CommunitySort
  page: number
}

type QueryLike = Record<string, unknown>

const firstString = (value: unknown) => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export const parseCommunityQuery = (
  query: QueryLike,
  categories: string[] = [],
): CommunityQueryState => {
  const keyword = firstString(query.q).trim()
  const rawCategory = firstString(query.category).trim()
  const category = categories.includes(rawCategory) ? rawCategory : ''
  const sort: CommunitySort = firstString(query.sort) === 'hot' ? 'hot' : 'latest'
  const parsedPage = Number.parseInt(firstString(query.page), 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  return { keyword, category, sort, page }
}

export const buildCommunityQuery = (state: CommunityQueryState): Record<string, string> => {
  const query: Record<string, string> = {}
  const keyword = state.keyword.trim()
  if (keyword) query.q = keyword
  if (state.category) query.category = state.category
  if (state.sort !== 'latest') query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  return query
}

export const communityTotalPages = (total: number, pageSize: number) => {
  const safeSize = pageSize > 0 ? pageSize : 10
  return Math.max(1, Math.ceil(Math.max(0, total) / safeSize))
}

// 越界的 page（例如手改 URL）回落到最后一页；无数据时回到第 1 页。
export const clampCommunityPage = (page: number, total: number, pageSize: number) => {
  const lastPage = communityTotalPages(total, pageSize)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.floor(page), lastPage)
}
