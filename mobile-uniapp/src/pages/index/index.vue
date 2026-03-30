<template>
  <view class="page">
    <view class="hero-card">
      <view class="hero-badge">AI</view>
      <view class="hero-title">数智校答</view>
      <view class="hero-subtitle">移动端智能问答</view>
    </view>

    <view class="assistant-card">
      <view class="assistant-title">问答助手</view>
      <view class="assistant-copy">
        你可以直接查询奖学金、教务、转专业、宿舍服务等校园事务。
      </view>
    </view>

    <scroll-view class="message-list" scroll-y>
      <view
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        class="message-item"
        :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
      >
        <text class="message-text">{{ message.content }}</text>
      </view>
    </scroll-view>

    <view class="composer">
      <textarea
        v-model="draft"
        class="composer-input"
        maxlength="500"
        placeholder="请输入你的问题"
      />
      <button class="send-btn" :disabled="loading" @tap="submitQuestion">
        {{ loading ? '发送中' : '发送' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { sendChat } from '@/api/chat'
import type { MobileChatMessage } from '@/types/chat'

const loading = ref(false)
const draft = ref('')
const messages = ref<MobileChatMessage[]>([
  {
    role: 'assistant',
    content: '你好，我是数智校答助手。你可以直接输入想咨询的事项。',
  },
])

const submitQuestion = async () => {
  const content = draft.value.trim()
  if (!content || loading.value) return

  messages.value.push({ role: 'user', content })
  draft.value = ''
  loading.value = true

  try {
    const response = await sendChat(messages.value)
    messages.value.push({
      role: 'assistant',
      content: response.content || '当前没有返回内容。',
      sources: response.sources || [],
    })
  } catch (error: any) {
    messages.value.push({
      role: 'assistant',
      content: `请求失败：${error?.message || '请稍后重试'}`,
      status: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.hero-card,
.assistant-card,
.composer,
.message-list {
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(58, 145, 74, 0.15);
  box-shadow: 0 12rpx 32rpx rgba(33, 109, 46, 0.08);
}

.hero-card {
  padding: 28rpx;
}

.hero-badge {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #185d2b;
  font-size: 28rpx;
  font-weight: 700;
  background: linear-gradient(135deg, #effde8 0%, #cdefbe 100%);
}

.hero-title {
  margin-top: 18rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: #12391d;
}

.hero-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4f7057;
}

.assistant-card {
  margin-top: 20rpx;
  padding: 24rpx;
}

.assistant-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #174025;
}

.assistant-copy {
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.6;
  color: #45634c;
}

.message-list {
  height: 760rpx;
  margin-top: 20rpx;
  padding: 20rpx;
}

.message-item {
  max-width: 86%;
  margin-bottom: 18rpx;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
}

.message-item.is-assistant {
  background: rgba(255, 255, 255, 0.96);
}

.message-item.is-user {
  margin-left: auto;
  background: rgba(229, 252, 222, 0.95);
}

.message-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: #173220;
}

.composer {
  margin-top: 20rpx;
  padding: 18rpx;
}

.composer-input {
  width: 100%;
  min-height: 180rpx;
  font-size: 28rpx;
}

.send-btn {
  margin-top: 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #73dd6c 0%, #47b85f 100%);
  color: #fff;
  font-size: 28rpx;
}
</style>
