<template>
  <div v-if="open" class="history-backdrop" @click.self="emit('close')">
    <aside class="history-drawer" role="dialog" aria-modal="true" aria-label="历史对话">
      <header class="history-head">
        <div>
          <span class="history-kicker">HISTORY</span>
          <h2>历史对话</h2>
        </div>
        <button type="button" class="history-close" @click="emit('close')">关闭</button>
      </header>

      <button type="button" class="history-new" @click="emit('new')">+ 新建对话</button>

      <p v-if="storageMessage" class="history-warning" role="status">{{ storageMessage }}</p>
      <p v-if="!summaries.length" class="history-empty">还没有历史对话</p>

      <ul v-else class="history-list">
        <li
          v-for="item in summaries"
          :key="item.conversationId"
          class="history-item"
          :class="{ 'history-item--active': item.conversationId === activeId }"
          :data-conversation-id="item.conversationId"
        >
          <button type="button" class="history-entry" @click="emit('open', item.conversationId)">
            <strong>{{ item.title || '未命名对话' }}</strong>
            <span>{{ formatTime(item.updatedAt) }} · {{ item.messageCount }} 条消息</span>
          </button>
          <button
            type="button"
            class="history-remove"
            aria-label="删除这条对话"
            @click.stop="emit('remove', item.conversationId)"
          >
            删除
          </button>
        </li>
      </ul>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { ConversationSummary } from '@/types/conversation'

defineProps<{
  open: boolean
  summaries: ConversationSummary[]
  activeId?: string
  storageMessage?: string
}>()

const emit = defineEmits<{
  close: []
  new: []
  open: [conversationId: string]
  remove: [conversationId: string]
}>()

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<style scoped>
.history-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  justify-content: flex-end;
  background: rgba(17, 24, 29, 0.34);
}

.history-drawer {
  width: min(23rem, 92vw);
  height: 100%;
  overflow-y: auto;
  border-left: 1px solid var(--line-strong);
  padding: 1rem;
  background: var(--paper-raised);
  box-shadow: var(--shadow-lg);
}

.history-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.history-kicker {
  color: var(--teal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.history-head h2 {
  margin: 0.15rem 0 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.history-close,
.history-remove {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.55rem;
  color: var(--ink-soft);
  background: var(--paper);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}

.history-new {
  width: 100%;
  margin-bottom: 0.8rem;
  border: 1px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 0.6rem;
  color: var(--white);
  background: var(--ink);
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.history-warning {
  margin: 0 0 0.65rem;
  border: 1px dashed var(--signal);
  padding: 0.5rem 0.6rem;
  color: #a82c19;
  background: #fff0ec;
  font-size: 0.76rem;
  line-height: 1.5;
}

.history-empty {
  margin: 1.25rem 0;
  color: var(--ink-soft);
  font-size: 0.82rem;
  text-align: center;
}

.history-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.35rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 0.35rem;
  background: var(--white);
}

.history-item--active {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink);
}

.history-entry {
  min-width: 0;
  border: 0;
  padding: 0.35rem;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.history-entry strong {
  display: block;
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-entry span {
  display: block;
  margin-top: 0.2rem;
  color: var(--ink-soft);
  font-size: 0.7rem;
}

.history-remove {
  align-self: center;
  border-color: transparent;
  background: transparent;
  font-size: 0.68rem;
}

.history-remove:hover {
  color: var(--signal-dark);
}
</style>
