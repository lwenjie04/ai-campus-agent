<template>
  <!-- 4.4：来源卡统一展示类型、时效、日期、摘要、链接与附件。 -->
  <article class="rail-source">
    <div class="rail-source__tags">
      <span class="rail-source__tag">{{ sourceTypeTagLabel(source.type) }}</span>
      <span class="rail-source__validity">{{ sourceValidityLabel(source.validity) }}</span>
    </div>
    <p class="rail-source__title">{{ source.title || '未命名来源' }}</p>
    <p class="rail-source__meta">{{ sourceMetaText(source) }}</p>
    <p v-if="source.snippet" class="rail-source__snippet">{{ source.snippet }}</p>

    <a
      v-if="source.url"
      class="rail-source__link"
      :href="resolveSourceHref(source.url)"
      target="_blank"
      rel="noreferrer"
    >
      查看原文
      <img src="/icons/external-link.svg" alt="" aria-hidden="true" />
    </a>
    <button
      v-else-if="source.postId"
      type="button"
      class="rail-source__link"
      @click="emit('openPost', source.postId)"
    >
      查看来源帖子
      <img src="/icons/chevron-right.svg" alt="" aria-hidden="true" />
    </button>

    <div v-if="source.attachments && source.attachments.length > 0" class="rail-source__attachments">
      <a
        v-for="(attachment, index) in source.attachments"
        :key="`${attachment.name || 'attachment'}-${index}`"
        class="rail-source__attachment"
        :href="resolveSourceHref(attachment.url)"
        target="_blank"
        rel="noreferrer"
      >
        {{ attachment.name || `附件 ${index + 1}` }}
      </a>
    </div>

    <p v-if="source.note" class="rail-source__note">{{ source.note }}</p>
  </article>
</template>

<script setup lang="ts">
import type { MessageSource } from '@/types/agent'
import {
  resolveSourceHref,
  sourceMetaText,
  sourceTypeTagLabel,
  sourceValidityLabel,
} from '@/services/source-display'

defineProps<{
  source: MessageSource
}>()

const emit = defineEmits<{
  (e: 'openPost', postId: string): void
}>()
</script>

<style scoped>
.rail-source {
  margin-bottom: 0.85rem;
  border-radius: var(--radius-md);
  padding: 1rem;
  background: var(--silver);
}

.rail-source__tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.rail-source__tag {
  display: inline-block;
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.5rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.7rem;
}

.rail-source__validity {
  color: var(--faint);
  font-size: 0.7rem;
}

.rail-source__title {
  margin: 0.6rem 0 0.35rem;
  color: var(--text);
  font-size: 0.95rem;
  line-height: 1.5;
}

.rail-source__meta {
  margin: 0 0 0.5rem;
  color: var(--muted);
  font-size: 0.78rem;
}

.rail-source__snippet {
  margin: 0 0 0.5rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.6;
}

.rail-source__link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  padding: 0;
  color: var(--link);
  background: transparent;
  font-size: 0.82rem;
  cursor: pointer;
}

.rail-source__link img {
  width: 0.85rem;
  height: 0.85rem;
}

.rail-source__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.rail-source__attachment {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.55rem;
  color: var(--muted);
  font-size: 0.75rem;
  text-decoration: none;
}

.rail-source__note {
  margin: 0.45rem 0 0;
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.6;
}
</style>
