<template>
  <div class="community-page light-surface">
    <header class="community-hero">
      <div>
        <div class="hero-kicker">学生社区</div>
        <h1>校园问题流转中心</h1>
        <p>把高频问题、办理经验和同学补充沉淀到社区，后续可进入问答来源。</p>
      </div>

      <div class="hero-actions">
        <div class="hero-stat">
          <strong>{{ store.total }}</strong>
          <span>公开讨论</span>
        </div>
        <el-button type="primary" round @click="editorVisible = true">发布帖子</el-button>
      </div>
    </header>

    <section class="community-shell">
      <aside class="community-aside">
        <div class="aside-block">
          <span class="aside-label">当前视图</span>
          <strong>学生日常查询</strong>
          <p>聚合选课、奖学金、宿舍、考试等常见事务。</p>
        </div>
        <div class="aside-block">
          <span class="aside-label">热门标签</span>
          <div class="tag-row">
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
        </div>
      </aside>

      <main class="community-main">
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

        <el-segmented
          v-model="sortBy"
          :options="sortOptions"
          @change="applyFilters"
        />
      </div>
    </section>

    <section class="list-card">
      <div class="list-header">
        <div>
          <h2>帖子列表</h2>
          <p>当前共 {{ store.total }} 条记录</p>
        </div>
      </div>

      <el-alert v-if="store.lastError" :title="store.lastError" type="warning" show-icon :closable="false" />

      <el-skeleton :loading="store.loadingList" animated :rows="5">
        <template #default>
          <div v-if="store.posts.length" class="post-list">
            <article
              v-for="post in store.posts"
              :key="post.id"
              class="post-card"
              @click="$emit('open-post', post.id)"
            >
              <div class="post-card-top">
                <div>
                  <span class="post-category">{{ categoryLabelMap[post.category] || post.category }}</span>
                  <h3>{{ post.title }}</h3>
                  <p class="post-meta">
                    {{ formatDate(post.createdAt) }} · {{ post.authorName }}
                  </p>
                </div>
                <div class="post-count">
                  <strong>{{ post.replyCount }}</strong>
                  <span>回复</span>
                </div>
              </div>

              <p class="post-preview">{{ post.contentPreview || post.content }}</p>

              <div class="post-footer">
                <div class="post-tags">
                  <el-tag
                    v-for="tag in post.tags"
                    :key="tag"
                    round
                    effect="plain"
                    size="small"
                  >
                    {{ tag }}
                  </el-tag>
                </div>
                <span class="post-author">查看详情</span>
              </div>
            </article>
          </div>

          <el-empty v-else description="当前还没有匹配的帖子，欢迎发布第一条讨论" />
        </template>
      </el-skeleton>
    </section>
      </main>
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
          <el-input
            v-model="tagInput"
            placeholder="多个标签用中文逗号分隔，例如：转专业，补退选，成绩认定"
          />
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
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'

defineEmits<{
  (e: 'open-post', postId: string): void
}>()

const store = useCommunityStore()

const editorVisible = ref(false)
const keywordInput = ref('')
const selectedCategory = ref('')
const sortBy = ref<'latest' | 'hot'>('latest')
const tagInput = ref('')

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

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const applyFilters = async () => {
  store.setKeyword(keywordInput.value.trim())
  store.setCategory(selectedCategory.value)
  store.setSortBy(sortBy.value)
  await store.loadPosts()
}

const useTag = async (tag: string) => {
  keywordInput.value = tag
  await applyFilters()
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
  selectedCategory.value = store.selectedCategory
  keywordInput.value = store.keyword
  sortBy.value = store.sortBy
  await store.loadPosts()
})
</script>

<style scoped>
.community-page {
  min-height: 100vh;
  padding: var(--space-8);
  background: var(--light-bg);
  color: var(--light-ink);
  font-family: var(--font-sans);
}

.community-hero,
.toolbar-card,
.list-card {
  border: 1px solid var(--light-line);
  border-radius: var(--radius-md);
  background: var(--light-surface);
  box-shadow: var(--shadow-light-sm);
  backdrop-filter: var(--glass-blur);
}

.community-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  max-width: 1380px;
  margin: 0 auto 18px;
  padding: 18px 22px;
}

.hero-kicker {
  display: inline-flex;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-pill);
  background: rgba(35, 104, 255, 0.1);
  color: var(--primary-500);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.community-hero h1,
.list-header h2 {
  margin: 0.625rem 0 0.375rem;
  font-size: var(--font-size-2xl);
  line-height: var(--line-height-tight);
  color: var(--light-ink);
}

.community-hero p,
.list-header p,
.post-meta,
.post-preview,
.post-author {
  margin: 0;
  color: rgba(32, 43, 68, 0.68);
}

.hero-actions,
.toolbar-row,
.dialog-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-stat {
  display: grid;
  min-width: 6.5rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--light-line);
  border-radius: var(--radius-md);
  background: var(--light-surface-soft);
}

.hero-stat strong {
  color: var(--light-ink);
  font-size: 1.625rem;
  line-height: 1;
}

