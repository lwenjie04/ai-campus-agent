<template>
  <section class="forbidden" data-testid="forbidden-page">
    <p class="forbidden__code">403</p>
    <h1>当前账号没有访问权限</h1>
    <p class="forbidden__text">
      这个页面只对知识运营员开放。你可以回到服务台继续提问，或换一个有权限的账号登录。
    </p>
    <p v-if="from" class="forbidden__from">请求地址：{{ from }}</p>
    <div class="forbidden__actions">
      <el-button type="primary" round @click="goBack">返回</el-button>
      <el-button round @click="goHome">回到智能服务台</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const from = computed(() => (typeof route.query.from === 'string' ? route.query.from : ''))

// 外部直达或刷新进入时没有可返回的历史，退化为回服务台，避免调用 back() 无效果。
const goBack = () => {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  void router.replace('/')
}

const goHome = () => {
  void router.replace('/')
}
</script>

<style scoped>
.forbidden {
  width: min(100%, 44rem);
  margin: clamp(2rem, 8vh, 6rem) auto;
  padding: clamp(1.4rem, 4vw, 2.6rem);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  box-shadow: var(--shadow-sm);
}

.forbidden__code {
  margin: 0;
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.forbidden h1 {
  margin: 0.4rem 0 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4.6vw, 2.2rem);
  line-height: 1.15;
}

.forbidden__text {
  margin: 0 0 0.6rem;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.7;
}

.forbidden__from {
  margin: 0 0 1.2rem;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  word-break: break-all;
}

.forbidden__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
</style>
