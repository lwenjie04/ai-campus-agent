<template>
  <view class="page">
    <view class="toolbar">
      <input v-model="keyword" class="search-input" placeholder="搜索帖子" />
      <button class="search-btn" @tap="loadPosts">搜索</button>
    </view>

    <view class="section-title">学生社区</view>

    <view v-if="posts.length === 0" class="empty-card">
      <text>当前还没有帖子，后续我们会把发帖和回复能力继续补齐。</text>
    </view>

    <view
      v-for="post in posts"
      :key="post.id"
      class="post-card"
      @tap="openDetail(post.id)"
    >
      <view class="post-title">{{ post.title }}</view>
      <view class="post-meta">
        <text>{{ post.authorName }}</text>
        <text>{{ post.category }}</text>
        <text>回复 {{ post.replyCount }}</text>
      </view>
      <view class="post-content">{{ post.content }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getCommunityPosts } from '@/api/community'
import type { MobileCommunityPost } from '@/types/community'

const keyword = ref('')
const posts = ref<MobileCommunityPost[]>([])

const loadPosts = async () => {
  try {
    const response = await getCommunityPosts(keyword.value.trim())
    posts.value = response.list || []
  } catch {
    posts.value = []
  }
}

const openDetail = (postId: string) => {
  uni.navigateTo({
    url: `/pages/community/detail?id=${postId}`,
  })
}

onMounted(() => {
  void loadPosts()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.toolbar {
  display: flex;
  gap: 16rpx;
}

.search-input {
  flex: 1;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(61, 145, 74, 0.16);
}

.search-btn {
  padding: 0 26rpx;
  border-radius: 999rpx;
  background: #52be67;
  color: #fff;
}

.section-title {
  margin: 24rpx 0 18rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: #173a22;
}

.empty-card,
.post-card {
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(61, 145, 74, 0.14);
  box-shadow: 0 12rpx 28rpx rgba(23, 90, 38, 0.06);
}

.post-card + .post-card {
  margin-top: 18rpx;
}

.post-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #173c22;
}

.post-meta {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #628168;
}

.post-content {
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #35543d;
}
</style>
