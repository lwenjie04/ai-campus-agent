<template>
  <section class="not-found" data-testid="not-found">
    <p class="not-found__code">404</p>
    <h1>这个页面不存在</h1>
    <p class="not-found__text">链接可能已经变更，或者地址输入有误。</p>
    <div class="not-found__actions">
      <el-button type="primary" round @click="goHome">回到智能服务台</el-button>
      <el-button round @click="goCommunity">前往校园社区</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goCommunity = () => {
  router.push('/community')
}
</script>

<style scoped>
.not-found {
  width: min(100%, 44rem);
  margin: clamp(2rem, 8vh, 6rem) auto;
  padding: clamp(1.4rem, 4vw, 2.6rem);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  box-shadow: var(--shadow-sm);
}

.not-found__code {
  margin: 0;
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.not-found h1 {
  margin: 0.4rem 0 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  line-height: 1.1;
}

.not-found__text {
  margin: 0 0 1.4rem;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.7;
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
</style>
