import type {
  CommunityKnowledge,
  CommunityKnowledgeGenerateResult,
  CommunityMeta,
  CommunityPostDetailResponse,
  CommunityPostsResponse,
  CommunityPost,
  CommunityReply,
  CommunityReviewListResponse,
} from '@/types/community'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok || !payload || payload.code !== 0) {
    throw new Error(payload?.message || `请求失败：${response.status}`)
  }

  return payload.data
}

export const getCommunityMeta = () => request<CommunityMeta>('/community/meta')

export const getCommunityPosts = (params?: {
  page?: number
  pageSize?: number
  category?: string
  keyword?: string
  sortBy?: 'latest' | 'hot'
}) => {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.pageSize) search.set('pageSize', String(params.pageSize))
  if (params?.category) search.set('category', params.category)
  if (params?.keyword) search.set('keyword', params.keyword)
  if (params?.sortBy) search.set('sortBy', params.sortBy)

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<CommunityPostsResponse>(`/community/posts${suffix}`)
}

export const getCommunityPostDetail = (postId: string) =>
  request<CommunityPostDetailResponse>(`/community/posts/${postId}`)

export const getCommunityReviewPostDetail = (postId: string) =>
  request<CommunityPostDetailResponse>(`/community/review/posts/${postId}/detail`)

export const createCommunityPost = (payload: {
  authorName: string
  authorRole?: 'student' | 'teacher'
  title: string
  content: string
  category: string
  tags?: string[]
}) =>
  request<{ id: string; status: string }>('/community/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const createCommunityReply = (
  postId: string,
  payload: {
    authorName: string
    authorRole?: 'student' | 'teacher'
    content: string
  },
) =>
  request<{ id: string; status: string }>(`/community/posts/${postId}/replies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const generateCommunityKnowledge = (postId: string) =>
  request<CommunityKnowledgeGenerateResult>('/community/knowledge/generate', {
    method: 'POST',
    body: JSON.stringify({ postId }),
  })

export const getCommunityKnowledgeList = (status?: 'pending' | 'approved' | 'rejected') => {
  const search = new URLSearchParams()
  if (status) search.set('status', status)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<CommunityReviewListResponse<CommunityKnowledge>>(`/community/knowledge${suffix}`)
}

export const approveCommunityKnowledge = (knowledgeId: string) =>
  request<{ id: string; status: string }>(`/community/knowledge/${knowledgeId}/approve`, {
    method: 'POST',
  })

export const rejectCommunityKnowledge = (knowledgeId: string) =>
  request<{ id: string; status: string }>(`/community/knowledge/${knowledgeId}/reject`, {
    method: 'POST',
  })

export const getCommunityKnowledgeCandidates = () =>
  request<CommunityReviewListResponse<CommunityPost>>('/community/knowledge/candidates')

export const getPendingCommunityPosts = () =>
  request<CommunityReviewListResponse<CommunityPost>>('/community/review/posts')

export const getPendingCommunityReplies = () =>
  request<CommunityReviewListResponse<CommunityReply>>('/community/review/replies')

export const approveCommunityPost = (postId: string) =>
  request<{ id: string; status: string }>(`/community/review/posts/${postId}/approve`, {
    method: 'POST',
  })

export const rejectCommunityPost = (postId: string) =>
  request<{ id: string; status: string }>(`/community/review/posts/${postId}/reject`, {
    method: 'POST',
  })

export const approveCommunityReply = (replyId: string) =>
  request<{ id: string; status: string }>(`/community/review/replies/${replyId}/approve`, {
    method: 'POST',
  })

export const rejectCommunityReply = (replyId: string) =>
  request<{ id: string; status: string }>(`/community/review/replies/${replyId}/reject`, {
    method: 'POST',
  })
