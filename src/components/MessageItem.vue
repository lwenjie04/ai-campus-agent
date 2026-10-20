<template>
  <!-- 单条消息由品牌化头像、身份信息、消息气泡和可选来源组成。 -->
  <div class="message-row" :class="`is-${message.role}`" :data-role="message.role" data-testid="message-row">
    <ChatAvatar
      class="message-avatar"
      :role="message.role === 'user' ? 'user' : 'assistant'"
      :active="message.role === 'assistant' && message.status === 'pending'"
      :data-role="message.role"
      data-testid="message-avatar"
    />

    <div class="bubble-wrap">
      <div class="message-meta">
        <span class="sender-name">{{ message.role === 'user' ? '你' : '智能服务台' }}</span>
        <time v-if="formatMessageTime(message.createdAt)" class="message-time" :datetime="formatMessageDateTime(message.createdAt)">
          {{ formatMessageTime(message.createdAt) }}
        </time>
      </div>

      <!-- 空的 pending 消息显示单一加载动画；流式文本到达后切换为光标。 -->
      <div class="bubble" :aria-busy="message.status === 'pending'" data-testid="message-bubble">
        <span
          v-if="message.role === 'assistant' && message.status === 'pending' && !formatMessageContent(message.content)"
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
          <span v-if="message.role === 'assistant' && message.status === 'pending'" class="typing-cursor" />
        </template>
      </div>

      <!-- 只有 assistant 消息才会展示来源，因为来源来自后端 RAG 检索结果。 -->
      <div
        v-if="message.role === 'assistant' && Array.isArray(message.sources) && message.sources.length > 0"
        class="sources"
      >
        <div class="sources-title">信息依据</div>
        <div
          v-for="(source, index) in message.sources"
          :key="`${source.title || 'src'}-${index}`"
          class="source-item"
        >
          <!-- 标题行展示来源名称，以及类型/可信度这些摘要标签。 -->
          <div class="source-head">
            <a
              v-if="source.url"
              class="source-link"
              :href="resolveSourceHref(source.url)"
              target="_blank"
              rel="noreferrer"
            >
              {{ source.title || `来源 ${index + 1}` }}
            </a>
            <span v-else class="source-link">{{ source.title || `来源 ${index + 1}` }}</span>

            <div class="source-meta">
              <span v-if="source.type" class="meta-chip type-chip">{{ getSourceTypeLabel(source.type) }}</span>
              <span v-if="typeof source.confidence === 'number'" class="meta-chip confidence-chip">
                可信度 {{ Math.round(source.confidence * 100) }}%
              </span>
            </div>
          </div>

          <!-- 主链接可能是正文链接，也可能直接是文件下载链接。 -->
          <div v-if="source.url" class="source-link-row">
            <span class="source-label">{{ getPrimaryLinkKindLabel(source.url) }}</span>
            <a class="inline-link" :href="resolveSourceHref(source.url)" target="_blank" rel="noreferrer">
              {{ getPrimaryLinkActionLabel(source.url) }}
            </a>
          </div>

          <div v-else-if="source.postId" class="source-link-row">
            <span class="source-label">来源帖子</span>
            <button type="button" class="inline-link inline-link--button" @click="emit('openCommunityPost', source.postId)">
              查看来源帖子
            </button>
          </div>

          <!-- 社区来源需要显式提示“仅供参考”，避免和官方通知混淆。 -->
          <div v-if="source.note" class="source-note">
            {{ source.note }}
          </div>

          <!-- 附件列表单独列出，避免把多个下载链接挤在标题旁边。 -->
          <div
            v-if="Array.isArray(source.attachments) && source.attachments.length > 0"
            class="source-attachments"
          >
            <div class="source-label">附件列表</div>
            <a
              v-for="(attachment, aIndex) in source.attachments"
              :key="`${attachment.name || 'att'}-${aIndex}`"
              class="attachment-link"
              :href="resolveSourceHref(attachment.url)"
              target="_blank"
              rel="noreferrer"
            >
              {{ attachment.name || `附件 ${aIndex + 1}` }}
            </a>
          </div>

          <div v-if="source.snippet" class="source-snippet">{{ source.snippet }}</div>
        </div>
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
import { apiUrl } from '@/config/app'
import type { Message } from '@/types/agent'
import ChatAvatar from './ChatAvatar.vue'

