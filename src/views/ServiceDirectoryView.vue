<template>
  <div class="services-page">
    <header class="services-head">
      <p class="services-kicker">办事指南</p>
      <h1>办事指南</h1>
      <p class="services-lead">按分类查看已整理的校园事项；事项内容与来源仍在整理中。</p>
    </header>

    <nav class="category-tabs" aria-label="事项分类">
      <button
        v-for="category in SERVICE_CATEGORIES"
        :key="category.id"
        type="button"
        class="category-tab"
        :class="{ 'category-tab--active': category.id === activeCategory }"
        @click="selectCategory(category.id)"
      >
        {{ category.label }}
      </button>
    </nav>

    <section class="category-panel" aria-live="polite">
      <h2>{{ activeLabel }}</h2>
      <p class="category-panel__desc">{{ activeDescription }}</p>

      <div class="category-empty">
        <p>该分类的事项内容正在整理，暂未提供可核对的事项详情与来源。</p>
        <el-button type="primary" round @click="askInstead">先向校答提问</el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DEFAULT_SERVICE_CATEGORY,
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  type ServiceCategory,
  type ServiceCategoryId,
} from '@/data/services'

const route = useRoute()
const router = useRouter()

const activeCategory = computed<ServiceCategoryId>(() => {
  const value = route.query.category
  return isServiceCategoryId(value) ? value : DEFAULT_SERVICE_CATEGORY.id
})

const activeCategoryMeta = computed<ServiceCategory>(
  () =>
    SERVICE_CATEGORIES.find((category) => category.id === activeCategory.value) ??
    DEFAULT_SERVICE_CATEGORY,
)

const activeLabel = computed(() => activeCategoryMeta.value.label)
const activeDescription = computed(() => activeCategoryMeta.value.description)

const selectCategory = (category: ServiceCategoryId) => {
  void router.replace({ path: '/services', query: { category } })
}

const askInstead = () => {
  void router.push('/chat/new')
}
</script>

<style scoped>
.services-page {
  width: min(100%, 1028px);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4rem) 1.5rem 4rem;
}

.services-kicker {
  margin: 0;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.services-head h1 {
  margin: 0.5rem 0 0.6rem;
  font-size: clamp(2rem, 3.6vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.services-lead {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.7;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 2rem 0 1.5rem;
}

.category-tab {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.5rem 1rem;
  color: var(--muted);
  background: var(--white);
  font-size: 0.85rem;
  cursor: pointer;
}

.category-tab:hover {
  color: var(--text);
  border-color: var(--faint);
}

.category-tab--active {
  border-color: var(--brand);
  color: var(--white);
  background: var(--brand);
}

.category-panel {
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: var(--white);
}

.category-panel h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.category-panel__desc {
  margin: 0.4rem 0 1.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.category-empty {
  display: grid;
  justify-items: start;
  gap: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  background: var(--silver);
}

.category-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.7;
}
</style>
