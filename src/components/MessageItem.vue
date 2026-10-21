<template>
  <!-- 单条消息：用户右侧气泡；校答左侧阅读式回答。来源收进来源栏/抽屉。 -->
  <div class="message-row" :class="`is-${message.role}`" :data-role="message.role" data-testid="message-row">
    <div class="bubble-wrap">
      <div v-if="isAssistant" class="answer-meta">
        <span class="answer-brand">
          <img src="/icons/brand-messages-square.svg" alt="" aria-hidden="true" />
          校答
        </span>
        <span v-if="hasSources" class="answer-tag">{{ sourceTag }}</span>
        <time
          v-if="formatMessageTime(message.createdAt)"
          class="answer-time"
          :datetime="formatMessageDateTime(message.createdAt)"
        >
          {{ formatMessageTime(message.createdAt) }}
        </time>
      </div>

      <!-- 空的 pending 消息显示单一加载动画；流式文本到达后切换为光标。 -->
      <div class="bubble" :aria-busy="message.status === 'pending'" data-testid="message-bubble">
        <span
          v-if="isAssistant && message.status === 'pending' && !formatMessageContent(message.content)"
          class="typing-dots"
          role="status"
          aria-label="校园智能服务台正在整理回答"
          data-testid="loading-indicator"
        >
          <span />
          <span />
          <span />
        </span>
        <template v-else>
          <span class="content">{{ formatMessageContent(message.content) }}</span>
          <span v-if="isAssistant && message.status === 'pending'" class="typing-cursor" />
        </template>
      </div>

      <time
        v-if="isUser && formatMessageTime(message.createdAt)"
        class="user-time"
        :datetime="formatMessageDateTime(message.createdAt)"
      >
        {{ formatMessageTime(message.createdAt) }}
      </time>

      <div v-if="isAssistant && !hasError" class="message-actions">
        <button type="button" class="action-btn" :aria-label="copied ? '已复制' : '复制回答'" @click="copyContent">
          <img src="/icons/copy.svg" alt="" aria-hidden="true" />
          {{ copied ? '已复制' : '复制' }}
        </button>
        <button type="button" class="action-btn" aria-label="朗读回答" @click="emit('narrate', message.content)">
          <img src="/icons/volume-2.svg" alt="" aria-hidden="true" />
          朗读
        </button>
        <button
          v-if="hasSources"
          type="button"
          class="source-hint"
          :aria-label="`查看 ${message.sources?.length || 0} 份官方来源`"
          @click="emit('openSources', message.id)"
        >
          查看 {{ message.sources?.length || 0 }} 份官方来源
          <img src="/icons/chevron-right.svg" alt="" aria-hidden="true" />
        </button>
      </div>

      <div v-if="message.status === 'error'" class="error-tip">
        发送异常，请稍后重试
        <span v-if="message.errorCode" class="error-code">({{ message.errorCode }})</span>
        <button v-if="message.id" type="button" class="retry-btn" @click="emit('retry', message.id)">重试</button>
      </div>

      <div v-else-if="message.status === 'interrupted'" class="interrupted-tip" role="status">
        回答已中断，已保留生成的内容
        <button v-if="message.id" type="button" class="retry-btn" @click="emit('retry', message.id)">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Message } from '@/types/agent'

// 聊天区按纯文本展示，不渲染 Markdown；这里清掉模型偶尔输出的强调符号。
const formatMessageContent = (content: string) =>
  String(content || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')

const messageTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const resolveMessageDate = (createdAt?: number) => {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return date
}

const formatMessageTime = (createdAt?: number) => {
  const date = resolveMessageDate(createdAt)
  return date ? messageTimeFormatter.format(date) : ''
}

const formatMessageDateTime = (createdAt?: number) => {
  const date = resolveMessageDate(createdAt)
  return date ? date.toISOString() : undefined
}

const props = defineProps<{
  message: Message
}>()

const emit = defineEmits<{
  (e: 'retry', messageId: string): void
  (e: 'narrate', content: string): void
  (e: 'openSources', messageId?: string): void
}>()

const isAssistant = computed(() => props.message.role === 'assistant')
const isUser = computed(() => props.message.role === 'user')
const hasError = computed(() => props.message.status === 'error')
const sources = computed(() => props.message.sources ?? [])
const hasSources = computed(() => sources.value.length > 0)
const sourceTag = computed(() =>
  sources.value.some((source) => source.type === 'official') ? '官方来源' : '附来源',
)

const copied = ref(false)
let copiedTimer: number | undefined

const copyContent = async () => {
  const text = formatMessageContent(props.message.content)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = false
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(copiedTimer)
})
</script>

<style scoped>
.message-row {
  width: 100%;
  display: flex;
  margin: 1.6rem 0;
  animation: message-in 320ms var(--ease-out) both;
}

.message-row.is-user {
  justify-content: flex-end;
}

.bubble-wrap {
  min-width: 0;
  width: 100%;
}

.is-user .bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: min(80%, 34rem);
  margin-left: auto;
}

.answer-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.answer-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
}

.answer-brand img {
  width: 1rem;
  height: 1rem;
}

.answer-tag {
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.7rem;
}

.answer-time,
.user-time {
  color: var(--faint);
  font-size: 0.72rem;
}

.answer-time {
  margin-left: auto;
}

.user-time {
  margin-top: 0.35rem;
}

.bubble {
  color: var(--text);
  font-size: 1.0625rem;
  line-height: 1.75;
}

.is-user .bubble {
  border-radius: 20px;
  padding: 0.7rem 1rem;
  background: var(--silver);
  font-size: 0.95rem;
  line-height: 1.7;
}

.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.is-assistant .bubble {
  font-weight: 400;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--muted);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  padding: 0;
  color: var(--muted);
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
}

.action-btn:hover {
  color: var(--brand);
}

.action-btn img {
  width: 0.95rem;
  height: 0.95rem;
  opacity: 0.8;
}

.source-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: auto;
  border: 0;
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-pill);
  color: var(--brand);
  background: var(--tint);
  font-size: 0.78rem;
  cursor: pointer;
}

.source-hint img {
  width: 0.85rem;
  height: 0.85rem;
}

.typing-dots {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.4rem 0;
}

.typing-dots span {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--brand);
  animation: chat-dot 1.1s ease-in-out infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 120ms; }
.typing-dots span:nth-child(3) { animation-delay: 240ms; }

.typing-cursor {
  display: inline-block;
  width: 0.5rem;
  height: 1.1rem;
  margin-left: 0.15rem;
  vertical-align: -0.15rem;
  background: var(--brand);
  animation: cursor-blink 1s steps(2, start) infinite;
}

.error-tip,
.interrupted-tip {
  margin-top: 0.75rem;
  border: 1px solid var(--soft);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.75rem;
  color: var(--text);
  background: var(--silver);
  font-size: 0.8rem;
}

.error-code,
.retry-btn {
  color: var(--muted);
}

.retry-btn {
  margin-left: 0.6rem;
  border: 0;
  padding: 0;
  color: var(--brand);
  background: transparent;
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
}

@keyframes chat-dot {
  50% { opacity: 0.35; transform: translateY(-0.22rem); }
}

@keyframes cursor-blink {
  to { visibility: hidden; }
}

@keyframes message-in {
  from { opacity: 0; transform: translateY(0.4rem); }
  to { opacity: 1; transform: none; }
}

@media (min-width: 48rem) {
  .source-hint {
    display: none;
  }
}
</style>