// 聊天区目前按纯文本展示，不渲染 Markdown。
// 这里把模型偶尔输出的强调符号做一次轻量清洗，避免页面出现 **标题** 这类星号噪声。
const formatMessageContent = (content: string) =>
  String(content || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')

// 旧缓存里的 createdAt 可能不存在或不是有效数字，遇到异常值时不显示时间。
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

// 把后端返回的来源地址统一转换成浏览器可直接访问的链接。
// 这里要兼容完整链接、后端相对路径以及原样透传三种情况。
const resolveSourceHref = (url?: string) => {
  if (!url) return ''
  // 完整链接原样透传；站内相对路径统一挂到 /api 根下，且不会重复叠加 /api。
  return apiUrl(url)
}

// 判断来源链接是否更像“文件”而不是“网页正文”，用于切换展示文案。
const isFileLikeLink = (url?: string) => {
  if (!url) return false
  if (url.startsWith('/kb/download') || url.startsWith('/api/kb/download')) return true
  return /\.(pdf|doc|docx|xls|xlsx|zip|rar|7z|ppt|pptx|txt)(?:$|\?)/i.test(url)
}

// 给来源主链接生成更直观的类别标签。
const getPrimaryLinkKindLabel = (url?: string) => (isFileLikeLink(url) ? '来源文件' : '正文链接')

// 根据链接类型返回更符合用户心理预期的操作提示。
const getPrimaryLinkActionLabel = (url?: string) =>
  isFileLikeLink(url) ? '下载/打开文件' : '打开通知页面'

// 后端使用稳定的英文枚举，界面转换为更自然的中文标签。
const sourceTypeLabels: Record<string, string> = {
  official_notice: '官方通知',
  knowledge_base: '知识库',
  attachment_index: '附件资料',
  rule_match: '规则匹配',
  community_post: '社区帖子',
  community_summary: '社区经验',
}

const getSourceTypeLabel = (type?: string) => (type ? sourceTypeLabels[type] || type : '')

// 当前组件只关心“如何展示一条消息”，消息列表的遍历由父组件负责。
defineProps<{
  message: Message
}>()

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
  (e: 'retry', messageId: string): void
}>()
</script>


<style scoped>
.message-row {
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 0.65rem;
  margin: 1rem 0;
  animation: message-in 360ms var(--ease-out) both;
}

.message-row.is-user {
  flex-direction: row-reverse;
}

.bubble-wrap {
  min-width: 0;
  max-width: min(88%, 44rem);
}

.is-user .bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0.15rem 0.3rem;
}

.is-user .message-meta {
  flex-direction: row-reverse;
}

.sender-name {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.message-time {
  color: #747b78;
  font-family: var(--font-mono);
  font-size: 0.61rem;
}

.bubble {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: flex-start;
  gap: 0.15rem;
  border: 1px solid var(--line-strong);
  border-radius: 0.3rem 1rem 1rem;
  padding: 0.72rem 0.85rem;
  color: var(--ink);
  background: var(--paper-raised);
  box-shadow: 0.18rem 0.18rem 0 var(--paper-deep);
  font-size: 0.9rem;
  line-height: 1.72;
}

.is-user .bubble {
  border-radius: 1rem 0.3rem 1rem 1rem;
  color: var(--white);
  background: var(--ink);
  box-shadow: 0.18rem 0.18rem 0 var(--signal);
}

.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.typing-dots {
  min-width: 2.5rem;
  min-height: 1.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.typing-dots span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--signal);
  animation: typing-bounce 1.1s ease-in-out infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 130ms; }
