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

      <p
        v-if="replyNotice"
        class="reply-notice"
        :class="{ 'reply-notice--warning': replyNoticeWarning }"
        role="status"
      >
        {{ replyNotice }}
      </p>

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
        <p v-if="replyDraftRestored" class="draft-hint">已恢复本对话的回复草稿；提交成功或清空后才会删除。</p>
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
          <el-button text @click="discardReplyDraft">清空草稿</el-button>
          <el-button type="primary" :loading="replySubmitting || store.submitting" @click="submitReply">
            提交回复
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCommunityStore } from '@/store/community'
import { useAuthStore } from '@/store/auth'
import { formatDateTime } from '@/utils/date'
import {
  clearReplyDraft,
  communityDraftScope,
  readReplyDraft,
  saveReplyDraft,
} from '@/services/community-draft'

const props = defineProps<{
  postId: string
}>()

defineEmits<{
  (e: 'back-list'): void
}>()

const store = useCommunityStore()
const authStore = useAuthStore()

const replyForm = ref({
  authorName: '李同学',
  content: '',
})
const replySubmitting = ref(false)
const replyNotice = ref('')
const replyNoticeWarning = ref(false)
const replyDraftRestored = ref(false)
let replyNoticeTimer: number | undefined
let lastReplySignature = { signature: '', at: 0 }

// 6.2：回复草稿按身份 + 帖子 ID 隔离。
const draftScope = computed(() => communityDraftScope(authStore.userId || undefined))

const categoryLabel = computed(() => {
  const category = store.currentPost?.category
  const match = store.meta.categories.find((item) => item.value === category)
  return match?.label || category || '未分类'
})



const showReplyNotice = (message: string, warning = false) => {
  replyNotice.value = message
  replyNoticeWarning.value = warning
  window.clearTimeout(replyNoticeTimer)
  replyNoticeTimer = window.setTimeout(() => {
    replyNotice.value = ''
  }, 7000)
}

const restoreReplyDraft = (postId: string) => {
  if (!postId) return
  const draft = readReplyDraft(draftScope.value, postId)
  if (!draft) {
    replyDraftRestored.value = false
    return
  }
  replyForm.value.authorName = draft.authorName || replyForm.value.authorName
  replyForm.value.content = draft.content
  replyDraftRestored.value = true
}

const discardReplyDraft = () => {
  clearReplyDraft(draftScope.value, props.postId)
  replyForm.value.content = ''
  replyDraftRestored.value = false
  ElMessage.success('回复草稿已清空')
}

// 输入变化即时写草稿；离开或刷新后仍可恢复。
watch(
  [() => replyForm.value.authorName, () => replyForm.value.content, () => props.postId, draftScope],
  () => {
    saveReplyDraft(draftScope.value, props.postId, {
      authorName: replyForm.value.authorName,
      content: replyForm.value.content,
    })
  },
)

const submitReply = async () => {
  if (!store.currentPost) return
  if (!replyForm.value.authorName.trim() || !replyForm.value.content.trim()) {
    ElMessage.warning('请先填写昵称和回复内容')
    return
  }
  if (replySubmitting.value || store.submitting) return

  const payload = {
    authorName: replyForm.value.authorName.trim(),
    content: replyForm.value.content.trim(),
  }
  const signature = JSON.stringify(payload)
  if (signature === lastReplySignature.signature && Date.now() - lastReplySignature.at < 3000) {
    ElMessage.info('请勿重复提交')
    return
  }

  replySubmitting.value = true
  try {
    await store.submitReply(store.currentPost.id, payload)
    lastReplySignature = { signature, at: Date.now() }
    clearReplyDraft(draftScope.value, store.currentPost.id)
    replyForm.value.content = ''
    replyDraftRestored.value = false
    if (store.lastError) {
      showReplyNotice('回复已提交，但详情刷新失败，请手动刷新查看', true)
    } else {
      showReplyNotice('回复已提交，审核通过后展示')
    }
  } catch {
    ElMessage.error(store.lastError || '提交回复失败')
  } finally {
    replySubmitting.value = false
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
  restoreReplyDraft(props.postId)
})

onBeforeUnmount(() => {
  window.clearTimeout(replyNoticeTimer)
})

// 同一组件在 /community/posts/:postId 之间切换时不会重新挂载，需要按新 ID 重新加载。
watch(
  () => props.postId,
  async (postId) => {
    if (!postId) return
    replyForm.value.content = ''
    replyDraftRestored.value = false
    await store.loadPostDetail(postId)
    restoreReplyDraft(postId)
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
    linear-gradient(120deg, rgba(0, 91, 70, 0.08), transparent 48%),
    var(--paper-raised);
  box-shadow: var(--shadow-sm);
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

<style scoped>
/* 6.1：帖子详情沿用银白/深绿视觉。 */
.detail-page {
  width: min(100%, 56rem);
  margin: 0 auto;
  padding: clamp(1.5rem, 3vw, 2.5rem) 1.5rem 4rem;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-kicker {
  margin: 0 0 0.35rem;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.detail-header h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.3;
}

.detail-card,
.reply-card {
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  padding: clamp(1.25rem, 2.5vw, 1.75rem);
  background: var(--white);
}

.reply-card {
  margin-top: 1.25rem;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.8rem;
}

.meta-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.detail-content {
  margin: 1.25rem 0;
  color: var(--text);
  font-size: 1rem;
  line-height: 1.85;
  white-space: pre-wrap;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.knowledge-actions {
  margin-top: 1.25rem;
}

.reply-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.reply-header p {
  margin: 0.3rem 0 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.reply-item {
  border-top: 1px solid var(--soft);
  padding: 0.9rem 0;
}

.reply-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--muted);
  font-size: 0.8rem;
}

.reply-item-head strong {
  color: var(--text);
  font-weight: 600;
}

.reply-item-content {
  margin-top: 0.4rem;
  color: var(--text);
  font-size: 0.92rem;
  line-height: 1.75;
  white-space: pre-wrap;
}

.reply-editor {
  margin-top: 1.5rem;
  border-top: 1px solid var(--soft);
  padding-top: 1.25rem;
}

.reply-editor h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 47.99rem) {
  .detail-page {
    padding-inline: 1rem;
  }

  .detail-header {
    flex-direction: column;
  }
}
</style>

<style scoped>
/* 详情抬头不使用彩色卡片，保持银白页面层次。 */
.detail-header {
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
</style>

<style scoped>
/* 6.2：回复提交状态与草稿提示。 */
.reply-notice {
  margin: 0 0 0.9rem;
  border: 1px solid var(--tint);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.8rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.82rem;
}

.reply-notice--warning {
  border-color: var(--border);
  color: var(--text);
  background: var(--silver);
}

.draft-hint {
  margin: 0 0 0.75rem;
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.7rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.8rem;
}

.reply-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}
</style>
