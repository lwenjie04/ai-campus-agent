<template>
  <!-- 输入区只负责收集文本并向父组件发出 send 事件，不直接处理请求。 -->
  <div class="input-box">
    <el-input
      ref="inputRef"
      v-model="text"
      :disabled="loading"
      placeholder="描述你要查询或办理的校园事项"
      @keyup.enter="send"
    />
    <el-button
      class="send-btn"
      :loading="loading"
      :disabled="loading"
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

// 首页“开始提问”进入 /chat/new 时由父组件调用，只聚焦不发送。
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

// 发送前做两层保护：
// 1. 去掉首尾空白，避免空消息进入会话
// 2. loading 时禁止重复发送，避免并发请求打乱消息顺序
const send = () => {
  const content = text.value.trim()
  if (!content || props.loading) return

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
  align-items: stretch;
}

:deep(.el-input__wrapper) {
  min-height: 3.15rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding-inline: 0.9rem;
  background: var(--white);
  box-shadow: none;
}

:deep(.el-input__inner) {
  min-width: 0;
  color: var(--ink);
  font-size: 0.9rem;
}

:deep(.el-input__inner::placeholder) {
  color: var(--faint);
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

.send-btn svg {
  width: 1.35rem;
  height: 1.35rem;
}
</style>
