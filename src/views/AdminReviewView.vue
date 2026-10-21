<template>
  <div class="admin-page">
    <header class="admin-hero">
      <div class="admin-hero__content">
        <div class="admin-kicker">KNOWLEDGE OPERATIONS</div>
        <h1 data-testid="knowledge-ops-title">知识运营后台</h1>
        <p>
          把分散的校园经验变成可追溯、可审核、可发布的知识，让服务台的下一次回答更可靠。
        </p>
        <ol class="admin-pipeline" aria-label="知识运营流程">
          <li><span>01</span>发现候选</li>
          <li><span>02</span>生成草稿</li>
          <li><span>03</span>人工审核</li>
          <li><span>04</span>发布检索</li>
        </ol>
      </div>

      <div class="admin-actions">
        <el-button round @click="$emit('go-login')">切换身份</el-button>
        <el-button type="danger" plain round @click="$emit('logout')">退出登录</el-button>
      </div>
    </header>

    <!-- 二级导航 -->
    <nav class="admin-subnav" aria-label="知识运营后台导航">
      <button
        type="button"
        class="admin-subnav__tab"
        :class="{ 'is-active': activeTab === 'review' }"
        @click="activeTab = 'review'"
      >
        知识运营
      </button>
      <button
        type="button"
        class="admin-subnav__tab"
        :class="{ 'is-active': activeTab === 'lightrag' }"
        @click="activeTab = 'lightrag'"
      >
        检索运行
      </button>
    </nav>

    <section v-show="activeTab === 'review'">
    <section class="stats-grid">
      <article class="stat-card stat-card--candidate">
        <span class="stat-card__label">候选知识</span>
        <strong class="stat-card__value">{{ store.knowledgeCandidates.length }}</strong>
        <span class="stat-card__hint">系统自动筛出的高价值帖子</span>
      </article>

      <article class="stat-card stat-card--knowledge">
        <span class="stat-card__label">待发布知识</span>
        <strong class="stat-card__value">{{ store.knowledgeItems.length }}</strong>
        <span class="stat-card__hint">已生成但尚未进入 RAG 的社区知识</span>
      </article>

      <article class="stat-card stat-card--post">
        <span class="stat-card__label">待审核帖子</span>
        <strong class="stat-card__value">{{ store.pendingPosts.length }}</strong>
        <span class="stat-card__hint">等待确认是否公开展示</span>
      </article>

      <article class="stat-card stat-card--reply">
        <span class="stat-card__label">待审核回复</span>
        <strong class="stat-card__value">{{ store.pendingReplies.length }}</strong>
        <span class="stat-card__hint">等待确认是否计入社区讨论</span>
      </article>
    </section>

    <el-alert
      v-if="store.lastError"
      :title="store.lastError"
      type="warning"
      show-icon
      :closable="false"
      class="page-alert"
    />

    <section class="board-section">
      <div class="board-section__header">
        <div>
          <div class="board-section__eyebrow">知识入库流水线</div>
          <h2>从高价值内容到可信答案</h2>
        </div>
        <div class="board-section__actions">
          <el-button text @click="reloadCandidates">刷新候选池</el-button>
          <el-button text @click="reloadKnowledge">刷新社区知识</el-button>
        </div>
      </div>

      <div class="board-grid board-grid--knowledge">
        <article class="panel-card">
          <div class="panel-card__header">
            <div>
              <h3>候选知识</h3>
              <p>系统根据分类、浏览、回复和点赞自动筛出的高价值帖子。</p>
            </div>
            <el-tag type="success" round>{{ store.knowledgeCandidates.length }} 条</el-tag>
          </div>

          <el-skeleton :loading="store.loadingReview" animated :rows="4">
            <template #default>
              <div v-if="store.knowledgeCandidates.length" class="item-list">
                <article v-for="post in store.knowledgeCandidates" :key="post.id" class="item-card">
                  <div class="item-card__head">
                    <div>
                      <h4>{{ post.title }}</h4>
                      <p>{{ post.authorName }} · {{ categoryLabelMap[post.category] || post.category }}</p>
                    </div>
                    <div class="item-card__badges">
                      <el-tag :type="knowledgeStatusTagType(post.knowledgeStatus)" round>
                        {{ knowledgeStatusLabel(post.knowledgeStatus) }}
                      </el-tag>
                      <el-tag type="success" round>候选分 {{ post.knowledgeCandidateScore ?? 0 }}</el-tag>
                    </div>
                  </div>

                  <p class="item-card__content">{{ post.contentPreview || post.content }}</p>

                  <div v-if="post.knowledgeCandidateReasons?.length" class="reason-list">
                    <span class="reason-list__label">入选原因</span>
                    <el-tag
                      v-for="reason in post.knowledgeCandidateReasons"
                      :key="reason"
                      size="small"
                      round
                      effect="plain"
                    >
                      {{ reason }}
                    </el-tag>
                  </div>

                  <div class="item-card__foot">
                    <span>浏览 {{ post.viewCount }} · 回复 {{ post.replyCount }} · 点赞 {{ post.likeCount }}</span>
                    <div class="item-card__actions">
                      <el-button size="small" plain @click="openPostDetail(post.id, '候选帖子详情')">
                        查看详情
                      </el-button>
                      <el-button size="small" type="primary" :loading="store.submitting" @click="buildKnowledge(post.id)">
                        生成知识草稿
                      </el-button>
                    </div>
                  </div>
                </article>
              </div>
              <el-empty v-else description="当前没有进入候选池的帖子" />
            </template>
          </el-skeleton>
        </article>

        <article class="panel-card">
          <div class="panel-card__header">
            <div>
              <h3>待发布知识</h3>
              <p>人工核对来源与表述后，内容才会参与服务台检索。</p>
            </div>
            <el-tag type="warning" round>{{ store.knowledgeItems.length }} 条</el-tag>
          </div>

          <el-skeleton :loading="store.loadingReview" animated :rows="4">
            <template #default>
              <div v-if="store.knowledgeItems.length" class="item-list">
                <article v-for="item in store.knowledgeItems" :key="item.id" class="item-card">
                  <div class="item-card__head">
                    <div>
                      <h4>{{ item.title }}</h4>
                      <p>
                        {{ categoryLabelMap[item.category] || item.category }} · {{ item.sourceType }} ·
                        可信度 {{ Math.round(item.confidence * 100) }}%
                      </p>
                    </div>
                    <el-tag type="warning" round>{{ item.status }}</el-tag>
                  </div>

                  <p class="item-card__content">{{ item.summary }}</p>

                  <div class="item-card__foot">
                    <span>{{ formatDateTime(item.updatedAt) }}</span>
                    <div class="item-card__actions">
                      <el-button size="small" plain @click="openPostDetail(item.postId, '社区知识来源帖子')">
                        查看来源帖子
                      </el-button>
                      <el-button size="small" type="success" :loading="store.submitting" @click="approveKnowledge(item.id)">
                        审核并发布
                      </el-button>
                      <el-button size="small" type="danger" plain :loading="store.submitting" @click="rejectKnowledge(item.id)">
                        拒绝
                      </el-button>
                    </div>
                  </div>
                </article>
              </div>
              <el-empty v-else description="当前没有待审核的社区知识条目" />
            </template>
          </el-skeleton>
        </article>
      </div>
    </section>

    <section class="board-section">
      <div class="board-section__header">
        <div>
          <div class="board-section__eyebrow">社区内容治理</div>
          <h2>审核公开内容，并沉淀可信经验</h2>
        </div>
        <div class="board-section__actions">
          <el-button text @click="reloadReviews">刷新审核列表</el-button>
        </div>
      </div>

      <div class="board-grid board-grid--content">
        <article class="panel-card">
          <div class="panel-card__header">
            <div>
              <h3>待审核帖子</h3>
              <p>先判断帖子能不能公开展示，再决定是否继续进入知识沉淀。</p>
            </div>
            <el-tag type="warning" round>{{ store.pendingPosts.length }} 条</el-tag>
          </div>

          <el-skeleton :loading="store.loadingReview" animated :rows="4">
            <template #default>
              <div v-if="store.pendingPosts.length" class="item-list">
                <article v-for="post in store.pendingPosts" :key="post.id" class="item-card">
                  <div class="item-card__head">
                    <div>
                      <h4>{{ post.title }}</h4>
                      <p>{{ post.authorName }} · {{ categoryLabelMap[post.category] || post.category }}</p>
                    </div>
                    <div class="item-card__badges">
                      <el-tag :type="knowledgeStatusTagType(post.knowledgeStatus)" round>
                        {{ knowledgeStatusLabel(post.knowledgeStatus) }}
                      </el-tag>
                      <el-tag type="warning" round>待审核</el-tag>
                    </div>
                  </div>

                  <p class="item-card__content">{{ post.content }}</p>

                  <div class="item-card__foot">
                    <span>{{ formatDateTime(post.createdAt) }}</span>
                    <div class="item-card__actions">
                      <el-button size="small" plain @click="openPostDetail(post.id, '待审核帖子详情')">
                        查看详情
                      </el-button>
                      <el-button size="small" type="primary" plain :loading="store.submitting" @click="approveAndBuild(post.id)">
                        通过并生成知识
                      </el-button>
                      <el-button size="small" type="success" :loading="store.submitting" @click="approvePost(post.id)">
                        通过
                      </el-button>
                      <el-button size="small" type="danger" plain :loading="store.submitting" @click="rejectPost(post.id)">
                        拒绝
                      </el-button>
                    </div>
                  </div>
                </article>
              </div>
              <el-empty v-else description="当前没有待审核帖子" />
            </template>
          </el-skeleton>
        </article>

        <article class="panel-card">
          <div class="panel-card__header">
            <div>
              <h3>待审核回复</h3>
              <p>回复通过后会计入社区讨论，也会影响候选池判断。</p>
            </div>
            <el-tag type="warning" round>{{ store.pendingReplies.length }} 条</el-tag>
          </div>

          <el-skeleton :loading="store.loadingReview" animated :rows="4">
            <template #default>
              <div v-if="store.pendingReplies.length" class="item-list">
                <article v-for="reply in store.pendingReplies" :key="reply.id" class="item-card">
                  <div class="item-card__head">
                    <div>
                      <h4>回复 ID：{{ reply.id }}</h4>
                      <p>{{ reply.authorName }} · 所属帖子：{{ reply.postId }}</p>
                    </div>
                    <el-tag type="warning" round>待审核</el-tag>
                  </div>

                  <p class="item-card__content">{{ reply.content }}</p>

                  <div class="item-card__foot">
                    <span>{{ formatDateTime(reply.createdAt) }}</span>
                    <div class="item-card__actions">
                      <el-button size="small" plain @click="openPostDetail(reply.postId, '回复所属帖子详情')">
                        查看所属帖子
                      </el-button>
                      <el-button size="small" type="success" :loading="store.submitting" @click="approveReply(reply.id)">
                        通过
                      </el-button>
                      <el-button size="small" type="danger" plain :loading="store.submitting" @click="rejectReply(reply.id)">
                        拒绝
                      </el-button>
                    </div>
                  </div>
                </article>
              </div>
              <el-empty v-else description="当前没有待审核回复" />
            </template>
          </el-skeleton>
        </article>
      </div>
    </section>

    <el-dialog
      v-model="detailDialogVisible"
      width="860px"
      destroy-on-close
      class="post-detail-dialog"
      :title="detailDialogTitle"
      @closed="store.clearCurrentPost()"
    >
      <el-skeleton :loading="store.loadingDetail" animated :rows="6">
        <template #default>
          <div v-if="store.currentPost" class="detail-panel">
            <section class="detail-block">
              <div class="detail-block__head">
                <div>
                  <h3>{{ store.currentPost.title }}</h3>
                  <p>
                    {{ store.currentPost.authorName }} ·
                    {{ categoryLabelMap[store.currentPost.category] || store.currentPost.category }}
                  </p>
                </div>
                <el-tag :type="statusTagType(store.currentPost.status)" round>
                  {{ statusLabel(store.currentPost.status) }}
                </el-tag>
              </div>

                <div class="detail-metrics">
                  <span>浏览 {{ store.currentPost.viewCount }}</span>
                  <span>回复 {{ store.currentPost.replyCount }}</span>
                  <span>点赞 {{ store.currentPost.likeCount }}</span>
                  <span>知识状态 {{ knowledgeStatusLabel(store.currentPost.knowledgeStatus) }}</span>
                  <span>更新时间 {{ formatDateTime(store.currentPost.updatedAt) }}</span>
                </div>

              <div v-if="store.currentPost.tags?.length" class="detail-tags">
                <el-tag
                  v-for="tag in store.currentPost.tags"
                  :key="tag"
                  size="small"
                  round
                  effect="plain"
                >
                  {{ tag }}
                </el-tag>
              </div>

              <p class="detail-content">{{ store.currentPost.content }}</p>
            </section>

            <section class="detail-block">
              <div class="detail-block__head">
                <div>
                  <h3>关联回复</h3>
                  <p>知识运营员可一起核对主帖和回复，再决定是否公开或沉淀为知识。</p>
                </div>
                <el-tag round>{{ store.currentReplies.length }} 条</el-tag>
              </div>

              <div v-if="store.currentReplies.length" class="reply-timeline">
                <article
                  v-for="reply in store.currentReplies"
                  :key="reply.id"
                  class="reply-timeline__item"
                >
                  <div class="reply-timeline__head">
                    <div>
                      <strong>{{ reply.authorName }}</strong>
                      <span> · {{ formatDateTime(reply.createdAt) }}</span>
                    </div>
                    <el-tag :type="statusTagType(reply.status)" round>
                      {{ statusLabel(reply.status) }}
                    </el-tag>
                  </div>
                  <p class="reply-timeline__content">{{ reply.content }}</p>
                </article>
              </div>
              <el-empty v-else description="这条帖子当前还没有回复" />
            </section>
          </div>
        </template>
      </el-skeleton>
    </el-dialog>
    </section>

    <!-- 检索运行面板 -->
    <section v-show="activeTab === 'lightrag'" class="lightrag-panel">
      <div class="lightrag-hero">
        <h2>知识检索运行中心</h2>
        <p>查看语义检索服务和知识文档处理状态。LightRAG 是当前检索引擎，异常时系统会回退到本地向量与关键词检索。</p>
      </div>

      <div class="lightrag-status-grid">
        <article class="lr-card">
          <span class="lr-card__label">服务状态</span>
          <strong class="lr-card__value" :class="lrHealthOk ? 'lr-card__value--ok' : 'lr-card__value--bad'">
            {{ lrHealthOk ? '运行中' : '未连接' }}
          </strong>
          <span class="lr-card__hint">LightRAG 核心 v{{ lrVersion || '-' }}</span>
        </article>
        <article class="lr-card">
          <span class="lr-card__label">已建图文档</span>
          <strong class="lr-card__value">{{ lrProcessed }}</strong>
          <span class="lr-card__hint">已成功构建图谱</span>
        </article>
        <article class="lr-card">
          <span class="lr-card__label">待处理</span>
          <strong class="lr-card__value">{{ lrPending }}</strong>
          <span class="lr-card__hint">pending / parsing / analyzing</span>
        </article>
        <article class="lr-card">
          <span class="lr-card__label">失败</span>
          <strong class="lr-card__value" :class="lrFailed > 0 ? 'lr-card__value--bad' : ''">{{ lrFailed }}</strong>
          <span class="lr-card__hint">建图失败文档数</span>
        </article>
      </div>

      <div class="lightrag-actions">
        <el-button type="primary" round :disabled="!lightragConsoleEnabled" @click="openLightragWebui">
          打开检索控制台
        </el-button>
        <el-button round :disabled="!lightragConsoleEnabled" @click="openLightragDocs">API 文档</el-button>
        <el-button round @click="refreshLightrag">刷新状态</el-button>
      </div>

      <p class="lightrag-tip">
        {{ lightragConsoleEnabled
          ? '检索服务会优先使用知识图谱，失败时回退到本地向量与关键词检索。'
          : '当前未配置外部检索控制台地址；状态检查仍通过受管理员保护的后端代理完成。' }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'
import { formatDateTime } from '@/utils/date'
import { apiUrl, appConfig } from '@/config/app'
import { getAuthRequestHeaders } from '@/api/auth'

const props = defineProps<{
  initialTab?: 'review' | 'lightrag'
}>()

defineEmits<{
  (e: 'go-login'): void
  (e: 'logout'): void
}>()

const store = useCommunityStore()
const detailDialogVisible = ref(false)
const detailDialogTitle = ref('帖子详情')

// 二级导航：内容审核 | LightRAG 管理
// 路由 /admin/retrieval 通过 initialTab 直接落在检索运行面板。
const activeTab = ref<'review' | 'lightrag'>(props.initialTab === 'lightrag' ? 'lightrag' : 'review')

watch(
  () => props.initialTab,
  (tab) => {
    if (tab) activeTab.value = tab
  },
)

const lrHealthOk = ref(false)
const lrVersion = ref('')
const lrProcessed = ref(0)
const lrPending = ref(0)
const lrFailed = ref(0)
const lightragConsoleEnabled = computed(() => Boolean(appConfig.lightragConsoleUrl))

const lrApiBase = () => apiUrl('/lightrag')
const listLen = (arr: unknown) => (Array.isArray(arr) ? arr.length : 0)
const lightragRequestOptions = () => ({
  headers: getAuthRequestHeaders(),
  credentials: 'include' as const,
})

const refreshLightrag = async () => {
  try {
    const health = await fetch(`${lrApiBase()}/health`, lightragRequestOptions()).then((r) => r.json())
    lrHealthOk.value = health?.status === 'healthy'
    lrVersion.value = health?.core_version || ''
  } catch {
    lrHealthOk.value = false
  }
  try {
    const docs = await fetch(`${lrApiBase()}/documents`, lightragRequestOptions()).then((r) => r.json())
    const s = docs?.statuses || {}
    lrProcessed.value = listLen(s.processed)
    lrFailed.value = listLen(s.failed)
    lrPending.value =
      listLen(s.pending) + listLen(s.parsing) + listLen(s.analyzing) + listLen(s.processing)
  } catch {
    /* 忽略统计失败 */
  }
}

const openLightragDocs = () => {
  if (!appConfig.lightragConsoleUrl) return
  window.open(`${appConfig.lightragConsoleUrl}/docs`, '_blank', 'noopener,noreferrer')
}

const openLightragWebui = () => {
  if (!appConfig.lightragConsoleUrl) return
  window.open(`${appConfig.lightragConsoleUrl}/webui/`, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  refreshLightrag()
})

const categoryLabelMap = computed(() =>
  Object.fromEntries(store.meta.categories.map((item) => [item.value, item.label])),
)



const statusLabel = (value: string) => {
  if (value === 'approved') return '已通过'
  if (value === 'rejected') return '已拒绝'
  return '待审核'
}

const statusTagType = (value: string) => {
  if (value === 'approved') return 'success'
  if (value === 'rejected') return 'danger'
  return 'warning'
}

const knowledgeStatusLabel = (value?: string) => {
  if (value === 'approved') return '已进入 RAG'
  if (value === 'pending') return '知识待审核'
  if (value === 'rejected') return '知识已拒绝'
  return '未入库'
}

const knowledgeStatusTagType = (value?: string) => {
  if (value === 'approved') return 'success'
  if (value === 'pending') return 'warning'
  if (value === 'rejected') return 'danger'
  return 'info'
}

const openPostDetail = async (postId: string, sourceLabel = '帖子详情') => {
  detailDialogTitle.value = sourceLabel
  detailDialogVisible.value = true

  try {
    await store.loadReviewPostDetail(postId)
  } catch {
    ElMessage.error(store.lastError || '帖子详情加载失败')
  }
}

const reloadReviews = async () => {
  await store.loadPendingReviews()
}

const reloadCandidates = async () => {
  await store.loadKnowledgeCandidates()
}

const reloadKnowledge = async () => {
  await store.loadKnowledgeItems()
}

const approvePost = async (postId: string) => {
  try {
    await store.approvePost(postId)
    ElMessage.success('帖子已审核通过')
  } catch {
    ElMessage.error(store.lastError || '帖子审核失败')
  }
}

const approveAndBuild = async (postId: string) => {
  try {
    await store.approvePost(postId)
    const result = await store.buildKnowledge(postId)
    ElMessage.success(`帖子已通过审核并生成社区知识：${result.knowledgeId}`)
  } catch {
    ElMessage.error(store.lastError || '通过并生成社区知识失败')
  }
}

const buildKnowledge = async (postId: string) => {
  try {
    const result = await store.buildKnowledge(postId)
    ElMessage.success(`社区知识已生成：${result.knowledgeId}`)
  } catch {
    ElMessage.error(store.lastError || '生成社区知识失败')
  }
}

const approveKnowledge = async (knowledgeId: string) => {
  try {
    await store.approveKnowledge(knowledgeId)
    ElMessage.success('社区知识已审核通过')
  } catch {
    ElMessage.error(store.lastError || '社区知识审核失败')
  }
}

const rejectKnowledge = async (knowledgeId: string) => {
  try {
    await store.rejectKnowledge(knowledgeId)
    ElMessage.success('社区知识已拒绝')
  } catch {
    ElMessage.error(store.lastError || '社区知识拒绝失败')
  }
}

const rejectPost = async (postId: string) => {
  try {
    await store.rejectPost(postId)
    ElMessage.success('帖子已拒绝')
  } catch {
    ElMessage.error(store.lastError || '帖子拒绝失败')
  }
}

const approveReply = async (replyId: string) => {
  try {
    await store.approveReply(replyId)
    ElMessage.success('回复已审核通过')
  } catch {
    ElMessage.error(store.lastError || '回复审核失败')
  }
}

const rejectReply = async (replyId: string) => {
  try {
    await store.rejectReply(replyId)
    ElMessage.success('回复已拒绝')
  } catch {
    ElMessage.error(store.lastError || '回复拒绝失败')
  }
}

onMounted(async () => {
  if (!store.meta.categories.length) {
    await store.loadMeta()
  }
  await store.loadKnowledgeCandidates()
  await store.loadKnowledgeItems()
  await store.loadPendingReviews()
})
</script>


<style scoped>
.admin-page {
  width: min(100%, 104rem);
  margin: 0 auto;
  padding-bottom: 4rem;
}

.admin-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: 1.4rem;
  color: var(--white);
  background: var(--ink);
  box-shadow: var(--shadow-sm);
}

