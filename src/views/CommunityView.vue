<template>
  <div class="community-page">
    <header class="community-head">
      <div class="community-head__copy">
        <p class="community-kicker">校园互助 · 经验分享</p>
        <h1>校园社区</h1>
        <p class="community-lead">同学们在这里提问、分享经验；高质量内容经审核后沉淀为社区知识来源。</p>
      </div>
      <el-button type="primary" round class="publish-btn" @click="editorVisible = true">发布帖子</el-button>
    </header>

    <section class="toolbar-card">
      <div class="toolbar-row">
        <el-input
          v-model="keywordInput"
          placeholder="搜索帖子标题、内容或标签"
          clearable
          class="toolbar-search"
          @keyup.enter="applyFilters"
          @clear="applyFilters"
        />

        <el-select v-model="selectedCategory" placeholder="分类" clearable class="toolbar-select" @change="applyFilters">
          <el-option
            v-for="item in store.meta.categories"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>

        <el-segmented v-model="sortBy" :options="sortOptions" @change="applyFilters" />
      </div>

      <div class="tag-row">
        <span class="tag-row-label">热门标签</span>
        <el-tag
          v-for="tag in store.meta.hotTags"
          :key="tag"
          class="hot-tag"
          effect="plain"
          round
          @click="useTag(tag)"
        >
          {{ tag }}
        </el-tag>
      </div>
    </section>

    <section class="list-section">
      <div class="list-header">
        <h2>帖子列表</h2>
        <p>共 {{ store.total }} 条</p>
      </div>

      <el-alert v-if="store.lastError" :title="store.lastError" type="warning" show-icon :closable="false" />

      <el-skeleton :loading="store.loadingList" animated :rows="5">
        <template #default>
          <div v-if="store.posts.length" class="post-grid">
            <article
              v-for="post in store.posts"
              :key="post.id"
              class="post-card"
              data-testid="community-post-card"
              @click="openPost(post.id)"
            >
              <div class="post-card-top">
                <h3>{{ post.title }}</h3>
                <span class="post-replies">{{ post.replyCount }} 条回复</span>
              </div>

              <p class="post-meta">
                {{ categoryLabelMap[post.category] || post.category }} · {{ formatDate(post.createdAt) }}
              </p>

              <p class="post-preview">{{ post.contentPreview || post.content }}</p>

              <div class="post-footer">
                <div class="post-tags">
                  <span v-for="tag in post.tags" :key="tag" class="post-tag">{{ tag }}</span>
                </div>
                <span class="post-author">{{ post.authorName }}</span>
              </div>
            </article>
          </div>

          <el-empty v-else description="当前还没有匹配的帖子，欢迎发布第一条讨论" />
        </template>
      </el-skeleton>

      <div v-if="totalPages > 1" class="pager">
        <button type="button" class="pager-btn" :disabled="store.page <= 1" @click="goPage(store.page - 1)">
          上一页
        </button>
        <span class="pager-status">第 {{ store.page }} / {{ totalPages }} 页</span>
        <button
          type="button"
          class="pager-btn"
          :disabled="store.page >= totalPages"
          @click="goPage(store.page + 1)"
        >
          下一页
        </button>
      </div>
    </section>

    <el-dialog
      v-model="editorVisible"
      title="发布帖子"
      width="min(720px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="昵称">
          <el-input v-model="form.authorName" maxlength="20" placeholder="例如：张同学" />
        </el-form-item>

        <el-form-item label="分类">
          <el-select v-model="form.category" class="full-width">
            <el-option
              v-for="item in store.meta.categories"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="150" placeholder="例如：转专业后课程补退选怎么操作？" />
        </el-form-item>

        <el-form-item label="正文">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="1000"
            show-word-limit
            placeholder="把你的问题或经验尽量写清楚，方便大家回复。"
          />
        </el-form-item>

        <el-form-item label="标签（可选）">
          <el-input v-model="tagInput" placeholder="多个标签用中文逗号分隔，例如：转专业，补退选，成绩认定" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-actions">
          <el-button @click="editorVisible = false">取消</el-button>
          <el-button type="primary" :loading="store.submitting" @click="submitPost">提交</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useCommunityStore } from '@/store/community'
import { formatDate } from '@/utils/date'
import {
  buildCommunityQuery,
  clampCommunityPage,
  communityTotalPages,
  parseCommunityQuery,
} from '@/services/community-query'

const emit = defineEmits<{
  (e: 'open-post', postId: string): void
}>()

const route = useRoute()
const router = useRouter()
const store = useCommunityStore()

const LIST_SCROLL_KEY = 'ai-campus-agent.community-list-scroll.v1'

const editorVisible = ref(false)
const keywordInput = ref('')
const selectedCategory = ref('')
const sortBy = ref<'latest' | 'hot'>('latest')
const tagInput = ref('')
let syncingQuery = false

const form = ref({
  authorName: '张同学',
  category: 'teaching',
  title: '',
  content: '',
})

const sortOptions = [
  { label: '最新发布', value: 'latest' },
  { label: '热门优先', value: 'hot' },
]

const categoryLabelMap = computed(() =>
  Object.fromEntries(store.meta.categories.map((item) => [item.value, item.label])),
)

const totalPages = computed(() => communityTotalPages(store.total, store.pageSize))

// 6.1：筛选与分页都从 URL 读取，刷新/返回/分享链接都能还原列表状态。
const readQueryState = () =>
  parseCommunityQuery(
    route.query as Record<string, unknown>,
    store.meta.categories.map((item) => item.value),
  )

