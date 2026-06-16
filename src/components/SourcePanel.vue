<template>
  <!--
    可复用的来源展示组件。
    使用 <details>/<summary> 实现展开/折叠，支持官方资料、社区经验和通用来源三种视觉风格。
    可在聊天消息、帖子详情、管理面板等场景复用。
  -->
  <details
    v-if="Array.isArray(sources) && sources.length > 0"
    class="source-panel"
    :class="{ 'source-panel--compact': compact }"
    :open="expanded"
  >
    <summary class="source-panel__summary">
      <span>已参考 {{ visibleSources.length }} 个来源</span>
      <span class="source-panel__hint">{{ expanded ? '收起详情' : '展开详情' }}</span>
    </summary>
    <div
      v-for="(source, index) in visibleSources"
      :key="`${source.title || 'src'}-${index}`"
      class="source-item"
      :class="`source-item--${getSourceTone(source.type)}`"
    >
      <!-- 标题行：来源名称 + 类型/可信度标签 -->
      <div class="source-head">
        <a
          v-if="source.url"
          class="source-link"
          :href="resolveSourceHref(source.url)"
          target="_blank"
          rel="noreferrer"
        >
          {{ source.title || `来源 ${index + 1}` }}
        </a>
        <span v-else class="source-link">{{ source.title || `来源 ${index + 1}` }}</span>

        <div class="source-meta">
          <span v-if="source.type" class="meta-chip type-chip">{{ getSourceTypeLabel(source.type) }}</span>
          <span v-if="typeof source.confidence === 'number'" class="meta-chip confidence-chip">
            可信度 {{ Math.round(source.confidence * 100) }}%
          </span>
        </div>
      </div>

      <!-- 主链接：正文链接或文件下载链接 -->
      <div v-if="source.url" class="source-link-row">
        <span class="source-label">{{ getPrimaryLinkKindLabel(source.url) }}</span>
        <a class="inline-link" :href="resolveSourceHref(source.url)" target="_blank" rel="noreferrer">
          {{ getPrimaryLinkActionLabel(source.url) }}
        </a>
      </div>

      <!-- 社区帖子链接 -->
      <div v-else-if="source.postId" class="source-link-row">
        <span class="source-label">来源帖子</span>
        <button type="button" class="inline-link inline-link--button" @click="emit('openCommunityPost', source.postId)">
          查看来源帖子
        </button>
      </div>

      <!-- 社区来源提示 -->
      <div v-if="source.note" class="source-note">
        {{ source.note }}
      </div>

      <!-- 附件列表 -->
      <div
        v-if="Array.isArray(source.attachments) && source.attachments.length > 0"
        class="source-attachments"
      >
        <div class="source-label">附件列表</div>
        <a
          v-for="(attachment, aIndex) in source.attachments"
          :key="`${attachment.name || 'att'}-${aIndex}`"
          class="attachment-link"
          :href="resolveSourceHref(attachment.url)"
          target="_blank"
          rel="noreferrer"
        >
          {{ attachment.name || `附件 ${aIndex + 1}` }}
        </a>
      </div>

      <!-- 文本片段预览 -->
      <div v-if="source.snippet" class="source-snippet">{{ source.snippet }}</div>
    </div>

    <!-- 更多来源提示 -->
    <div v-if="hasMore" class="source-panel__more">
      还有 {{ sources.length - maxVisible }} 个来源未展示
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MessageSource } from '@/types/agent'
import { appConfig } from '@/config/app'

const props = withDefaults(defineProps<{
  sources: MessageSource[]
  expanded?: boolean
  compact?: boolean
  maxVisible?: number
}>(), {
  expanded: false,
  compact: false,
  maxVisible: 5,
})

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

// ---- Computed ----

const visibleSources = computed(() => props.sources.slice(0, props.maxVisible))

const hasMore = computed(() => props.sources.length > props.maxVisible)

// ---- Link Resolution ----

