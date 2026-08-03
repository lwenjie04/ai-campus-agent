<template>
  <div class="lightrag-panel">
    <div class="lightrag-toolbar">
      <div class="lightrag-toolbar__left">
        <span class="lightrag-title">LightRAG 知识图谱控制台</span>
        <span class="lightrag-status" :class="{ online: lightragOnline, offline: !lightragOnline }">
          <span class="lightrag-dot"></span>
          {{ lightragOnline ? '在线' : '离线' }}
        </span>
      </div>
      <div class="lightrag-toolbar__right">
        <button class="lightrag-btn" @click="reloadFrame" :disabled="!lightragOnline">
          刷新页面
        </button>
        <a class="lightrag-btn lightrag-btn--link" href="/lightrag/" target="_blank">
          在新窗口打开 ↗
        </a>
      </div>
    </div>

    <div class="lightrag-frame-wrapper">
      <div v-if="!lightragOnline && !checking" class="lightrag-offline">
        <div class="lightrag-offline__icon">⚠️</div>
        <p>LightRAG 服务未启动或不可达</p>
        <p class="lightrag-offline__hint">
          请在服务器终端运行 <code>npm run lightrag:start</code> 启动 LightRAG 服务
        </p>
        <button class="lightrag-btn" @click="checkHealth">重新检测</button>
      </div>

      <div v-if="checking" class="lightrag-loading">
        <div class="lightrag-loading__spinner"></div>
        <p>正在连接 LightRAG 服务...</p>
      </div>

      <iframe
        v-show="lightragOnline"
        ref="frameRef"
        :key="frameKey"
        :src="proxyUrl"
        class="lightrag-iframe"
        frameborder="0"
        @load="onFrameLoad"
        @error="onFrameError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const frameRef = ref<HTMLIFrameElement | null>(null)
const frameKey = ref(0)
const lightragOnline = ref(false)
const checking = ref(true)

const proxyUrl = '/lightrag/'

const checkHealth = async () => {
  checking.value = true
  try {
    const resp = await fetch('/lightrag/health')
    if (resp.ok) {
      lightragOnline.value = true
    } else {
      lightragOnline.value = false
    }
  } catch {
    lightragOnline.value = false
  } finally {
    checking.value = false
  }
}

const reloadFrame = () => {
  frameKey.value++
}

const onFrameLoad = () => {
  // iframe 加载成功
}

const onFrameError = () => {
  lightragOnline.value = false
}

onMounted(() => {
  checkHealth()
})
</script>

<style scoped>
.lightrag-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 220px);
  min-height: 540px;
}

.lightrag-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.125rem;
  border: 1px solid var(--light-line);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: var(--light-surface);
  flex-shrink: 0;
}

.lightrag-toolbar__left,
.lightrag-toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lightrag-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--light-ink);
}

.lightrag-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.lightrag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.lightrag-status.online {
  color: #16a34a;
}
.lightrag-status.online .lightrag-dot {
  background: #16a34a;
  box-shadow: 0 0 6px rgba(22, 163, 74, 0.5);
}

.lightrag-status.offline {
  color: #dc2626;
}
.lightrag-status.offline .lightrag-dot {
  background: #dc2626;
}

.lightrag-btn {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--light-line);
  border-radius: var(--radius-pill);
  background: var(--light-surface);
  color: var(--light-ink);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.lightrag-btn:hover:not(:disabled) {
  background: var(--light-surface-soft);
  border-color: var(--primary-500);
}

.lightrag-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lightrag-btn--link {
  color: var(--primary-500);
}

.lightrag-frame-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid var(--light-line);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: #fff;
  overflow: hidden;
}

.lightrag-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.lightrag-offline,
.lightrag-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--light-muted);
}

.lightrag-offline__icon {
  font-size: 2.5rem;
}

.lightrag-offline__hint {
  font-size: var(--font-size-sm);
  color: var(--light-muted);
}

.lightrag-offline__hint code {
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  font-size: var(--font-size-xs);
}

.lightrag-loading__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--light-line);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