const syncQuery = async (page: number) => {
  const query = buildCommunityQuery({
    keyword: keywordInput.value,
    category: selectedCategory.value,
    sort: sortBy.value,
    page,
  })

  const current = route.query
  const same =
    (typeof current.q === 'string' ? current.q : '') === (query.q || '') &&
    (typeof current.category === 'string' ? current.category : '') === (query.category || '') &&
    (typeof current.sort === 'string' ? current.sort : 'latest') === (query.sort || 'latest') &&
    (typeof current.page === 'string' ? current.page : '1') === (query.page || '1')
  if (same) return

  syncingQuery = true
  try {
    await router.replace({ query })
  } finally {
    syncingQuery = false
  }
}

const loadFromState = async (page: number) => {
  store.setKeyword(keywordInput.value.trim())
  store.setCategory(selectedCategory.value)
  store.setSortBy(sortBy.value)
  store.page = page
  await store.loadPosts()

  // 手改 URL 到越界页码时，回落到最后一页再拉一次。
  const clamped = clampCommunityPage(page, store.total, store.pageSize)
  if (clamped !== page) {
    await syncQuery(clamped)
    store.page = clamped
    await store.loadPosts()
  }
}

const applyFilters = async () => {
  await syncQuery(1)
  await loadFromState(1)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goPage = async (nextPage: number) => {
  const page = Math.min(Math.max(1, nextPage), totalPages.value)
  if (page === store.page) return
  await syncQuery(page)
  await loadFromState(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const useTag = async (tag: string) => {
  keywordInput.value = tag
  await applyFilters()
}

// 打开详情前记录列表滚动位置与筛选；返回时只恢复同一 URL 的状态。
const openPost = (postId: string) => {
  try {
    sessionStorage.setItem(
      LIST_SCROLL_KEY,
      JSON.stringify({ fullPath: route.fullPath, scrollY: window.scrollY }),
    )
  } catch {
    // 无痕模式忽略。
  }
  emit('open-post', postId)
}

const restoreScroll = async () => {
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

const submitPost = async () => {
  if (!form.value.authorName.trim() || !form.value.title.trim() || !form.value.content.trim()) {
    ElMessage.warning('请先填写昵称、标题和正文')
    return
  }

  const tags = tagInput.value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  try {
    await store.submitPost({
      authorName: form.value.authorName.trim(),
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      category: form.value.category,
      tags,
    })

    ElMessage.success('帖子已提交，当前默认进入待审核状态')
    editorVisible.value = false
    form.value.title = ''
    form.value.content = ''
    tagInput.value = ''
  } catch {
    ElMessage.error(store.lastError || '发布失败，请稍后重试')
  }
}

onMounted(async () => {
  await store.loadMeta()
  if (!form.value.category && store.meta.categories[0]) {
    form.value.category = store.meta.categories[0].value
  }

  const state = readQueryState()
  keywordInput.value = state.keyword
  selectedCategory.value = state.category
  sortBy.value = state.sort
  await loadFromState(state.page)
  await restoreScroll()
})

// 浏览器前进/后退或外部改 query 时，重新按 URL 拉取；自身 replace 时跳过。
watch(
  () => route.query,
  async () => {
    if (syncingQuery) return
    const state = readQueryState()
    keywordInput.value = state.keyword
    selectedCategory.value = state.category
    sortBy.value = state.sort
    await loadFromState(state.page)
  },
  { deep: true },
)
</script>

<style scoped>
.community-page {
  width: min(100%, 82rem);
  margin: 0 auto;
  padding: clamp(1.5rem, 3vw, 2.5rem) 1.5rem 4rem;
}

.community-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 2rem;
  margin-bottom: 1.75rem;
}

.community-kicker {
  margin: 0;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.community-head h1 {
  margin: 0.35rem 0 0.5rem;
  font-size: clamp(2rem, 3.6vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.community-lead {
  max-width: 40rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.7;
}

.publish-btn {
  min-height: 2.75rem;
  padding-inline: 1.4rem;
}

.toolbar-card {
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: 1.1rem;
  background: var(--white);
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-search {
  flex: 1;
  min-width: 220px;
}

.toolbar-select {
  width: 9rem;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.tag-row-label {
  color: var(--faint);
  font-size: 0.8rem;
}

.hot-tag {
  cursor: pointer;
}

.list-section {
  margin-top: 2rem;
}

.list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.list-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.list-header p {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
}

.post-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  background: var(--white);
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.post-card:hover {
  border-color: var(--border);
  background: var(--silver);
}

.post-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.post-card-top h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.45;
}

.post-replies {
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.55rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.72rem;
}

.post-meta {
  margin: 0;
  color: var(--faint);
  font-size: 0.78rem;
}

.post-preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.post-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.6rem;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.post-tag {
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  color: var(--muted);
  background: var(--silver);
  font-size: 0.72rem;
}

.post-author {
  color: var(--faint);
  font-size: 0.75rem;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.pager-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.45rem 1rem;
  color: var(--text);
  background: var(--white);
  font-size: 0.82rem;
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.pager-status {
  color: var(--muted);
  font-size: 0.82rem;
}

.full-width {
  width: 100%;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

@media (max-width: 47.99rem) {
  .community-page {
    padding-inline: 1rem;
  }

  .toolbar-select {
    width: 100%;
  }

  .community-head {
    align-items: flex-start;
  }
}
</style>
