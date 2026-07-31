<template>
  <div class="admin-page">
    <header class="admin-hero">
      <div class="admin-hero__content">
        <div class="admin-kicker">管理员工作台</div>
        <h1>学生社区审核中心</h1>
        <p>
          这里负责处理帖子、回复和社区知识条目。我们把“候选筛选、知识沉淀、内容审核”拆开，方便你快速定位当前该处理的工作。
        </p>
      </div>

      <div class="admin-actions">
        <el-button round @click="$emit('go-login')">切换账号</el-button>
        <el-button type="danger" plain round @click="$emit('logout')">退出登录</el-button>
      </div>
    </header>

    <section class="stats-grid">
      <article class="stat-card stat-card--candidate">
        <span class="stat-card__label">待入库候选</span>
        <strong class="stat-card__value">{{ store.knowledgeCandidates.length }}</strong>
        <span class="stat-card__hint">系统自动筛出的高价值帖子</span>
      </article>

      <article class="stat-card stat-card--knowledge">
        <span class="stat-card__label">待审核知识</span>
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
          <div class="board-section__eyebrow">知识沉淀</div>
          <h2>先筛候选，再决定能不能进入问答系统</h2>
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
              <h3>待入库候选帖子</h3>
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
                        生成社区知识
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
              <h3>待审核社区知识</h3>
              <p>这里通过后，社区知识才会真正参与 RAG。</p>
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
                    <span>{{ formatDate(item.updatedAt) }}</span>
                    <div class="item-card__actions">
                      <el-button size="small" plain @click="openPostDetail(item.postId, '社区知识来源帖子')">
                        查看来源帖子
                      </el-button>
                      <el-button size="small" type="success" :loading="store.submitting" @click="approveKnowledge(item.id)">
                        通过
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
          <div class="board-section__eyebrow">内容审核</div>
          <h2>社区展示内容的最终入口</h2>
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
                    <span>{{ formatDate(post.createdAt) }}</span>
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
                    <span>{{ formatDate(reply.createdAt) }}</span>
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
                  <span>更新时间 {{ formatDate(store.currentPost.updatedAt) }}</span>
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
                  <p>管理员在这里可以一起查看主帖和回复，再决定是否通过或入库。</p>
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
                      <span> · {{ formatDate(reply.createdAt) }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'

defineEmits<{
  (e: 'go-login'): void
  (e: 'logout'): void
}>()

const store = useCommunityStore()
const detailDialogVisible = ref(false)
const detailDialogTitle = ref('帖子详情')

const categoryLabelMap = computed(() =>
  Object.fromEntries(store.meta.categories.map((item) => [item.value, item.label])),
)

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

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
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top center, rgba(245, 255, 242, 0.97), rgba(223, 250, 214, 0.92) 40%, rgba(139, 224, 101, 0.96) 100%);
  color: #174d2e;
}

.admin-hero,
.stats-grid,
.board-section {
  max-width: 1380px;
  margin: 0 auto 18px;
}

.admin-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 26px 28px;
  border: 1px solid rgba(83, 156, 89, 0.18);
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(251, 255, 248, 0.9), rgba(240, 255, 235, 0.82));
  box-shadow: 0 18px 38px rgba(52, 118, 66, 0.12);
  backdrop-filter: blur(18px);
}

.admin-hero__content {
  max-width: 760px;
}

.admin-kicker {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(122, 202, 117, 0.14);
  color: #2f7b40;
  font-size: 13px;
  font-weight: 800;
}

.admin-hero h1,
.board-section__header h2,
.panel-card__header h3,
.item-card__head h4 {
  margin: 10px 0 0;
}

.admin-hero p,
.board-section__header p,
.panel-card__header p,
.item-card__head p,
.item-card__foot span,
.stat-card__hint {
  margin: 0;
  color: rgba(23, 77, 46, 0.72);
}

