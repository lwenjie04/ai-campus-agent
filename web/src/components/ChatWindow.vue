<template>
  <div ref="containerRef" class="chat-window">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      <span class="empty-icon">✦</span>
      <p>输入你的问题，开始对话</p>
    </div>

    <TransitionGroup name="msg" tag="div" class="msg-list">
      <MessageItem
        v-for="msg in messages"
        :key="msg.id || `${msg.role}-${msg.createdAt}`"
        :message="msg"
        @open-community-post="emit('openCommunityPost', $event)"
      />
    </TransitionGroup>

    <Transition name="typing">
      <div v-if="loading" class="typing-row">
        <div class="typing-avatar">
          <span class="typing-dot" />
        </div>
        <div class="typing-bubble">
          <span class="typing-dots">
            <i /><i /><i />
          </span>
        </div>
      </div>
    </Transition>
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

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick()
    const el = containerRef.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  },
)
</script>

<style scoped>
.chat-window {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-2) var(--space-2) var(--space-4);
  scroll-behavior: smooth;
}

.chat-window::-webkit-scrollbar { width: 4px; }
.chat-window::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
}
.chat-window::-webkit-scrollbar-track { background: transparent; }

.msg-list {
  display: grid;
  gap: 0.125rem;
}

/* ---- Empty State ---- */
.empty-state {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: 8rem var(--space-4);
  color: var(--dark-muted);
  text-align: center;
}
.empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}
.empty-state p {
  margin: 0;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
}

/* ---- Message Transition ---- */
.msg-enter-active {
  transition: all 0.35s cubic-bezier(0.15, 1.2, 0.35, 1);
}
.msg-leave-active {
  transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
}
.msg-enter-from {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.97);
}
.msg-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

/* ---- Typing Indicator ---- */
.typing-enter-active { transition: all 0.25s ease-out; }
.typing-leave-active { transition: all 0.15s ease-in; }
.typing-enter-from,
.typing-leave-to { opacity: 0; transform: translateY(0.5rem); }

.typing-row {
  display: grid;
  grid-template-columns: 1.75rem 1fr;
  gap: var(--space-2);
  align-items: center;
  margin: 0.375rem 0;
}

.typing-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #2c2c2e;
}
.typing-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--apple-cyan);
  animation: dot-pulse 1.2s ease-out infinite;
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-lg);
  background: #1c1c1e;
}

.typing-dots {
  display: inline-flex;
  gap: 0.25rem;
}
.typing-dots i {
  display: block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: rgba(245,245,247,0.5);
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.typing-dots i:nth-child(2) { animation-delay: 0.16s; }
.typing-dots i:nth-child(3) { animation-delay: 0.32s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
@keyframes dot-pulse {
  0% { box-shadow: 0 0 0 0 rgba(90,200,250,0.5); }
  100% { box-shadow: 0 0 0 0.5rem rgba(90,200,250,0); }
}

@media (prefers-reduced-motion: reduce) {
  .msg-enter-active,
  .msg-leave-active,
  .typing-enter-active,
  .typing-leave-active { transition: none !important; }
}
</style>