.typing-dots span:nth-child(3) { animation-delay: 260ms; }

.typing-cursor {
  width: 2px;
  height: 1.1em;
  display: inline-block;
  align-self: center;
  background: var(--signal);
  animation: typing-blink 0.85s steps(1, end) infinite;
}

.sources {
  width: min(100%, 44rem);
  max-height: 16rem;
  margin-top: 0.65rem;
  overflow: auto;
  border: 1px solid var(--line-strong);
  border-left: 0.3rem solid var(--teal);
  padding: 0.75rem;
  color: var(--ink);
  background: var(--white);
  box-shadow: 0.2rem 0.2rem 0 var(--paper-deep);
  scrollbar-width: thin;
}

.sources-title {
  margin-bottom: 0.55rem;
  color: var(--teal);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.source-item {
  padding: 0.65rem 0;
  border-top: 1px dashed var(--line);
}

.source-item:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.source-head {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.source-link {
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 850;
  line-height: 1.45;
  text-decoration: none;
}

.source-link:hover {
  color: var(--signal-dark);
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.source-meta,
.source-link-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.meta-chip,
.source-label {
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.2rem 0.45rem;
  color: var(--ink-soft);
  background: var(--paper);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 750;
}

.confidence-chip {
  color: #08605e;
  background: var(--teal-soft);
}

.source-snippet {
  display: -webkit-box;
  margin-top: 0.45rem;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.78rem;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.source-link-row,
.source-attachments {
  margin-top: 0.5rem;
}

.source-attachments {
  display: grid;
  gap: 0.3rem;
}

.inline-link,
.attachment-link,
.inline-link--button {
  width: fit-content;
  max-width: 100%;
  border: 0;
  border-bottom: 1px solid currentColor;
  padding: 0;
  color: var(--teal);
  background: transparent;
  font-size: 0.76rem;
  font-weight: 750;
  text-decoration: none;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.source-note {
  margin-top: 0.5rem;
  border-left: 0.2rem solid var(--sun);
  padding: 0.5rem;
  color: #6d4a00;
  background: #fff4ce;
  font-size: 0.73rem;
  line-height: 1.5;
}

.error-tip {
  margin-top: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--signal) 55%, transparent);
  padding: 0.5rem 0.65rem;
  color: #a82c19;
  background: #fff0ec;
  font-size: 0.76rem;
}

.error-code {
  margin-left: 0.3rem;
  font-family: var(--font-mono);
}

.interrupted-tip {
  margin-top: 0.55rem;
  border: 1px dashed var(--line-strong);
  padding: 0.5rem 0.65rem;
  color: var(--ink-soft);
  background: var(--paper);
  font-size: 0.76rem;
}

.retry-btn {
  margin-left: 0.55rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  padding: 0.18rem 0.45rem;
  color: inherit;
  background: transparent;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

@keyframes message-in {
  from { opacity: 0; transform: translateY(0.5rem); }
}

@keyframes typing-blink {
  50% { opacity: 0.2; }
}

@keyframes typing-bounce {
  50% { opacity: 0.35; transform: translateY(-0.25rem); }
}

@media (max-width: 47.99rem) {
  .message-row {
    gap: 0.5rem;
  }

  .bubble-wrap {
    max-width: calc(100% - 2.9rem);
  }

  .bubble {
    max-width: 100%;
    padding: 0.65rem 0.75rem;
    font-size: 0.84rem;
  }
}

@media (min-width: 48rem) {
  .message-row {
    gap: 0.8rem;
    margin: 1.2rem 0;
  }

  .bubble-wrap {
    max-width: min(82%, 48rem);
  }

  .bubble {
    padding: 0.8rem 1rem;
    font-size: 0.94rem;
  }

  .source-head {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }

  .source-meta {
    justify-content: flex-end;
  }
}
</style>
