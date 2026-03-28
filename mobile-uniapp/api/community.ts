import type { MobileCommunityPost, MobileCommunityReply } from '../types/community'
import { request } from './http'

export const getCommunityPosts = (keyword = '') =>
  request<{
    list: MobileCommunityPost[]
    pagination: {
      page: number
      pageSize: number
      total: number
    }
  }>(`/community/posts${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`)

export const getCommunityPostDetail = (postId: string) =>
  request<{
    post: MobileCommunityPost
    replies: MobileCommunityReply[]
  }>(`/community/posts/${postId}`)

export const createCommunityPost = (payload: {
  authorName: string
  title: string
  content: string
  category: string
  tags: string[]
}) =>
  request<{ id: string; status: string }>('/community/posts', {
    method: 'POST',
    data: payload,
  })

export const createCommunityReply = (postId: string, payload: { authorName: string; content: string }) =>
  request<{ id: string; status: string }>(`/community/posts/${postId}/replies`, {
    method: 'POST',
    data: payload,
  })
