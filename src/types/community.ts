// 学生社区模块的前端类型定义。
// 这一层先把接口返回结构和页面用到的数据形状固定下来，
// 后面无论后端从 mock 切到 MySQL，前端都尽量不需要大改。

export type CommunityCategoryValue =
  | 'scholarship'
  | 'teaching'
  | 'exam'
  | 'life'
  | 'general'

export type CommunityStatus = 'pending' | 'approved' | 'rejected'

export type CommunityCategoryOption = {
  label: string
  value: CommunityCategoryValue
}

export type CommunityPost = {
  id: string
  authorName: string
  authorRole?: 'student' | 'teacher'
  title: string
  content: string
  contentPreview?: string
  category: string
  tags: string[]
  status: CommunityStatus
  replyCount: number
  likeCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  knowledgeStatus?: 'none' | 'pending' | 'approved' | 'rejected'
  knowledgeCandidate?: boolean
  knowledgeCandidateScore?: number
  knowledgeCandidateReasons?: string[]
}

export type CommunityReply = {
  id: string
  postId: string
  authorName: string
  authorRole?: 'student' | 'teacher'
  content: string
  status: CommunityStatus
  likeCount: number
  createdAt: string
  updatedAt?: string
}

export type CommunityKnowledgeGenerateResult = {
  knowledgeId: string
  status: CommunityStatus
  summary: string
}

export type CommunityKnowledge = {
  id: string
  postId: string
  title: string
  summary: string
  content: string
  category: string
  keywords: string[]
  confidence: number
  status: CommunityStatus
  sourceType: 'community_post' | 'community_summary'
  createdAt: string
  updatedAt: string
}

export type CommunityMeta = {
  categories: CommunityCategoryOption[]
  hotTags: string[]
}

export type CommunityPostsResponse = {
  list: CommunityPost[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export type CommunityPostDetailResponse = {
  post: CommunityPost
  replies: CommunityReply[]
}

export type CommunityReviewListResponse<T> = {
  list: T[]
}
