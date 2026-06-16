<template>
  <!-- 单条消息由头像、消息气泡和可选的来源信息组成。 -->
  <div class="message-row" :class="`is-${message.role}`">
    <div v-if="message.role === 'assistant'" class="avatar">AI</div>

    <div class="bubble-wrap">
      <!-- 用户消息和助手消息复用同一个气泡结构，通过 role 决定额外装饰。 -->
      <div class="bubble">
        <span class="content">{{ formatMessageContent(message.content) }}</span>
        <span v-if="message.role === 'assistant' && message.status === 'pending'" class="typing-cursor" />
      </div>

      <!-- 只有 assistant 消息才会展示来源，来源展示由 SourcePanel 组件统一处理。 -->
      <SourcePanel
        v-if="message.role === 'assistant'"
        :sources="message.sources || []"
        @open-community-post="emit('openCommunityPost', $event)"
      />

      <div v-if="message.role === 'assistant' && message.status === 'pending'" class="pending-tip">
        正在生成回复...
      </div>

      <div v-if="message.status === 'error'" class="error-tip">
        发送异常，请稍后重试
        <span v-if="message.errorCode" class="error-code">({{ message.errorCode }})</span>
      </div>
    </div>

    <div v-if="message.role === 'user'" class="avatar user-avatar">我</div>
  </div>
</template>

<script setup lang="ts">
import SourcePanel from './SourcePanel.vue'
import type { Message } from '@/types/agent'

// 聊天区目前按纯文本展示，不渲染 Markdown。
// 这里把模型偶尔输出的强调符号做一次轻量清洗，避免页面出现 **标题** 这类星号噪声。
const formatMessageContent = (content: string) =>
  String(content || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')

// 当前组件：
// - 使用 SourcePanel 处理来源展示
// - MessageItem 只关心'如何展示一条消息'，消息列表的遍历由父组件负责。
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
  grid-template-columns: 36px 1fr 36px;
  gap: 12px;
  align-items: center;
  margin: 12px 0;
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
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: #eef4ff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(188, 205, 255, 0.2);
  box-shadow: 0 10px 24px rgba(30, 42, 110, 0.28);
}

.user-avatar {
  background: linear-gradient(135deg, rgba(84, 214, 138, 0.26), rgba(143, 156, 255, 0.16));
}

.bubble-wrap {
  max-width: 100%;
}

.bubble {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  max-width: min(100%, 760px);
  min-height: 44px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(247, 251, 255, 0.94);
  border: 1px solid rgba(188, 205, 255, 0.16);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
  font-weight: 650;
}

.message-row.is-user .bubble {
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.3), rgba(103, 232, 249, 0.14));
  border-color: rgba(143, 156, 255, 0.36);
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
  background: #67e8f9;
  display: inline-block;
  align-self: center;
  animation: typing-blink 0.9s steps(1, end) infinite;
}


/* Source display styles moved to SourcePanel.vue */

.error-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #ff9f9f;
}

.pending-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #67e8f9;
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
    font-size: 17px;
  }

  .bubble,
  .sources {
    max-width: 100%;
  }

  .bubble {
    min-height: 42px;
    padding: 0 14px;
    border-radius: 8px;
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
