<template>
  <div v-if="item" class="service-detail">
    <nav class="breadcrumb" aria-label="面包屑">
      <RouterLink to="/services">办事指南</RouterLink>
      <span class="breadcrumb__sep" aria-hidden="true">/</span>
      <RouterLink :to="serviceListLocation(item.category)">{{ category.label }}</RouterLink>
      <span class="breadcrumb__sep" aria-hidden="true">/</span>
      <span aria-current="page">{{ item.title }}</span>
    </nav>

    <header class="detail-head">
      <p class="detail-kicker">SERVICE GUIDE</p>
      <h1>{{ item.title }}</h1>
      <p class="detail-lead">{{ item.purpose }}</p>
    </header>

    <div class="detail-grid">
      <article class="detail-main">
        <section class="detail-section">
          <h2>事项说明</h2>
          <p>{{ item.purpose }}</p>
          <p class="detail-note">
            页面只整理来源可核对的信息；办理时间、条件和流程请以学校本学年最新通知为准，旧年度通知不作为当前办理依据。
          </p>
          <p v-if="!item.actionUrl" class="detail-note">
            当前未核实到可用的线上办理入口，请通过学校最新通知或线下受理点确认办理方式。
          </p>
        </section>

        <section class="detail-section">
          <h2>关键词</h2>
          <div class="keyword-row">
            <span v-for="keyword in item.keywords" :key="keyword" class="keyword">
              {{ keyword }}
            </span>
          </div>
        </section>

        <section v-if="item.actionUrl" class="detail-section">
          <h2>办理入口</h2>
          <a
            class="detail-entry"
            :href="item.actionUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开办理入口 ↗
          </a>
        </section>
      </article>

      <aside class="detail-side">
        <section class="source-card" aria-label="来源参考">
          <p class="source-card__kicker">来源参考</p>
          <h2>{{ item.source.title }}</h2>
          <dl class="source-meta">
            <div>
              <dt>发布日期</dt>
              <dd>{{ item.source.sourceDate || '未提供' }}</dd>
            </div>
            <div>
              <dt>来源定位</dt>
              <dd>{{ item.source.sourceLocator || '未提供' }}</dd>
            </div>
            <div>
              <dt>核对日期</dt>
              <dd>{{ item.source.checkedAt || '未提供' }}</dd>
            </div>
          </dl>
          <a
            v-if="item.source.referenceUrl"
            class="source-link"
            :href="item.source.referenceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开通知原文 ↗
          </a>
          <p v-else class="source-missing">通知原文链接未提供</p>
          <p class="source-warning">
            该来源为历史通知或制度文本，仅作参考；页面不展示已过期的办理时间与步骤，办理前请核对本学年最新通知。
          </p>
        </section>

        <RouterLink class="back-link" :to="serviceListLocation(item.category)">
          ← 返回{{ category.label }}事项
        </RouterLink>
      </aside>
    </div>
  </div>

  <div v-else class="service-invalid" data-testid="service-invalid">
    <p class="detail-kicker">SERVICE GUIDE</p>
    <h1>无效事项</h1>
    <p class="service-invalid__lead">内容不存在或已下线，返回办事指南重新选择事项。</p>
    <el-button type="primary" round @click="goList">返回办事指南</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getServiceCategory, getServiceItem } from '@/data/services'
import { serviceListLocation } from '@/services/service-query'

const props = defineProps<{ serviceId: string }>()

const router = useRouter()

const item = computed(() => getServiceItem(props.serviceId))
const category = computed(() => getServiceCategory(item.value?.category ?? 'teaching'))

const goList = () => {
  void router.push('/services')
}
</script>

<style scoped>
.service-detail,
.service-invalid {
  width: min(100%, 1028px);
  margin: 0 auto;
  padding: clamp(2rem, 4vw, 3rem) 1.5rem 4rem;
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  color: var(--faint);
  font-size: 0.82rem;
}

.breadcrumb a {
  color: var(--muted);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--brand);
}

.breadcrumb__sep {
  color: var(--border);
}

.detail-head {
  margin: 1.75rem 0 2rem;
}

.detail-kicker {
  margin: 0;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.detail-head h1,
.service-invalid h1 {
  margin: 0.5rem 0 0.65rem;
  color: var(--text);
  font-size: clamp(2rem, 3.6vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.detail-lead,
.service-invalid__lead {
  max-width: 46rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.7;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 1.5rem;
  align-items: start;
}

.detail-main {
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: clamp(1.5rem, 3vw, 2.25rem);
  background: var(--white);
}

.detail-section + .detail-section {
  margin-top: 1.5rem;
  border-top: 1px solid var(--soft);
  padding-top: 1.5rem;
}

.detail-section h2 {
  margin: 0 0 0.6rem;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.detail-section p {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.75;
}

.detail-section p.detail-note {
  margin-top: 0.75rem;
  color: var(--faint);
  font-size: 0.82rem;
}

.keyword-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.keyword {
  border-radius: var(--radius-pill);
  padding: 0.2rem 0.65rem;
  color: var(--muted);
  background: var(--silver);
  font-size: 0.78rem;
}

.detail-entry,
.source-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--link);
  font-size: 0.88rem;
  font-weight: 500;
}

.detail-side {
  display: grid;
  gap: 1rem;
}

.source-card {
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  background: var(--white);
}

.source-card__kicker {
  margin: 0;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
}

.source-card h2 {
  margin: 0.5rem 0 0.85rem;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
}

.source-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0 0 1rem;
}

.source-meta div {
  display: grid;
  gap: 0.15rem;
}

.source-meta dt {
  color: var(--faint);
  font-size: 0.74rem;
}

.source-meta dd {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.source-missing {
  margin: 0 0 0.6rem;
  color: var(--faint);
  font-size: 0.82rem;
}

.source-warning {
  margin: 0.9rem 0 0;
  border-top: 1px solid var(--soft);
  padding-top: 0.9rem;
  color: var(--faint);
  font-size: 0.78rem;
  line-height: 1.65;
}

.back-link {
  justify-self: start;
  color: var(--link);
  font-size: 0.85rem;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.service-invalid {
  display: grid;
  justify-items: start;
  gap: 0.9rem;
}

.service-invalid__lead {
  margin-bottom: 0.5rem;
}

@media (max-width: 63.99rem) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 47.99rem) {
  .service-detail,
  .service-invalid {
    padding-inline: 1rem;
  }
}
</style>