.admin-hero::after {
  position: absolute;
  top: -5rem;
  right: -4rem;
  width: 15rem;
  height: 15rem;
  border: 1px solid rgba(255, 255, 255, 0.17);
  border-radius: 50%;
  content: "";
  box-shadow: 0 0 0 2.8rem rgba(255, 255, 255, 0.035), 0 0 0 5.6rem rgba(255, 255, 255, 0.02);
}

.admin-hero__content,
.admin-actions {
  position: relative;
  z-index: 1;
}

.admin-kicker,
.board-section__eyebrow {
  color: var(--sun);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.admin-hero h1 {
  margin: 0.7rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 10vw, 6rem);
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: -0.07em;
}

.admin-hero p {
  max-width: 52ch;
  margin: 1rem 0 0;
  color: rgba(255, 253, 248, 0.66);
  font-size: 0.86rem;
  line-height: 1.7;
}

.admin-pipeline {
  counter-reset: pipeline;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 1.2rem 0 0;
  padding: 1px;
  list-style: none;
  background: rgba(255, 255, 255, 0.18);
}

.admin-pipeline li {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
  padding: 0.7rem;
  background: var(--ink);
  font-size: 0.72rem;
  font-weight: 750;
}

.admin-pipeline span {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
}

.admin-actions {
  display: flex;
  gap: 0.55rem;
}

