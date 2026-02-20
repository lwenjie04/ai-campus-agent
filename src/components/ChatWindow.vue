<template>
  <div ref="containerRef" class="chat-window">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      你好，我是广二师数字人助手，请输入你想咨询的问题。
    </div>

    <MessageItem
      v-for="msg in messages"
      :key="msg.id || `${msg.role}-${msg.createdAt}`"
      :message="msg"
    />

    <div v-if="loading" class="typing-row">
      <div class="typing-avatar">👩‍🏫</div>
      <div class="typing-bubble">
        <span class="spark">✨</span>
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

const containerRef = ref<HTMLDivElement | null>(null)

watch(
  () => [props.messages.length, props.loading],
  async () => {
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
  padding: 4px 2px 8px;
  background: transparent;
}

.chat-window::-webkit-scrollbar {
  width: 6px;
}

.chat-window::-webkit-scrollbar-thumb {
  background: rgba(46, 113, 53, 0.18);
  border-radius: 999px;
}

.empty-state {
  margin: 8px auto 12px;
  max-width: 92%;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  color: #24432a;
  font-size: 13px;
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
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 6px 12px rgba(29, 92, 42, 0.08);
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  color: #172a1b;
  font-weight: 700;
  box-shadow: 0 6px 14px rgba(28, 91, 40, 0.06);
}

.spark {
  color: #48cf52;
  font-size: 18px;
}
</style>
