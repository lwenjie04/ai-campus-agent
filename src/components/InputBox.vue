<template>
  <!-- 输入区只负责收集文本并向父组件发出 send 事件，不直接处理请求。 -->
  <div class="input-box">
    <el-input
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
import { ref } from 'vue'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

// 用本地 ref 保存输入框内容，发送成功后立即清空。
const text = ref('')

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
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  gap: 10px;
  align-items: center;
}

:deep(.el-input) {
  width: 100%;
  min-width: 0;
}

:deep(.el-input__wrapper) {
  border-radius: 17px;
  min-height: 52px;
  padding: 0 16px;
  border: 1px solid rgba(64, 127, 76, 0.13);
  background: rgba(250, 252, 248, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px rgba(33, 95, 40, 0.07) !important;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: rgba(47, 142, 84, 0.48);
  background: rgba(255, 255, 252, 0.98);
  box-shadow:
    0 0 0 3px rgba(73, 180, 100, 0.1),
    0 10px 22px rgba(33, 95, 40, 0.09) !important;
}

:deep(.el-input__inner) {
  color: #152218;
  font-size: 16px;
}

.send-btn {
  width: 52px;
  height: 52px;
  min-width: 52px;
  min-height: 52px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 17px;
  color: #fff;
  background: linear-gradient(145deg, #1d6a41 0%, #319156 58%, #4cb56b 100%);
  box-shadow:
    0 10px 20px rgba(27, 111, 63, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.send-btn svg {
  width: 22px;
  height: 22px;
}

.send-btn:hover {
  color: #fff;
  background: linear-gradient(145deg, #1d6a41 0%, #319156 58%, #4cb56b 100%);
  filter: saturate(1.06) brightness(1.03);
  transform: translateY(-1px);
  box-shadow:
    0 13px 24px rgba(27, 111, 63, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.send-btn.is-disabled {
  opacity: 0.62;
  transform: none;
}

@media (max-width: 680px) {
  .input-box {
    grid-template-columns: minmax(0, 1fr) 48px;
    gap: 8px;
  }

  :deep(.el-input__wrapper) {
    min-height: 48px;
    border-radius: 16px;
  }

  .send-btn {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .send-btn,
  :deep(.el-input__wrapper) {
    transition: none;
  }
}
</style>