.admin-actions :deep(.el-button) {
  flex: 1;
  color: var(--white);
  background: transparent;
  border-color: rgba(255, 255, 255, 0.5);
}

.admin-subnav {
  position: sticky;
  top: 0.75rem;
  z-index: 10;
  display: flex;
  margin-top: 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  box-shadow: var(--shadow-sm);
}

.admin-subnav__tab {
  min-height: 3rem;
  flex: 1;
  border: 0;
  border-right: 1px solid var(--line);
  color: var(--ink-soft);
  background: transparent;
  font-weight: 850;
  cursor: pointer;
}

.admin-subnav__tab:last-child { border-right: 0; }
.admin-subnav__tab.is-active { color: var(--white); background: var(--ink); }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 1rem;
}

.stat-card {
  min-width: 0;
  min-height: 9rem;
  display: grid;
  align-content: space-between;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.9rem;
  background: var(--paper-raised);
}

.stat-card--candidate { box-shadow: inset 0 0.3rem 0 var(--signal); }
.stat-card--knowledge { box-shadow: inset 0 0.3rem 0 var(--teal); }
.stat-card--post { box-shadow: inset 0 0.3rem 0 var(--sun); }
.stat-card--reply { box-shadow: inset 0 0.3rem 0 var(--ink-soft); }

