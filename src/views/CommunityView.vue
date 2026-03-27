<template>
  <div class="community-page">
    <header class="community-hero">
      <div>
        <div class="hero-kicker">学生社区</div>
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
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(239, 255, 245, 0.95), rgba(214, 251, 210, 0.88) 42%, rgba(132, 224, 101, 0.92) 100%);
  color: #174d2e;
}

.community-hero,
.toolbar-card,
.list-card {
  max-width: 1180px;
  margin: 0 auto 18px;
  border: 1px solid rgba(83, 156, 89, 0.18);
  border-radius: 28px;
  background: rgba(251, 255, 248, 0.78);
  box-shadow: 0 18px 38px rgba(52, 118, 66, 0.12);
  backdrop-filter: blur(18px);
}

.community-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 28px;
}

.hero-kicker {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(122, 202, 117, 0.14);
  color: #2f7b40;
  font-size: 13px;
  font-weight: 700;
}

.community-hero h1,
.list-header h2 {
  margin: 10px 0 6px;
  font-size: 34px;
  line-height: 1.1;
}

.community-hero p,
.list-header p,
.post-meta,
.post-preview,
.post-author {
  margin: 0;
  color: rgba(23, 77, 46, 0.72);
}

.hero-actions,
.toolbar-row,
.dialog-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-card,
.list-card {
  padding: 22px 24px;
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
  margin-top: 16px;
}

.tag-row-label {
  font-size: 14px;
  font-weight: 700;
  color: #2f7b40;
}

.hot-tag {
  cursor: pointer;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.post-list {
  display: grid;
  gap: 16px;
}

.post-card {
  padding: 18px 18px 16px;
  border: 1px solid rgba(108, 180, 102, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.76);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(60, 133, 72, 0.12);
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
  margin: 0 0 6px;
  font-size: 22px;
  color: #174d2e;
}

.post-preview {
  margin-top: 12px;
  line-height: 1.75;
}

.post-footer {
  align-items: center;
  margin-top: 14px;
}

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

  .community-hero,
  .toolbar-row,
  .list-header,
  .post-card-top,
  .post-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
