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
      @retry="emit('retry', $event)"
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
  (e: 'retry', messageId: string): void
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
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1rem 0.8rem 1.5rem;
  scrollbar-color: var(--ink) transparent;
  scrollbar-width: thin;
}

.empty-state {
  min-height: 13rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.9rem;
  margin: 0.5rem;
  border: 1px dashed var(--line-strong);
  padding: 1.5rem;
  text-align: center;
  background:
    linear-gradient(135deg, rgba(0, 91, 70, 0.06), transparent 58%),
    var(--paper-raised);
}

.empty-copy {
  max-width: 28rem;
  display: grid;
  gap: 0.35rem;
}

.empty-copy strong {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 900;
}

.empty-copy span {
  color: var(--ink-soft);
  font-size: 0.88rem;
  line-height: 1.65;
}

.typing-row {
  display: flex;
  align-items: flex-end;
  gap: 0.65rem;
  margin: 1rem 0;
}

.typing-bubble {
  min-height: 2.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem 1rem 1rem;
  padding: 0.65rem 0.85rem;
  color: var(--ink-soft);
  background: var(--paper-deep);
  font-size: 0.82rem;
  font-weight: 700;
}

.typing-dots {
  display: inline-flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--signal);
  animation: chat-dot 1.1s ease-in-out infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 120ms; }
.typing-dots span:nth-child(3) { animation-delay: 240ms; }

@keyframes chat-dot {
  50% { opacity: 0.35; transform: translateY(-0.25rem); }
}

@media (min-width: 48rem) {
  .chat-window {
    padding: 1.2rem 1.25rem 1.8rem;
  }
}
</style>
