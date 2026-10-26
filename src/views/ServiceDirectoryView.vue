<template>
  <div class="services-page">
    <header class="services-head">
      <p class="services-kicker">SERVICE GUIDE</p>
      <h1>办事指南</h1>
      <p class="services-lead">
        查看常用事项的办理说明与学校来源。旧年度通知和制度文本只作来源参考，办理条件与时间请以学校最新通知为准。
      </p>
    </header>

    <nav class="category-tabs" aria-label="事项分类">
      <button
        v-for="category in SERVICE_CATEGORIES"
        :key="category.id"
        type="button"
        class="category-tab"
        :class="{ 'category-tab--active': category.id === activeCategory }"
        :aria-pressed="category.id === activeCategory"
        :data-testid="`service-category-${category.id}`"
        @click="selectCategory(category.id)"
      >
        {{ category.label }}
      </button>
    </nav>

    <section class="category-panel" aria-live="polite">
      <div class="category-panel__head">
        <div>
          <h2>{{ activeCategoryMeta.label }}</h2>
          <p class="category-panel__desc">{{ activeCategoryMeta.description }}</p>
        </div>
        <p class="category-panel__count">共 {{ items.length }} 项</p>
      </div>

      <div v-if="items.length" class="service-list">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          class="service-item"
          :to="serviceDetailLocation(item)"
          data-testid="service-item"
          @click="rememberListPosition"
        >
          <span class="service-item__top">
            <span class="service-item__title">{{ item.title }}</span>
            <span class="service-item__category">{{ activeCategoryMeta.label }}</span>
          </span>
          <span class="service-item__purpose">{{ item.purpose }}</span>
          <span class="service-item__foot">
            <span class="service-item__keywords">
              <span
                v-for="keyword in item.keywords.slice(0, 3)"
                :key="keyword"
                class="service-item__keyword"
              >
                {{ keyword }}
              </span>
            </span>
            <span class="service-item__arrow">查看详情 →</span>
          </span>
        </RouterLink>
      </div>

      <div v-else class="category-empty">
        <el-empty description="当前分类暂无事项，可切换其他分类查看。">
          <el-button round @click="goHome">返回首页</el-button>
        </el-empty>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  DEFAULT_SERVICE_CATEGORY,
  SERVICE_CATEGORIES,
  getServiceCategory,
  listServiceItems,
} from '@/data/services'
import {
  parseServiceListCategory,
  serviceDetailLocation,
  serviceListLocation,
} from '@/services/service-query'
import type { ServiceCategoryId } from '@/types/service'

// 5.2：筛选只来自 URL；从详情返回时用 sessionStorage 恢复同一列表的滚动位置。
const LIST_SCROLL_KEY = 'ai-campus-agent.services-list-scroll.v1'

const route = useRoute()
const router = useRouter()

const activeCategory = computed<ServiceCategoryId>(() =>
  parseServiceListCategory(route.query as Record<string, unknown>),
)
const activeCategoryMeta = computed(() => getServiceCategory(activeCategory.value))
const items = computed(() => listServiceItems(activeCategory.value))

const selectCategory = (category: ServiceCategoryId) => {
  if (category === activeCategory.value) return
  void router.replace(serviceListLocation(category))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goHome = () => {
  void router.push('/')
}

// 进入详情前记录当前列表 URL 与滚动位置；只有回到同一 URL 时才恢复。
const rememberListPosition = () => {
  try {
    sessionStorage.setItem(
      LIST_SCROLL_KEY,
      JSON.stringify({ fullPath: route.fullPath, scrollY: window.scrollY }),
    )
  } catch {
    // 无痕模式或存储被禁用时忽略，不影响跳转。
  }
}

const restoreListPosition = async () => {
  try {
    const raw = sessionStorage.getItem(LIST_SCROLL_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { fullPath?: string; scrollY?: number }
    sessionStorage.removeItem(LIST_SCROLL_KEY)
    if (saved.fullPath !== route.fullPath) return
    await nextTick()
    window.scrollTo(0, Number(saved.scrollY) || 0)
  } catch {
    // 忽略损坏数据。
  }
}

onMounted(async () => {
  // 直接打开 /services 时把默认分类补进 URL，保证刷新、分享与返回看到同一筛选。
  if (!SERVICE_CATEGORIES.some((category) => category.id === route.query.category)) {
    await router.replace(serviceListLocation(DEFAULT_SERVICE_CATEGORY.id))
  }
  await restoreListPosition()
})
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
  max-width: 46rem;
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
  padding: 0.5rem 1.1rem;
  color: var(--muted);
  background: var(--white);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
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

.category-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 1.5rem;
}

.category-panel__head h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.category-panel__desc {
  margin: 0.4rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.category-panel__count {
  margin: 0;
  color: var(--faint);
  font-size: 0.82rem;
}

.service-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
  gap: 1rem;
}

.service-item {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  border: 1px solid var(--soft);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  color: inherit;
  background: var(--white);
  text-decoration: none;
  transition: border-color 160ms ease, background 160ms ease;
}

.service-item:hover {
  border-color: var(--border);
  background: var(--silver);
}

.service-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.service-item__title {
  color: var(--text);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.45;
}

.service-item__category {
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.55rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.72rem;
}

.service-item__purpose {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.service-item__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.6rem;
}

.service-item__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.service-item__keyword {
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  color: var(--muted);
  background: var(--silver);
  font-size: 0.72rem;
}

.service-item__arrow {
  color: var(--link);
  font-size: 0.8rem;
  font-weight: 500;
}

.category-empty {
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
  background: var(--silver);
}

@media (max-width: 47.99rem) {
  .services-page {
    padding-inline: 1rem;
  }

  .service-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