.admin-actions,
.board-section__actions,
.panel-card__header,
.item-card__head,
.item-card__foot,
.item-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.item-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(83, 156, 89, 0.16);
  background: rgba(252, 255, 250, 0.82);
  box-shadow: 0 14px 28px rgba(52, 118, 66, 0.08);
}

.stat-card__label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #317541;
}

.stat-card__value {
  display: block;
  margin-top: 8px;
  font-size: 34px;
  line-height: 1;
  color: #1c5c36;
}

.stat-card__hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.stat-card--candidate {
  background: linear-gradient(135deg, rgba(248, 255, 245, 0.96), rgba(226, 250, 213, 0.88));
}

.stat-card--knowledge {
  background: linear-gradient(135deg, rgba(255, 252, 244, 0.96), rgba(250, 242, 213, 0.88));
}

.stat-card--post {
  background: linear-gradient(135deg, rgba(248, 251, 255, 0.96), rgba(225, 241, 255, 0.88));
}

.stat-card--reply {
  background: linear-gradient(135deg, rgba(255, 248, 251, 0.96), rgba(252, 228, 236, 0.88));
}

.page-alert {
  max-width: 1380px;
  margin: 0 auto 18px;
}

.board-section {
  padding: 22px 24px 24px;
  border: 1px solid rgba(83, 156, 89, 0.18);
  border-radius: 28px;
  background: rgba(251, 255, 248, 0.82);
  box-shadow: 0 18px 38px rgba(52, 118, 66, 0.12);
  backdrop-filter: blur(18px);
}

.board-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.board-section__eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(114, 193, 109, 0.14);
  color: #357743;
  font-size: 12px;
  font-weight: 800;
}

.board-grid {
  display: grid;
  gap: 18px;
}

.board-grid--knowledge {
  grid-template-columns: 1.15fr 1fr;
}

.board-grid--content {
  grid-template-columns: 1fr 1fr;
}

.panel-card {
  min-width: 0;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(108, 180, 102, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.item-list {
  display: grid;
  gap: 14px;
}

.item-card {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(108, 180, 102, 0.18);
  background: rgba(248, 255, 245, 0.74);
}

.item-card__content {
  margin: 10px 0 0;
  white-space: pre-wrap;
  line-height: 1.75;
  color: #214f31;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.reason-list__label {
  color: rgba(23, 77, 46, 0.72);
  font-size: 13px;
  font-weight: 700;
}

.item-card__foot {
  margin-top: 14px;
}

.detail-panel {
  display: grid;
  gap: 16px;
}

.detail-block {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(108, 180, 102, 0.18);
  background: rgba(248, 255, 245, 0.78);
}

.detail-block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-block__head h3 {
  margin: 0;
}

.detail-block__head p {
  margin: 6px 0 0;
  color: rgba(23, 77, 46, 0.72);
}

.detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-top: 12px;
  color: rgba(23, 77, 46, 0.72);
  font-size: 13px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.detail-content {
  margin: 14px 0 0;
  white-space: pre-wrap;
  line-height: 1.85;
  color: #214f31;
}

.reply-timeline {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.reply-timeline__item {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(108, 180, 102, 0.16);
}

.reply-timeline__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.reply-timeline__head span {
  color: rgba(23, 77, 46, 0.72);
  font-size: 13px;
}

.reply-timeline__content {
  margin: 10px 0 0;
  white-space: pre-wrap;
  line-height: 1.75;
  color: #214f31;
}

@media (max-width: 1180px) {
  .stats-grid,
  .board-grid--knowledge,
  .board-grid--content {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 820px) {
  .admin-page {
    padding: 16px;
  }

  .admin-hero,
  .board-section__header,
  .panel-card__header,
  .item-card__head,
  .item-card__foot,
  .detail-block__head,
  .reply-timeline__head {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-grid,
  .board-grid--knowledge,
  .board-grid--content {
    grid-template-columns: 1fr;
  }
}
</style>
