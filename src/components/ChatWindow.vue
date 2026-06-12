<template>
  <!-- 该组件只负责聊天窗口滚动和列表组织，单条消息由 MessageItem 渲染。 -->
  <div ref="containerRef" class="chat-window">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      等待输入校园事务
    </div>

    <MessageItem
      v-for="msg in messages"
      :key="msg.id || `${msg.role}-${msg.createdAt}`"
      :message="msg"
      @open-community-post="emit('openCommunityPost', $event)"
    />

    <div v-if="loading" class="typing-row">
      <div class="typing-avatar">AI</div>
      <div class="typing-bubble">
        <span>正在为您生成回复...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import MessageItem from './MessageItem.vue'
import type { Message } from '@/types/agent'

const props = defineProps<{
  messages: Message[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

// 保存容器引用，便于在新消息进入后自动滚动到底部。
const containerRef = ref<HTMLDivElement | null>(null)

watch(
  () => [props.messages.length, props.loading],
  async () => {
    // 先等待 DOM 更新完成，再读取 scrollHeight 计算滚动位置。
    await nextTick()
    const el = containerRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  },
  { immediate: true },
)
</script>

<style scoped>
.chat-window {
  height: 100%;
  overflow: auto;
  padding: 8px 6px 12px;
  background: transparent;
  scroll-behavior: smooth;
}

.chat-window::-webkit-scrollbar {
  width: 6px;
}

.chat-window::-webkit-scrollbar-thumb {
  background: rgba(143, 156, 255, 0.34);
  border-radius: 999px;
}

.empty-state {
  margin: 18px auto 20px;
  max-width: min(620px, 92%);
  padding: 18px 20px;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(143, 156, 255, 0.16), rgba(103, 232, 249, 0.08)),
    rgba(255, 255, 255, 0.06);
  color: rgba(238, 244, 255, 0.86);
  border: 1px solid rgba(188, 205, 255, 0.16);
  font-size: 15px;
  font-weight: 750;
  text-align: center;
}

.typing-row {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 10px;
  align-items: center;
  margin: 8px 0 10px;
}

.typing-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 12px;
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.32), rgba(103, 232, 249, 0.14));
  border: 1px solid rgba(188, 205, 255, 0.2);
  box-shadow: 0 10px 24px rgba(30, 42, 110, 0.28);
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.09);
  color: rgba(247, 251, 255, 0.9);
  border: 1px solid rgba(188, 205, 255, 0.16);
  font-weight: 700;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .chat-window {
    scroll-behavior: auto;
  }
}
</style>
