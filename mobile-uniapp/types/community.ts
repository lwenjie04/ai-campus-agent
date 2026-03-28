export interface MobileCommunityPost {
  id: string
  title: string
  content: string
  authorName: string
  category: string
  tags: string[]
  replyCount: number
  likeCount: number
  viewCount: number
  createdAt: string
}

export interface MobileCommunityReply {
  id: string
  postId: string
  authorName: string
  content: string
  createdAt: string
}
