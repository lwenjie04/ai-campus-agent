<template>
  <view class="page">
    <view v-if="post" class="post-card">
      <view class="post-title">{{ post.title }}</view>
      <view class="post-meta">
        <text>{{ post.authorName }}</text>
        <text>{{ post.category }}</text>
      </view>
      <view class="post-content">{{ post.content }}</view>
    </view>

    <view class="section-title">回复</view>

    <view v-if="replies.length === 0" class="empty-card">
      <text>当前还没有回复。</text>
    </view>

    <view v-for="reply in replies" :key="reply.id" class="reply-card">
      <view class="reply-author">{{ reply.authorName }}</view>
      <view class="reply-content">{{ reply.content }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getCommunityPostDetail } from '@/api/community'
import type { MobileCommunityPost, MobileCommunityReply } from '@/types/community'

const post = ref<MobileCommunityPost | null>(null)
const replies = ref<MobileCommunityReply[]>([])

const loadDetail = async () => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as { options?: Record<string, string> } | undefined
  const postId = String(current?.options?.id || '')
  if (!postId) return

  try {
    const response = await getCommunityPostDetail(postId)
    post.value = response.post
    replies.value = response.replies || []
  } catch {
    post.value = null
    replies.value = []
  }
}

onMounted(() => {
  void loadDetail()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.post-card,
.reply-card,
.empty-card {
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(61, 145, 74, 0.14);
  box-shadow: 0 12rpx 28rpx rgba(23, 90, 38, 0.06);
}

.post-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #153722;
}

.post-meta {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #628168;
}

.post-content,
.reply-content {
  margin-top: 14rpx;
  font-size: 27rpx;
  line-height: 1.7;
  color: #35543d;
}

.section-title {
  margin: 24rpx 0 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #173c22;
}

.reply-card + .reply-card {
  margin-top: 16rpx;
}

.reply-author {
  font-size: 24rpx;
  font-weight: 700;
  color: #245433;
}
</style>
