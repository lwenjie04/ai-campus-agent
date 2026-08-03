<template>
  <!-- 输入区只负责收集文本并向父组件发出 send 事件，不直接处理请求。 -->
  <div class="input-box">
    <el-input
      v-model="text"
      :disabled="loading"
      placeholder="询问校园事务、RAG 流程、来源依据或数智校答方案"
      @keyup.enter="send"
    />
    <el-button class="send-btn" :loading="loading" :disabled="loading" @click="send">
      发送
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
  display: grid;
  grid-template-columns: 1fr 4.5rem;
  gap: 0.625rem;
  align-items: center;
}

:deep(.el-input) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  min-height: 3.5rem;
  padding: 0 1rem;
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 0 0 1px rgba(188, 205, 255, 0.17),
    0 18px 34px rgba(0, 0, 0, 0.18) !important;
  backdrop-filter: blur(14px);
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow:
    inset 0 0 0 1px rgba(103, 232, 249, 0.48),
    0 0 0 5px rgba(103, 232, 249, 0.12),
    0 18px 34px rgba(0, 0, 0, 0.2) !important;
}

:deep(.el-input__inner) {
  color: #f7fbff;
  font-size: 16px;
  font-weight: 650;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(217, 227, 255, 0.62);
}

.send-btn {
  width: 4.5rem;
  height: 3.5rem;
  border-radius: 8px;
  border: none;
  font-size: 0.9375rem;
  font-weight: 800;
  color: #f7fbff;
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.9), rgba(103, 232, 249, 0.74));
  box-shadow:
    0 18px 34px rgba(87, 105, 255, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.36);
}

.send-btn:hover {
  color: #fff;
  transform: translateY(-1px);
  box-shadow:
    0 22px 38px rgba(87, 105, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.send-btn.is-disabled {
  opacity: 0.7;
}

@media (max-width: 680px) {
  .input-box {
    grid-template-columns: 1fr 3.75rem;
    gap: 8px;
  }

  .send-btn {
    width: 3.75rem;
    height: 3.25rem;
    font-size: 0.875rem;
  }
}
</style>
