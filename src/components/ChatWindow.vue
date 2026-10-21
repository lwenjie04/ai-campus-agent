<template>
  <!-- 聊天窗口只负责滚动、空态和消息列表；单条消息由 MessageItem 渲染。 -->
  <div ref="containerRef" class="chat-window">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      <span class="empty-mark" aria-hidden="true">
        <img src="/icons/brand-messages-square.svg" alt="" />
      </span>
      <strong class="empty-title">从一个要办的事开始</strong>
      <p class="empty-copy">说清你的事项和疑问，我会整理步骤并给出可核对的来源。</p>
    </div>

    <MessageItem
      v-for="msg in messages"
      :key="msg.id || `${msg.role}-${msg.createdAt}`"
      :message="msg"
      @narrate="emit('narrate', $event)"
      @open-sources="emit('openSources', $event)"
      @retry="emit('retry', $event)"
    />

    <!-- 正常请求由 pending 消息展示加载态；此处只处理没有占位消息的兜底场景。 -->
    <div v-if="showStandaloneTyping" class="typing-row">
      <span class="typing-bubble">
        <span>正在整理答案</span>
        <span class="typing-dots" role="status" aria-label="校园智能服务台正在整理回答" data-testid="loading-indicator">
          <span />
          <span />
          <span />
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MessageItem from './MessageItem.vue'
import type { Message } from '@/types/agent'

const props = defineProps<{
  messages: Message[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry', messageId: string): void
  (e: 'narrate', content: string): void
  (e: 'openSources', messageId?: string): void
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
      !currentEl || currentEl.scrollHeight - currentEl.scrollTop - currentEl.clientHeight <= 120

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
  padding: 1.5rem 0 2rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 4rem 1rem;
  text-align: center;
}

.empty-mark {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--tint);
}

.empty-mark img {
  width: 1.5rem;
  height: 1.5rem;
}

.empty-title {
  color: var(--text);
  font-size: 1.35rem;
  font-weight: 600;
}

.empty-copy {
  max-width: 28rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.7;
}

.typing-row {
  display: flex;
  margin: 1rem 0;
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: var(--radius-pill);
  padding: 0.5rem 0.9rem;
  color: var(--muted);
  background: var(--silver);
  font-size: 0.82rem;
}

.typing-dots {
  display: inline-flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--brand);
  animation: chat-dot 1.1s ease-in-out infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 120ms; }
.typing-dots span:nth-child(3) { animation-delay: 240ms; }

@keyframes chat-dot {
  50% { opacity: 0.35; transform: translateY(-0.25rem); }
}
</style>
