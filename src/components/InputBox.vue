<template>
  <!-- 输入区只负责收集文本并向父组件发出 send 事件，不直接处理请求。 -->
  <div class="input-box">
    <el-input
      ref="inputRef"
      v-model="text"
      class="composer-input"
      type="textarea"
      :autosize="{ minRows: 1, maxRows: 5 }"
      :disabled="loading"
      placeholder="继续追问校园事项…"
      @compositionstart="composing = true"
      @compositionend="composing = false"
      @keydown.enter="handleEnter"
    />
    <el-button
      class="send-btn"
      :loading="loading"
      :disabled="loading || !text.trim()"
      :aria-label="loading ? '正在发送' : '发送消息'"
      :title="loading ? '正在发送' : '发送消息'"
      @click="send"
    >
      <svg v-if="!loading" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4.2 11.5 15-7-4.35 15-3.45-5-7.2-3Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
        <path d="m11.4 14.5 7.8-10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
      </svg>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  loading: boolean
  modelValue?: string
}>()

const emit = defineEmits<{
  send: [content: string]
  'update:modelValue': [value: string]
}>()

// 用本地 ref 保存输入框内容，发送成功后立即清空；同时与父组件的草稿双向同步。
const text = ref(props.modelValue ?? '')
const inputRef = ref<{ focus: () => void } | null>(null)
// 中文输入法组合期按 Enter 只确认候选词，不发送消息。
const composing = ref(false)
// 防止 loading 状态尚未更新时的连续点击造成重复提交。
let lastSent = { content: '', at: 0 }

// 首页“开始提问”或推荐问题由父组件调用，只聚焦不发送。
defineExpose({
  focus: () => inputRef.value?.focus(),
})

watch(
  () => props.modelValue,
  (value) => {
    if (typeof value === 'string' && value !== text.value) text.value = value
  },
)

watch(text, (value) => {
  emit('update:modelValue', value)
})

// A04：IME 组合期与输入法确认键不触发发送；Shift+Enter 保留换行；空值不发送。
const handleEnter = (event: KeyboardEvent | Event) => {
  const keyboardEvent = event as KeyboardEvent
  if (composing.value || keyboardEvent.isComposing) return
  if (keyboardEvent.shiftKey) return
  keyboardEvent.preventDefault()
  send()
}

const send = () => {
  const content = text.value.trim()
  if (!content || props.loading) return

  const now = Date.now()
  if (content === lastSent.content && now - lastSent.at < 800) return
  lastSent = { content, at: now }

  // 发送逻辑交给父组件，这里只负责把用户输入抛出去。
  emit('send', content)
  text.value = ''
}
</script>

<style scoped>
.input-box {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.15rem;
  gap: 0.55rem;
  align-items: end;
}

:deep(.el-textarea__inner) {
  min-height: 3.15rem !important;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.82rem 1rem;
  color: var(--text);
  background: var(--white);
  box-shadow: none;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  line-height: 1.55;
  resize: none;
  scrollbar-width: none;
}

:deep(.el-textarea__inner::-webkit-scrollbar) {
  display: none;
}

:deep(.el-textarea__inner::placeholder) {
  color: var(--faint);
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(0, 91, 70, 0.12) !important;
}

.send-btn {
  width: 3.15rem;
  min-width: 3.15rem;
  min-height: 3.15rem;
  border: 0;
  border-radius: 50%;
  padding: 0;
  color: var(--white);
  background: var(--signal);
  box-shadow: none;
}

.send-btn:hover:not(:disabled) {
  color: var(--white);
  background: var(--signal-dark);
  box-shadow: none;
}

.send-btn:disabled {
  opacity: 0.45;
  background: var(--brand);
}

.send-btn svg {
  width: 1.35rem;
  height: 1.35rem;
}
</style>
