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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { appConfig } from '@/config/app'
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
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${appConfig.apiBaseUrl}${url}`
  return url
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
}>()
</script>

<style scoped>
.message-row {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 16px 0;
}

.message-row.is-user {
  flex-direction: row-reverse;
}

.bubble-wrap {
  min-width: 0;
  max-width: min(calc(100% - 52px), 720px);
}

.message-row.is-user .bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-meta {
  min-height: 16px;
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 4px 5px;
  color: #50705a;
  font-size: 11px;
  line-height: 1;
}

.message-row.is-user .message-meta {
  justify-content: flex-end;
}

.sender-name {
  color: #245d38;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.message-time {
  color: rgba(54, 91, 64, 0.56);
  font-variant-numeric: tabular-nums;
}

.bubble {
  display: inline-flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  box-sizing: border-box;
  color: #17291d;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.65;
  background: rgba(255, 255, 252, 0.92);
  border: 1px solid rgba(72, 139, 83, 0.16);
  border-radius: 7px 18px 18px;
  box-shadow:
    0 9px 24px rgba(36, 92, 48, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(9px);
}

.message-row.is-user .bubble {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
  border-radius: 18px 7px 18px 18px;
  background: linear-gradient(135deg, #195d38 0%, #236f42 58%, #2b7d48 100%);
  box-shadow:
    0 10px 22px rgba(29, 111, 65, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.typing-dots {
  min-width: 40px;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
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

.typing-cursor {
  width: 2px;
  height: 1.15em;
  border-radius: 999px;
  background: #3daa61;
  display: inline-block;
  align-self: center;
  animation: typing-blink 0.9s steps(1, end) infinite;
}

.sources {
  width: 100%;
  max-width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  box-sizing: border-box;
  border-radius: 15px;
  color: #294c32;
  background: rgba(247, 252, 243, 0.88);
  border: 1px solid rgba(67, 133, 79, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  max-height: 190px;
  overflow: auto;
}

.sources-title {
  font-size: 12px;
  color: #235c31;
  font-weight: 700;
  margin-bottom: 4px;
}

.source-item + .source-item {
  margin-top: 8px;
}

.source-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.source-link {
  color: #146c43;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.2;
  border: 1px solid rgba(46, 113, 53, 0.14);
  background: rgba(255, 255, 255, 0.75);
  color: #2c5f38;
  white-space: nowrap;
}

.confidence-chip {
  color: #1e6f47;
}

.source-snippet {
  font-size: 12px;
  color: #35533c;
  line-height: 1.35;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.source-link-row {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.source-note {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 244, 214, 0.8);
  border: 1px solid rgba(214, 171, 58, 0.2);
  color: #8a5a08;
  font-size: 11px;
  line-height: 1.4;
}

.source-label {
  font-size: 11px;
  color: #54715b;
  font-weight: 600;
}

.inline-link,
.attachment-link {
  color: #0f6e44;
  text-decoration: none;
  border-bottom: 1px dashed rgba(15, 110, 68, 0.35);
}

.inline-link--button {
  padding: 0;
  background: transparent;
  border-top: 0;
  border-left: 0;
  border-right: 0;
  border-bottom-style: dashed;
  font: inherit;
  cursor: pointer;
}

.inline-link:hover,
.attachment-link:hover,
.inline-link--button:hover {
  border-bottom-style: solid;
}

.inline-link {
  font-size: 12px;
}

.source-attachments {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attachment-link {
  width: fit-content;
  max-width: 100%;
  font-size: 12px;
  word-break: break-all;
}

.error-tip {
  margin-top: 6px;
  padding: 5px 8px;
  border: 1px solid rgba(187, 47, 47, 0.12);
  border-radius: 9px;
  background: rgba(255, 241, 241, 0.78);
  font-size: 12px;
  color: #bb2f2f;
}

.error-code {
  margin-left: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@keyframes typing-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.18;
  }
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.42;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@media (max-width: 680px) {
  .message-row {
    gap: 8px;
    margin: 13px 0;
  }

  .bubble-wrap {
    max-width: min(calc(100% - 44px), 100%);
  }

  .message-meta {
    margin-bottom: 4px;
  }

  .bubble {
    min-height: 42px;
    padding: 9px 12px;
    border-radius: 6px 16px 16px;
    font-size: 13px;
    line-height: 1.6;
  }

  .message-row.is-user .bubble {
    border-radius: 16px 6px 16px 16px;
  }

  .source-head {
    flex-direction: column;
    gap: 4px;
  }

  .source-meta {
    justify-content: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-cursor,
  .typing-dots span {
    animation: none;
  }
}
</style>
