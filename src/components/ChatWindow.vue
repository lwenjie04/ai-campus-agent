<template>
  <!-- 该组件只负责聊天窗口滚动和列表组织，单条消息由 MessageItem 渲染。 -->
  <div ref="containerRef" class="chat-window">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      <ChatAvatar role="assistant" />
      <div class="empty-copy">
        <strong>从一件要办的事开始</strong>
        <span>说清你的事项和疑问，我会整理步骤并给出可核对的来源。</span>
      </div>
    </div>

    <MessageItem
      v-for="msg in messages"
      :key="msg.id || `${msg.role}-${msg.createdAt}`"
      :message="msg"
      @open-community-post="emit('openCommunityPost', $event)"
    />

    <!-- 正常请求由 pending 消息展示加载态；此处只处理没有占位消息的兜底场景。 -->
    <div v-if="showStandaloneTyping" class="typing-row">
      <ChatAvatar role="assistant" active />
      <div class="typing-bubble">
        <span>正在整理答案</span>
        <span class="typing-dots" role="status" aria-label="校园智能服务台正在整理回答" data-testid="loading-indicator">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ChatAvatar from './ChatAvatar.vue'
import MessageItem from './MessageItem.vue'
import type { Message } from '@/types/agent'

const props = defineProps<{
  messages: Message[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

// store 通常会先插入 pending assistant 消息；仅在它缺失时显示兜底加载行，避免双重提示。
const showStandaloneTyping = computed(
  () => props.loading && !props.messages.some((message) => message.role === 'assistant' && message.status === 'pending'),
)

// 保存容器引用，便于在新消息进入后自动滚动到底部。
const containerRef = ref<HTMLDivElement | null>(null)

watch(
  () => [props.messages.length, props.loading, props.messages[props.messages.length - 1]?.content],
  async () => {
    const currentEl = containerRef.value
    const shouldFollowLatest =
      !currentEl || currentEl.scrollHeight - currentEl.scrollTop - currentEl.clientHeight <= 80

    // 先等待 DOM 更新完成，再读取 scrollHeight 计算滚动位置。
    await nextTick()
    const el = containerRef.value
    if (!el || !shouldFollowLatest) return
    el.scrollTop = el.scrollHeight
  },
  { immediate: true },
)
</script>

<style scoped>
.chat-window {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px 12px 18px;
  box-sizing: border-box;
  background: transparent;
  scrollbar-gutter: stable;
}

.chat-window::-webkit-scrollbar {
  width: 6px;
}

.chat-window::-webkit-scrollbar-thumb {
  background: rgba(46, 113, 53, 0.2);
  border-radius: 999px;
}

.empty-state {
  width: min(100%, 440px);
  margin: 14px auto;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(75, 142, 84, 0.15);
  border-radius: 18px;
  color: #24432a;
  background: rgba(255, 255, 252, 0.82);
  box-shadow: 0 10px 26px rgba(38, 94, 48, 0.07);
}

.empty-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.empty-copy strong {
  color: #1d5b35;
  font-size: 14px;
}

.empty-copy span {
  color: #58705d;
  font-size: 12px;
  line-height: 1.5;
}

.typing-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 16px 0;
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 9px 14px;
  box-sizing: border-box;
  border: 1px solid rgba(72, 139, 83, 0.16);
  border-radius: 7px 18px 18px;
  color: #315c3b;
  background: rgba(255, 255, 252, 0.92);
  box-shadow: 0 9px 24px rgba(36, 92, 48, 0.08);
  font-size: 13px;
  font-weight: 600;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.typing-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3daa61;
  animation: typing-bounce 1.15s ease-in-out infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.42;
  }
  30% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

@media (max-width: 680px) {
  .chat-window {
    padding: 10px 8px 16px;
    scrollbar-gutter: auto;
  }

  .empty-state {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-dots span {
    animation: none;
  }
}
</style>
