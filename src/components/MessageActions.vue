<template>
  <!-- 7.2：仅当服务端 feedbackEligible=true 时由父组件渲染，避免历史消息伪造资格。 -->
  <div class="feedback-actions">
    <template v-if="!recorded">
      <button
        type="button"
        class="action-btn"
        :disabled="submitting"
        aria-label="有帮助"
        @click="submit('helpful')"
      >
        <img src="/icons/thumbs-up.svg" alt="" aria-hidden="true" />
        有帮助
      </button>
      <button
        type="button"
        class="action-btn"
        :disabled="submitting"
        aria-label="没帮助"
        @click="submit('none')"
      >
        没帮助
      </button>
    </template>
    <span v-else class="feedback-recorded" role="status">
      已记录 · {{ recorded === 'helpful' ? '有帮助' : '没帮助' }}
    </span>

    <span v-if="errorText" class="feedback-error" role="status">
      {{ errorText }}
      <button v-if="canRetry" type="button" class="feedback-retry" @click="retry">重试</button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FeedbackError, submitAnswerFeedback, type FeedbackValue } from '@/api/feedback'

const props = defineProps<{
  requestId: string
  initialValue?: FeedbackValue
}>()

const emit = defineEmits<{
  (e: 'submitted', value: FeedbackValue): void
}>()

const recorded = ref<FeedbackValue | ''>(props.initialValue || '')
const submitting = ref(false)
const errorText = ref('')
const canRetry = ref(false)
let lastValue: FeedbackValue = 'helpful'

const mapError = (error: unknown) => {
  if (error instanceof FeedbackError) {
    if (error.code === 'RATE_LIMITED' || error.status === 429) {
      const seconds = error.retryAfterSeconds
      return {
        message: seconds ? `操作太频繁，请 ${seconds} 秒后再试` : '操作太频繁，请稍后再试',
        retry: true,
      }
    }
    if (error.code === 'FEEDBACK_NOT_ELIGIBLE' || error.status === 409) {
      return { message: '该回答暂不支持反馈', retry: false }
    }
    if (error.code === 'FEEDBACK_IDENTITY_REQUIRED' || error.status === 401) {
      return { message: '登录后可提交反馈', retry: false }
    }
    if (error.code === 'FEEDBACK_STORAGE_UNAVAILABLE' || error.status === 503) {
      return { message: '反馈暂不可用，请稍后再试', retry: true }
    }
  }
  return { message: '反馈提交失败，请稍后再试', retry: true }
}

const submit = async (value: FeedbackValue) => {
  if (submitting.value || recorded.value) return
  submitting.value = true
  errorText.value = ''
  canRetry.value = false
  lastValue = value

  try {
    await submitAnswerFeedback({ requestId: props.requestId, value })
    recorded.value = value
    emit('submitted', value)
  } catch (error) {
    const mapped = mapError(error)
    errorText.value = mapped.message
    canRetry.value = mapped.retry
  } finally {
    submitting.value = false
  }
}

const retry = () => {
  void submit(lastValue)
}
</script>

<style scoped>
.feedback-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  padding: 0;
  color: var(--muted);
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  color: var(--brand);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.action-btn img {
  width: 0.95rem;
  height: 0.95rem;
  opacity: 0.8;
}

.feedback-recorded {
  color: var(--brand);
  font-size: 0.8rem;
}

.feedback-error {
  color: var(--muted);
  font-size: 0.78rem;
}

.feedback-retry {
  border: 0;
  padding: 0;
  color: var(--link);
  background: transparent;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
}
</style>