.hero-stat span {
  color: var(--light-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.community-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  max-width: 1380px;
  margin: 0 auto;
}

.community-aside {
  align-self: start;
  display: grid;
  gap: 14px;
  position: sticky;
  top: 118px;
}

.aside-block {
  padding: var(--space-5);
  border: 1px solid var(--light-line);
  border-radius: var(--radius-md);
  background: var(--light-surface);
  box-shadow: var(--shadow-light-sm);
}

.aside-label {
  color: var(--light-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-black);
}

.aside-block strong {
  display: block;
  margin-top: 0.625rem;
  color: var(--light-ink);
  font-size: var(--font-size-xl);
}

.aside-block p {
  margin: var(--space-2) 0 0;
  color: var(--light-muted);
  line-height: var(--line-height-relaxed);
}

.community-main {
  min-width: 0;
}

.toolbar-card,
.list-card {
  padding: 16px;
  margin-bottom: 12px;
}

.toolbar-row {
  flex-wrap: wrap;
}

.toolbar-search {
  flex: 1 1 320px;
}

.toolbar-select {
  width: 180px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.hot-tag {
  cursor: pointer;
  border-color: rgba(35, 104, 255, 0.2);
  color: var(--primary-500);
  background: var(--light-surface-soft);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.post-list {
  display: grid;
  gap: 10px;
}

.post-card {
  padding: 0.875rem 1rem;
  border: 1px solid var(--light-line);
  border-radius: var(--radius-md);
  background: var(--light-surface);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
  cursor: pointer;
}

.post-card:hover {
  transform: translateY(-1px);
  border-color: rgba(35, 104, 255, 0.18);
  box-shadow: var(--shadow-light-sm);
}

.post-card-top,
.post-footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.post-card-top {
  align-items: flex-start;
}

.post-card h3 {
  margin: 0.375rem 0;
  font-size: var(--font-size-lg);
  color: var(--light-ink);
}

.post-category {
  color: var(--primary-500);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-black);
}

.post-count {
  display: grid;
  min-width: 4rem;
  justify-items: center;
  padding: var(--space-2) 0.625rem;
  border-radius: var(--radius-md);
  background: rgba(35, 104, 255, 0.08);
  color: var(--primary-500);
}

.post-count strong {
  font-size: var(--font-size-xl);
  line-height: 1;
}

.post-count span {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.post-preview {
  margin-top: var(--space-2);
  line-height: var(--line-height-relaxed);
}

.post-footer {
  align-items: center;
  margin-top: 10px;
}


/* Shadows are now handled via tokens on each panel class */

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.full-width {
  width: 100%;
}

@media (max-width: 900px) {
  .community-page {
    padding: 16px;
  }

  .community-shell {
    grid-template-columns: 1fr;
  }

  .community-aside {
    position: static;
  }

  .community-hero,
  .toolbar-row,
  .list-header,
  .post-card-top,
  .post-footer {
    flex-direction: column;
    align-items: stretch;
  }
}

/* Green community theme shared with the restored digital-human page. */
.community-page {
  --community-green: #24964e;
  --community-green-dark: #173f24;
  --community-muted: #55715c;
  min-height: calc(100dvh - 5.75rem);
  box-sizing: border-box;
  padding: 1rem;
  color: var(--community-green-dark);
  background:
    radial-gradient(circle at 14% 8%, rgba(255, 255, 255, 0.82), transparent 27%),
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.55), transparent 24%),
    linear-gradient(180deg, #eef7eb 0%, #d6f0ce 42%, #9ae686 74%, #59da48 100%);
}

.community-hero,
.community-shell {
  width: min(100%, 75rem);
  max-width: none;
}

.community-hero,
.toolbar-card,
.list-card,
.aside-block {
  border-color: rgba(46, 113, 53, 0.14);
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 1.25rem 3.5rem rgba(31, 106, 57, 0.1);
}

.hero-kicker,
.hot-tag,
.post-category {
  color: var(--community-green);
  background: rgba(36, 150, 78, 0.09);
}

.community-hero h1,
.list-header h2,
.aside-block strong,
.post-card h3,
.hero-stat strong {
  color: var(--community-green-dark);
}

.community-hero p,
.list-header p,
.aside-block p,
.aside-label,
.post-meta,
.post-preview,
.post-author,
.hero-stat span {
  color: var(--community-muted);
}

.community-shell { grid-template-columns: minmax(13rem, 15rem) minmax(0, 1fr); }
.post-card { border-color: rgba(46, 113, 53, 0.12); background: rgba(255, 255, 255, 0.72); }
.post-card:hover { border-color: rgba(36, 150, 78, 0.35); box-shadow: 0 0.85rem 2rem rgba(31, 106, 57, 0.12); }
.post-count { color: var(--community-green); background: rgba(36, 150, 78, 0.1); }

:deep(.el-button--primary) {
  border-color: var(--community-green);
  background: var(--community-green);
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-segmented) {
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important;
}

@media (max-width: 900px) {
  .community-page { padding: 0.75rem; }
  .community-shell { grid-template-columns: 1fr; }
}
</style>
