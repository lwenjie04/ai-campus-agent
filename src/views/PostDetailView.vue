<template>
  <div class="detail-page">
    <header class="detail-header">
      <div>
        <div class="detail-kicker">帖子详情</div>
        <h1>{{ store.currentPost?.title || '正在加载帖子' }}</h1>
      </div>

      <div class="detail-actions">
        <el-button round @click="$emit('back-list')">返回社区</el-button>
      </div>
    </header>

    <section class="detail-card">
      <el-skeleton :loading="store.loadingDetail" animated :rows="6">
        <template #default>
          <template v-if="store.currentPost">
            <div class="detail-meta">
              <div class="meta-group">
                <el-tag round type="success">{{ categoryLabel }}</el-tag>
                <span>发布者：{{ store.currentPost.authorName }}</span>
                <span>浏览：{{ store.currentPost.viewCount }}</span>
                <span>回复：{{ store.currentPost.replyCount }}</span>
              </div>
              <span>{{ formatDate(store.currentPost.createdAt) }}</span>
            </div>

            <div class="detail-content">{{ store.currentPost.content }}</div>

            <div class="detail-tags">
              <el-tag v-for="tag in store.currentPost.tags" :key="tag" round effect="plain">
                {{ tag }}
              </el-tag>
            </div>

            <div class="knowledge-actions">
              <el-button type="success" plain :loading="store.submitting" @click="onGenerateKnowledge">
                生成社区知识摘要
              </el-button>
            </div>
          </template>

          <el-empty v-else description="帖子不存在或加载失败" />
        </template>
      </el-skeleton>
    </section>

    <section class="reply-card">
      <div class="reply-header">
        <div>
          <h2>回复区</h2>
          <p>当前已展示 {{ store.currentReplies.length }} 条已通过审核的回复</p>
        </div>
      </div>

      <el-alert v-if="store.lastError" :title="store.lastError" type="warning" show-icon :closable="false" />

      <div v-if="store.currentReplies.length" class="reply-list">
        <article v-for="reply in store.currentReplies" :key="reply.id" class="reply-item">
          <div class="reply-item-head">
            <strong>{{ reply.authorName }}</strong>
            <span>{{ formatDate(reply.createdAt) }}</span>
          </div>
          <div class="reply-item-content">{{ reply.content }}</div>
        </article>
      </div>
      <el-empty v-else description="还没有公开回复，欢迎参与讨论" />

      <div class="reply-editor">
        <h3>参与回复</h3>
        <el-form label-position="top">
          <el-form-item label="昵称">
            <el-input v-model="replyForm.authorName" maxlength="20" placeholder="例如：李同学" />
          </el-form-item>
          <el-form-item label="回复内容">
            <el-input
              v-model="replyForm.content"
              type="textarea"
              :rows="4"
              maxlength="800"
              show-word-limit
              placeholder="欢迎补充你的办理经验、注意事项或建议。"
            />
          </el-form-item>
        </el-form>

        <div class="reply-actions">
          <el-button type="primary" :loading="store.submitting" @click="submitReply">提交回复</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'

const props = defineProps<{
  postId: string
}>()

const emit = defineEmits<{
  (e: 'back-list'): void
}>()

const store = useCommunityStore()

const replyForm = ref({
  authorName: '李同学',
  content: '',
})

const categoryLabel = computed(() => {
  const category = store.currentPost?.category
  const match = store.meta.categories.find((item) => item.value === category)
  return match?.label || category || '未分类'
})

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const submitReply = async () => {
  if (!store.currentPost) return
  if (!replyForm.value.authorName.trim() || !replyForm.value.content.trim()) {
    ElMessage.warning('请先填写昵称和回复内容')
    return
  }

  try {
    await store.submitReply(store.currentPost.id, {
      authorName: replyForm.value.authorName.trim(),
      content: replyForm.value.content.trim(),
    })
    replyForm.value.content = ''
    ElMessage.success('回复已提交，当前默认进入待审核状态')
  } catch {
    ElMessage.error(store.lastError || '提交回复失败')
  }
}

const onGenerateKnowledge = async () => {
  if (!store.currentPost) return
  try {
    const result = await store.buildKnowledge(store.currentPost.id)
    ElMessage.success(`社区知识条目已生成：${result.knowledgeId}`)
  } catch {
    ElMessage.error(store.lastError || '生成社区知识失败')
  }
}

onMounted(async () => {
  if (!store.meta.categories.length) {
    await store.loadMeta()
  }
  await store.loadPostDetail(props.postId)
})
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top right, rgba(246, 255, 243, 0.96), rgba(217, 249, 208, 0.9) 38%, rgba(134, 223, 97, 0.94) 100%);
  color: #174d2e;
}

.detail-header,
.detail-card,
.reply-card {
  max-width: 1080px;
  margin: 0 auto 18px;
  border: 1px solid rgba(83, 156, 89, 0.18);
  border-radius: 28px;
  background: rgba(251, 255, 248, 0.78);
  box-shadow: 0 18px 38px rgba(52, 118, 66, 0.12);
  backdrop-filter: blur(18px);
}

.detail-header,
.detail-card,
.reply-card {
  padding: 24px 28px;
}

.detail-header,
.detail-meta,
.reply-item-head,
.reply-actions,
.detail-actions,
.knowledge-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-kicker {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(122, 202, 117, 0.14);
  color: #2f7b40;
  font-size: 13px;
  font-weight: 700;
}

.detail-header h1,
.reply-header h2,
.reply-editor h3 {
  margin: 10px 0 0;
}

.detail-meta {
  margin-bottom: 18px;
  color: rgba(23, 77, 46, 0.72);
  font-size: 14px;
}

.meta-group,
.detail-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-content,
.reply-item-content {
  white-space: pre-wrap;
  line-height: 1.85;
}

.detail-tags,
.knowledge-actions,
.reply-editor {
  margin-top: 18px;
}

.reply-list {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.reply-item {
  padding: 16px;
  border: 1px solid rgba(108, 180, 102, 0.18);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
}

.reply-item-head {
  color: rgba(23, 77, 46, 0.7);
  font-size: 14px;
  margin-bottom: 8px;
}

@media (max-width: 900px) {
  .detail-page {
    padding: 16px;
  }

  .detail-header,
  .detail-meta,
  .reply-item-head,
  .reply-actions,
  .detail-actions,
  .knowledge-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