.stat-card__label,
.stat-card__hint {
  color: var(--ink-soft);
  font-size: 0.7rem;
  line-height: 1.45;
}

.stat-card__label {
  font-family: var(--font-mono);
  font-weight: 850;
}

.stat-card__value {
  font-family: var(--font-display);
  font-size: clamp(2rem, 9vw, 3.8rem);
  font-weight: 900;
  line-height: 1;
}

.page-alert { margin-top: 1rem; }

.board-section,
.lightrag-panel {
  margin-top: 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.board-section__header {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  border-bottom: 1px solid var(--line-strong);
}

.board-section__eyebrow {
  color: var(--signal);
}

.board-section__header h2,
.lightrag-hero h2 {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 5vw, 2.4rem);
  font-weight: 900;
}

.board-section__actions,
.item-card__actions,
.item-card__badges,
.reason-list,
.detail-tags,
.lightrag-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.board-grid {
  display: grid;
  gap: 1px;
  background: var(--line);
}

.panel-card {
  min-width: 0;
  padding: 1rem;
  background: var(--white);
}

.panel-card__header,
.item-card__head,
.item-card__foot,
.detail-block__head,
.reply-timeline__head {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.panel-card__header h3,
.item-card h4,
.detail-block h3 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 900;
}

.panel-card__header p,
.item-card__head p,
.item-card__foot,
.detail-block__head,
.reply-timeline__head {
  color: var(--ink-soft);
  font-size: 0.72rem;
  line-height: 1.55;
}