const resolveSourceHref = (url?: string) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${appConfig.apiBaseUrl}${url}`
  return url
}

// ---- Type Label Helpers ----

const isFileLikeLink = (url?: string) => {
  if (!url) return false
  if (url.startsWith('/kb/download') || url.startsWith('/api/kb/download')) return true
  return /\.(pdf|doc|docx|xls|xlsx|zip|rar|7z|ppt|pptx|txt)(?:$|\?)/i.test(url)
}

const getPrimaryLinkKindLabel = (url?: string) =>
  isFileLikeLink(url) ? '来源文件' : '正文链接'

const getPrimaryLinkActionLabel = (url?: string) =>
  isFileLikeLink(url) ? '下载/打开文件' : '打开通知页面'

const getSourceTypeLabel = (type?: string) => {
  const value = String(type || '')
  if (/community/i.test(value)) return '社区经验'
  if (/handbook|student/i.test(value)) return '学生手册'
  if (/official|notice|attachment|rule/i.test(value)) return '官方资料'
  return value.replace(/_/g, ' ')
}

const getSourceTone = (type?: string) => {
  const value = String(type || '')
  if (/community/i.test(value)) return 'community'
  if (/official|notice|attachment|rule|handbook|student/i.test(value)) return 'official'
  return 'neutral'
}
</script>

<style scoped>
/* ---- Root Panel ---- */
.source-panel {
  margin-top: var(--space-2);
  max-width: min(100%, 47.5rem);
  border-radius: var(--radius-md);
  padding: 0;
  background: var(--dark-surface-soft);
  border: 1px solid var(--dark-line);
  overflow: hidden;
}

.source-panel--compact {
  max-width: 100%;
}

/* ---- Summary Toggle ---- */
.source-panel__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  color: rgba(238, 244, 255, 0.9);
  cursor: pointer;
  font-weight: var(--font-weight-bold);
  list-style: none;
}

.source-panel__summary::-webkit-details-marker {
  display: none;
}

.source-panel__summary::after {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid rgba(103, 232, 249, 0.86);
  border-bottom: 2px solid rgba(103, 232, 249, 0.86);
  transform: rotate(45deg);
  transition: transform var(--transition-fast);
}

.source-panel[open] .source-panel__summary::after {
  transform: rotate(225deg);
}

.source-panel__hint {
  margin-left: auto;
  color: rgba(103, 232, 249, 0.78);
  font-size: var(--font-size-xs);
}

/* ---- Source Item ---- */
.source-item {
  margin: 0 var(--space-3) var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--dark-surface-soft);
  border: 1px solid var(--dark-line);
}

.source-item--official {
  border-color: rgba(72, 223, 155, 0.28);
}

.source-item--community {
  border-color: rgba(246, 191, 117, 0.28);
}

/* ---- Source Head ---- */
.source-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.source-link {
  color: #dfe8ff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-black);
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xxs);
  line-height: 1.2;
  border: 1px solid var(--dark-line);
  background: var(--dark-surface-soft);
  color: rgba(238, 244, 255, 0.8);
  white-space: nowrap;
}

.confidence-chip {
  color: var(--accent-cyan);
}

/* ---- Snippet ---- */
.source-snippet {
  margin-top: 0.25rem;
  font-size: var(--font-size-xs);
  color: rgba(217, 227, 255, 0.72);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---- Link Row ---- */
.source-link-row {
  margin-top: 0.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.source-note {
  margin-top: 0.25rem;
  padding: 0.375rem var(--space-2);
  border-radius: 0.625rem;
  background: rgba(255, 244, 214, 0.12);
  border: 1px solid rgba(214, 171, 58, 0.2);
  color: var(--warning-amber);
  font-size: var(--font-size-xxs);
  line-height: 1.4;
}

.source-label {
  font-size: var(--font-size-xxs);
  color: rgba(217, 227, 255, 0.62);
  font-weight: 600;
}

.inline-link,
.attachment-link {
  color: var(--accent-cyan);
  text-decoration: none;
  border-bottom: 1px dashed rgba(103, 232, 249, 0.35);
}

.inline-link--button {
  padding: 0;
  background: transparent;
  border-top: 0;
  border-left: 0;
  border-right: 0;
  border-bottom-style: dashed;
  font: inherit;
  cursor: pointer;
}

.inline-link:hover,
.attachment-link:hover,
.inline-link--button:hover {
  border-bottom-style: solid;
}

.inline-link {
  font-size: var(--font-size-xs);
}

/* ---- Attachments ---- */
.source-attachments {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.attachment-link {
  width: fit-content;
  max-width: 100%;
  font-size: var(--font-size-xs);
  word-break: break-all;
}

/* ---- More Indicator ---- */
.source-panel__more {
  margin: 0 var(--space-3) var(--space-3);
  padding: var(--space-2);
  text-align: center;
  color: var(--dark-muted);
  font-size: var(--font-size-xs);
  border-top: 1px solid var(--dark-line);
  padding-top: var(--space-2);
}

/* ---- Mobile ---- */
@media (max-width: 680px) {
  .source-head {
    flex-direction: column;
    gap: 0.25rem;
  }

  .source-meta {
    justify-content: flex-start;
  }
}
</style>
