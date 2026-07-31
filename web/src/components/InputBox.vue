<template>
  <!-- 输入区只负责收集文本并向父组件发出 send 事件，不直接处理请求。 -->
  <div class="input-box">
    <el-input
      v-model="text"
      :disabled="loading"
      placeholder="请输入你的问题"
      @keyup.enter="send"
    />
    <el-button class="send-btn" :loading="loading" :disabled="loading" @click="send">
      ✨
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
  grid-template-columns: 1fr 54px;
  gap: 10px;
  align-items: center;
}

:deep(.el-input) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 999px;
  min-height: 52px;
  padding: 0 16px;
  background: rgba(243, 243, 243, 0.95);
  box-shadow:
    inset 0 0 0 1px rgba(50, 110, 51, 0.12),
    0 8px 14px rgba(33, 95, 40, 0.06) !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow:
    inset 0 0 0 1px rgba(47, 137, 66, 0.28),
    0 0 0 4px rgba(98, 219, 93, 0.13),
    0 8px 14px rgba(33, 95, 40, 0.07) !important;
}

:deep(.el-input__inner) {
  color: #152218;
  font-size: 16px;
}

.send-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  font-size: 22px;
  color: #35c648;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 16px rgba(26, 85, 35, 0.12);
}

.send-btn:hover {
  background: #fff;
  color: #24b238;
}

.send-btn.is-disabled {
  opacity: 0.7;
}

@media (max-width: 680px) {
  .input-box {
    grid-template-columns: 1fr 50px;
    gap: 8px;
  }

  .send-btn {
    width: 50px;
    height: 50px;
    font-size: 20px;
  }
}
</style>
