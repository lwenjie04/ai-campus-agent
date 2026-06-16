<template>
  <div class="panel">
    <div class="panel__stage">
      <RobotAvatar cue-key="idle" variant="panel" :source-count="5" />
    </div>
    <div class="panel__info">
      <span class="panel__kicker">Prism Core</span>
      <h2>AI 数字助手</h2>
      <div class="panel__states">
        <div class="state" v-for="s in states" :key="s.label">
          <span class="state-dot" :style="{ background: s.color }" />
          <span>{{ s.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import RobotAvatar from '@/components/RobotAvatar.vue'

const states = [
  { label: '待机中', color: '#34c759' },
  { label: '聆听中', color: '#5ac8fa' },
  { label: '生成中', color: '#ac39ff' },
  { label: '讲解中', color: '#0071e3' },
]
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  color: #1a1a18;
}

.panel__stage {
  flex: 1;
  min-height: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
}

.panel__info {
  flex-shrink: 0;
}

.panel__kicker {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
  background: rgba(90,200,250,0.1);
  color: #5ac8fa;
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0.04em;
}

.panel__info h2 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: var(--font-size-title3);
  font-weight: 600;
  color: var(--dark-ink, #f5f5f7);
}

.panel__states {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem;
}

.state {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--font-size-caption);
  color: rgba(245,245,247,0.45);
}
.state-dot {
  width: 0.375rem; height: 0.375rem; border-radius: 50%; flex-shrink: 0;
}
</style>
