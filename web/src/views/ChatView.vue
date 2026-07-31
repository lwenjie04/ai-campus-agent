<template>
  <div class="chat-container">
    <h2>广二师 AI 校园助手</h2>

    <div class="chat-box">
      <div v-for="(msg, index) in chatStore.messages" :key="index">
        <b>{{ msg.role }}：</b>{{ msg.content }}
      </div>
    </div>

    <el-input
      v-model="input"
      placeholder="请输入问题"
      @keyup.enter="sendMessage"
    />

    <el-button type="primary" @click="sendMessage">
      发送
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/store/chat.ts'

const chatStore = useChatStore()
const input = ref('')

function sendMessage() {
  if (!input.value) return
  chatStore.addMessage('user', input.value)

  chatStore.addMessage('assistant', '这里以后是AI回复')

  input.value = ''
}
</script>