.item-list {
  display: grid;
  gap: 0.7rem;
  margin-top: 1rem;
}

.item-card,
.detail-block,
.reply-timeline__item {
  border: 1px solid var(--line);
  padding: 0.85rem;
  background: var(--paper-raised);
}

.item-card__content,
.detail-content,
.reply-timeline__content {
  margin: 0.75rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.65;
}

.item-card__foot {
  margin-top: 0.8rem;
  padding-top: 0.7rem;
  border-top: 1px dashed var(--line);
}

.reason-list {
  margin-top: 0.7rem;
}

.reason-list__label {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 900;
}

.detail-panel,
.reply-timeline {
  display: grid;
  gap: 0.7rem;
}

.detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.7rem;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.lightrag-panel {
  overflow: hidden;
}

.lightrag-hero {
  padding: 1.2rem;
  color: var(--white);
  background: var(--ink);
}

.lightrag-hero p,
.lightrag-tip {
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.65;
}

.lightrag-hero p { color: rgba(255, 253, 248, 0.65); }

.lightrag-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: var(--line);
}

.lr-card {
  min-height: 8rem;
  display: grid;
  align-content: space-between;
  padding: 0.9rem;
  background: var(--white);
}

.lr-card__label,
.lr-card__hint {
  color: var(--ink-soft);
  font-size: 0.68rem;
}

.lr-card__value {
  font-family: var(--font-display);
  font-size: 1.7rem;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.lr-card__value--ok { color: var(--teal); }
.lr-card__value--bad { color: var(--signal-dark); }

.lightrag-actions,
.lightrag-tip {
  padding: 1rem;
}

.post-detail-dialog :deep(.el-dialog__body) { max-height: 70vh; overflow: auto; }

@media (min-width: 48rem) {
  .admin-hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    padding: 2rem;
  }

  .admin-actions :deep(.el-button) { flex: 0 0 auto; }
  .admin-pipeline { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  .board-section__header,
  .panel-card__header,
  .item-card__head,
  .item-card__foot,
  .detail-block__head,
  .reply-timeline__head {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .board-section__header { padding: 1.3rem; }
  .panel-card { padding: 1.2rem; }
  .lightrag-status-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (min-width: 70rem) {
  .board-grid--knowledge { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .board-grid--content { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
