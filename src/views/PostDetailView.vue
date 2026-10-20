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
              <span>{{ formatDateTime(store.currentPost.createdAt) }}</span>
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
            <span>{{ formatDateTime(reply.createdAt) }}</span>
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
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'
import { formatDateTime } from '@/utils/date'

const props = defineProps<{
  postId: string
}>()

defineEmits<{
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

// 同一组件在 /community/posts/:postId 之间切换时不会重新挂载，需要按新 ID 重新加载。
watch(
  () => props.postId,
  async (postId) => {
    if (!postId) return
    await store.loadPostDetail(postId)
  },
)
</script>


<style scoped>
.detail-page {
  width: min(100%, 82rem);
  margin: 0 auto;
  padding-bottom: 3rem;
}

.detail-header {
  display: flex;
  flex-direction: column-reverse;
  gap: 1.2rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: 1.2rem;
  background:
    linear-gradient(120deg, rgba(240, 79, 47, 0.14), transparent 48%),
    var(--paper-raised);
  box-shadow: 0 0.3rem 0 var(--ink);
}

.detail-kicker {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.detail-header h1 {
  max-width: 22ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 9vw, 4.5rem);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.055em;
}

.detail-actions :deep(.el-button) {
  width: 100%;
}

.detail-card,
.reply-card {
  margin-top: 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.detail-card {
  padding: 1rem;
}

.detail-meta,
.meta-group,
.detail-tags,
.reply-item-head,
.reply-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.detail-meta {
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.9rem;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.detail-content {
  max-width: 72ch;
  margin: 1.4rem auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 1.02rem;
  line-height: 2;
}

.detail-tags {
  justify-content: center;
  border-top: 1px dashed var(--line);
  padding-top: 0.9rem;
}

.knowledge-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.reply-card {
  overflow: hidden;
}

.reply-header {
  padding: 1rem;
  border-bottom: 1px solid var(--line-strong);
}

.reply-header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 900;
}

.reply-header p {
  margin: 0.25rem 0 0;
  color: var(--ink-soft);
  font-size: 0.8rem;
}

.reply-list {
  display: grid;
}

.reply-item {
  padding: 1rem;
  border-bottom: 1px solid var(--line);
  background: var(--white);
}

.reply-item:nth-child(even) {
  background: var(--paper-raised);
}

.reply-item-head {
  justify-content: space-between;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.67rem;
}

.reply-item-head strong {
  color: var(--ink);
  font-size: 0.75rem;
}

.reply-item-content {
  margin-top: 0.75rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  line-height: 1.75;
}

.reply-editor {
  padding: 1rem;
  background: var(--paper-deep);
}

.reply-actions {
  justify-content: flex-end;
  margin-top: 0.65rem;
}

@media (min-width: 48rem) {
  .detail-header {
    min-height: 15rem;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    padding: 1.8rem;
  }

  .detail-actions :deep(.el-button) {
    width: auto;
  }

  .detail-card,
  .reply-header,
  .reply-editor,
  .reply-item {
    padding: 1.4rem;
  }
}
</style>
