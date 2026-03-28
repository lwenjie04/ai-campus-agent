<template>
  <!-- 单条消息由头像、消息气泡和可选的来源信息组成。 -->
  <div class="message-row" :class="`is-${message.role}`">
    <div v-if="message.role === 'assistant'" class="avatar">👩‍🏫</div>

    <div class="bubble-wrap">
      <!-- 用户消息和助手消息复用同一个气泡结构，通过 role 决定额外装饰。 -->
      <div class="bubble">
        <span v-if="message.role === 'assistant'" class="bubble-icon">✨</span>
        <span class="content">{{ formatMessageContent(message.content) }}</span>
        <span v-if="message.role === 'assistant' && message.status === 'pending'" class="typing-cursor" />
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
              <span v-if="source.type" class="meta-chip type-chip">{{ source.type }}</span>
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

      <div v-if="message.role === 'assistant' && message.status === 'pending'" class="pending-tip">
        正在生成回复...
      </div>

      <div v-if="message.status === 'error'" class="error-tip">
        发送异常，请稍后重试
        <span v-if="message.errorCode" class="error-code">({{ message.errorCode }})</span>
      </div>
    </div>

    <div v-if="message.role === 'user'" class="avatar user-avatar">🧑‍🎓</div>
  </div>
</template>

<script setup lang="ts">
import { appConfig } from '@/config/app'
import type { Message } from '@/types/agent'

// 聊天区目前按纯文本展示，不渲染 Markdown。
// 这里把模型偶尔输出的强调符号做一次轻量清洗，避免页面出现 **标题** 这类星号噪声。
const formatMessageContent = (content: string) =>
  String(content || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')

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
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  gap: 10px;
  align-items: center;
  margin: 8px 0;
}

.message-row.is-user .bubble-wrap {
  grid-column: 2;
  justify-self: end;
}

.message-row.is-user .avatar:first-child {
  visibility: hidden;
}

.message-row.is-assistant .user-avatar {
  visibility: hidden;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 6px 12px rgba(28, 91, 40, 0.08);
}

.user-avatar {
  background: rgba(255, 255, 255, 0.88);
}

.bubble-wrap {
  max-width: 100%;
}

.bubble {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(100%, 440px);
  min-height: 46px;
  padding: 0 16px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  color: #101410;
  box-shadow: 0 8px 18px rgba(24, 86, 37, 0.08);
  font-weight: 700;
}

.message-row.is-user .bubble {
  background: rgba(255, 255, 255, 0.93);
}

.bubble-icon {
  color: #54d85c;
  font-size: 18px;
  line-height: 1;
  flex: 0 0 auto;
}

.content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.45;
}

.typing-cursor {
  width: 8px;
  height: 1.1em;
  border-radius: 4px;
  background: #54d85c;
  display: inline-block;
  align-self: center;
  animation: typing-blink 0.9s steps(1, end) infinite;
}

.sources {
  margin-top: 6px;
  max-width: min(100%, 440px);
  border-radius: 14px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(46, 113, 53, 0.12);
  max-height: 180px;
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
  margin-top: 4px;
  font-size: 12px;
  color: #bb2f2f;
}

.pending-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #2f6b3c;
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

@media (max-width: 680px) {
  .message-row {
    grid-template-columns: 36px 1fr 36px;
    gap: 8px;
    margin: 6px 0;
  }

  .avatar {
    width: 36px;
    height: 36px;
    font-size: 19px;
  }

  .bubble,
  .sources {
    max-width: 100%;
  }

  .bubble {
    min-height: 42px;
    padding: 0 14px;
    border-radius: 22px;
    font-size: 13px;
  }

  .source-head {
    flex-direction: column;
    gap: 4px;
  }

  .source-meta {
    justify-content: flex-start;
  }
}
</style>
