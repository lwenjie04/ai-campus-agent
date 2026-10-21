<template>
  <div class="community-page">
    <header class="community-hero">
      <div>
        <div class="hero-kicker">校园社区</div>
        <h1>校园互助交流区</h1>
        <p>同学们可以在这里提问、分享经验，后续高质量内容会经过审核沉淀为社区知识来源。</p>
      </div>

      <div class="hero-actions">
        <el-button type="primary" round @click="editorVisible = true">发布帖子</el-button>
      </div>
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

        <el-segmented
          v-model="sortBy"
          :options="sortOptions"
          @change="applyFilters"
        />
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
                  <h3>{{ post.title }}</h3>
                  <p class="post-meta">
                    {{ categoryLabelMap[post.category] || post.category }} · {{ formatDate(post.createdAt) }}
                  </p>
                </div>
                <el-tag round type="success">{{ post.replyCount }} 条回复</el-tag>
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
                <span class="post-author">发布者：{{ post.authorName }}</span>
              </div>
            </article>
          </div>

          <el-empty v-else description="当前还没有匹配的帖子，欢迎发布第一条讨论" />
        </template>
      </el-skeleton>
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
import { formatDate } from '@/utils/date'

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
  width: min(100%, 92rem);
  margin: 0 auto;
  padding-bottom: 3rem;
}

.community-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: 1.5rem 1.2rem;
  color: var(--white);
  background: var(--ink);
  box-shadow: var(--shadow-sm);
}

.community-hero::after {
  position: absolute;
  right: -3rem;
  bottom: -5rem;
  width: 14rem;
  height: 14rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  content: "";
  box-shadow: 0 0 0 2rem rgba(255, 255, 255, 0.04), 0 0 0 4rem rgba(255, 255, 255, 0.025);
}

.hero-kicker {
  color: var(--sun);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.community-hero h1 {
  max-width: 10ch;
  margin: 0.7rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 11vw, 6rem);
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: -0.07em;
}

.community-hero p {
  max-width: 48ch;
  margin: 1rem 0 0;
  color: rgba(255, 253, 248, 0.67);
  font-size: 0.88rem;
  line-height: 1.7;
}

.hero-actions {
  position: relative;
  z-index: 1;
}

.hero-actions :deep(.el-button) {
  width: 100%;
  border-color: var(--white);
  color: var(--ink);
  background: var(--sun);
}

.toolbar-card,
.list-card {
  margin-top: 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.toolbar-card {
  padding: 0.9rem;
  box-shadow: var(--shadow-sm);
}

.toolbar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}

.toolbar-search,
.toolbar-select {
  width: 100%;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  overflow-x: auto;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--line);
  scrollbar-width: none;
}

.tag-row-label {
  flex: 0 0 auto;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 850;
}

.hot-tag {
  flex: 0 0 auto;
  cursor: pointer;
}

.list-card {
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 1.1rem;
  border-bottom: 1px solid var(--line-strong);
}

.list-header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 900;
}

.list-header p {
  margin: 0.25rem 0 0;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.68rem;
}

.post-list {
  display: grid;
}

.post-card {
  position: relative;
  min-width: 0;
  display: grid;
  gap: 0.8rem;
  border-bottom: 1px solid var(--line);
  padding: 1rem;
  background: var(--white);
  cursor: pointer;
  transition: background 180ms ease, transform 180ms var(--ease-out);
}

.post-card::before {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 900;
  content: "COMMUNITY NOTE";
}

.post-card:hover {
  z-index: 1;
  background: var(--tint);
  transform: translateY(-0.2rem);
}

.post-card-top {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.post-card h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 900;
  line-height: 1.35;
}

.post-meta,
.post-author {
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.post-preview {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.84rem;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.post-footer,
.post-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.post-footer {
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 0.7rem;
  border-top: 1px dashed var(--line);
}

.post-tags {
  flex-wrap: wrap;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.full-width {
  width: 100%;
}

@media (min-width: 48rem) {
  .community-hero {
    min-height: 20rem;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    padding: 2rem;
  }

  .hero-actions :deep(.el-button) {
    width: auto;
  }

  .toolbar-card {
    padding: 1rem;
  }

  .toolbar-row {
    grid-template-columns: minmax(15rem, 1fr) minmax(9rem, 0.35fr) auto;
    align-items: center;
  }

  .post-card-top,
  .post-footer {
    flex-direction: row;
    align-items: flex-start;
  }
}

@media (min-width: 64rem) {
  .post-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .post-card:nth-child(odd) {
    border-right: 1px solid var(--line);
  }

  .post-card {
    min-height: 16rem;
    align-content: space-between;
    padding: 1.3rem;
  }
}
</style>
