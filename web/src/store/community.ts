import { defineStore } from 'pinia'
import {
  approveCommunityPost,
  approveCommunityKnowledge,
  approveCommunityReply,
  createCommunityPost,
  createCommunityReply,
  generateCommunityKnowledge,
  getCommunityKnowledgeList,
  getCommunityKnowledgeCandidates,
  getCommunityMeta,
  getCommunityPostDetail,
  getCommunityReviewPostDetail,
  getPendingCommunityPosts,
  getPendingCommunityReplies,
  getCommunityPosts,
  rejectCommunityKnowledge,
  rejectCommunityPost,
  rejectCommunityReply,
} from '@/api/community'
import type { CommunityKnowledge, CommunityMeta, CommunityPost, CommunityReply } from '@/types/community'

// 学生社区的前端状态仓库。
// 这里集中管理帖子列表、详情、回复、筛选条件和提交状态，
// 这样社区页面和详情页都能复用同一份数据。
export const useCommunityStore = defineStore('community', {
  state: () => ({
    meta: {
      categories: [],
      hotTags: [],
    } as CommunityMeta,
    posts: [] as CommunityPost[],
    knowledgeItems: [] as CommunityKnowledge[],
    knowledgeCandidates: [] as CommunityPost[],
    pendingPosts: [] as CommunityPost[],
    pendingReplies: [] as CommunityReply[],
    currentPost: null as CommunityPost | null,
    currentReplies: [] as CommunityReply[],
    loadingList: false,
    loadingDetail: false,
    loadingReview: false,
    submitting: false,
    selectedCategory: '',
    keyword: '',
    sortBy: 'latest' as 'latest' | 'hot',
    page: 1,
    pageSize: 10,
    total: 0,
    lastError: '',
  }),

  actions: {
    async loadMeta() {
      this.meta = await getCommunityMeta()
    },

    async loadPosts() {
      this.loadingList = true
      this.lastError = ''
      try {
        const data = await getCommunityPosts({
          page: this.page,
          pageSize: this.pageSize,
          category: this.selectedCategory || undefined,
          keyword: this.keyword || undefined,
          sortBy: this.sortBy,
        })

        this.posts = data.list
        this.total = data.pagination.total
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '帖子列表加载失败'
      } finally {
        this.loadingList = false
      }
    },

    async loadPostDetail(postId: string) {
      this.loadingDetail = true
      this.lastError = ''
      try {
        const data = await getCommunityPostDetail(postId)
        this.currentPost = data.post
        this.currentReplies = data.replies
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '帖子详情加载失败'
        this.currentPost = null
        this.currentReplies = []
      } finally {
        this.loadingDetail = false
      }
    },

    async loadReviewPostDetail(postId: string) {
      this.loadingDetail = true
      this.lastError = ''
      try {
        const data = await getCommunityReviewPostDetail(postId)
        this.currentPost = data.post
        this.currentReplies = data.replies
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '管理员帖子详情加载失败'
        this.currentPost = null
        this.currentReplies = []
        throw error
      } finally {
        this.loadingDetail = false
      }
    },

    async loadPendingReviews() {
      this.loadingReview = true
      this.lastError = ''
      try {
        const [posts, replies] = await Promise.all([
          getPendingCommunityPosts(),
          getPendingCommunityReplies(),
        ])
        this.pendingPosts = posts.list
        this.pendingReplies = replies.list
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '待审核数据加载失败'
      } finally {
        this.loadingReview = false
      }
    },

    async loadKnowledgeCandidates() {
      this.loadingReview = true
      this.lastError = ''
      try {
        const data = await getCommunityKnowledgeCandidates()
        this.knowledgeCandidates = data.list
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '候选帖子加载失败'
      } finally {
        this.loadingReview = false
      }
    },

    async loadKnowledgeItems(status: 'pending' | 'approved' | 'rejected' = 'pending') {
      this.loadingReview = true
      this.lastError = ''
      try {
        const data = await getCommunityKnowledgeList(status)
        this.knowledgeItems = data.list
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '社区知识列表加载失败'
      } finally {
        this.loadingReview = false
      }
    },

    async submitPost(payload: {
      authorName: string
      authorRole?: 'student' | 'teacher'
      title: string
      content: string
      category: string
      tags?: string[]
    }) {
      this.submitting = true
      this.lastError = ''
      try {
        await createCommunityPost(payload)
        await this.loadPosts()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '发布帖子失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async submitReply(postId: string, payload: { authorName: string; authorRole?: 'student' | 'teacher'; content: string }) {
      this.submitting = true
      this.lastError = ''
      try {
        await createCommunityReply(postId, payload)
        await this.loadPostDetail(postId)
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '回复失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async buildKnowledge(postId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        const result = await generateCommunityKnowledge(postId)
        await this.loadKnowledgeCandidates()
        await this.loadKnowledgeItems()
        return result
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '生成社区知识失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async approvePost(postId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await approveCommunityPost(postId)
        await this.loadPendingReviews()
        await this.loadPosts()
        await this.loadKnowledgeCandidates()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '帖子审核失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async rejectPost(postId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await rejectCommunityPost(postId)
        await this.loadPendingReviews()
        await this.loadKnowledgeCandidates()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '帖子拒绝失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async approveReply(replyId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await approveCommunityReply(replyId)
        await this.loadPendingReviews()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '回复审核失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async rejectReply(replyId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await rejectCommunityReply(replyId)
        await this.loadPendingReviews()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '回复拒绝失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async approveKnowledge(knowledgeId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await approveCommunityKnowledge(knowledgeId)
        await this.loadKnowledgeItems()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '社区知识审核失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    async rejectKnowledge(knowledgeId: string) {
      this.submitting = true
      this.lastError = ''
      try {
        await rejectCommunityKnowledge(knowledgeId)
        await this.loadKnowledgeItems()
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '社区知识拒绝失败'
        throw error
      } finally {
        this.submitting = false
      }
    },

    setCategory(category: string) {
      this.selectedCategory = category
      this.page = 1
    },

    setKeyword(keyword: string) {
      this.keyword = keyword
      this.page = 1
    },

    setSortBy(sortBy: 'latest' | 'hot') {
      this.sortBy = sortBy
      this.page = 1
    },

    clearCurrentPost() {
      this.currentPost = null
      this.currentReplies = []
    },
  },
})
