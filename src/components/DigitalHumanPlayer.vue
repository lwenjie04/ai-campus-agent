<template>
  <section class="agent-core-panel" :class="stageClass">
    <div class="agent-core-stage" aria-label="Prism Core 抽象智能体展示">
      <RobotAvatar
        class="agent-core-scene"
        :cue-key="normalizedCue"
        variant="panel"
        :source-count="normalizedSourceCount"
      />

      <div class="caption">
        <span>{{ statusLabel }}</span>
        <strong>{{ sourceTraceLabel }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { requestBackendTts } from '@/api/tts'
import RobotAvatar from '@/components/RobotAvatar.vue'

const props = defineProps<{
  cueKey: string
  playSignal: number
  narrationText?: string
  narrationSignal?: number
  stopSignal?: number
  sourceCount?: number
}>()

const emit = defineEmits<{
  (e: 'request-idle'): void
  (e: 'narration-ended'): void
}>()

const narrationAudioRef = ref<HTMLAudioElement | null>(null)
const activeAudioUrl = ref('')
const narrationToken = ref(0)
const narrationQueue = ref<string[]>([])
const narrationProcessing = ref(false)

const TTS_SEGMENT_MAX_LENGTH = 140

const normalizedCue = computed(() => {
  const cue = (props.cueKey || 'idle').trim()
  return ['greeting', 'idle', 'teaching'].includes(cue) ? cue : 'idle'
})
const stageClass = computed(() => ({
  'is-greeting': normalizedCue.value === 'greeting',
  'is-idle': normalizedCue.value === 'idle',
  'is-teaching': normalizedCue.value === 'teaching',
}))
const statusLabel = computed(() => {
  if (normalizedCue.value === 'teaching') return 'Prism Core 正在生成回答'
  if (normalizedCue.value === 'greeting') return 'Prism Core 已唤醒'
  return 'Prism Core 待机'
})
const normalizedSourceCount = computed(() => Math.max(0, Math.round(props.sourceCount || 0)))
const sourceTraceLabel = computed(() =>
  normalizedSourceCount.value > 0 ? `${normalizedSourceCount.value} 个来源信号` : '等待来源信号',
)

const normalizeNarrationText = (raw: string) =>
  raw
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

const splitNarrationText = (raw: string, maxLength = TTS_SEGMENT_MAX_LENGTH) => {
  const normalized = normalizeNarrationText(raw)
  if (!normalized) return []
  if (normalized.length <= maxLength) return [normalized]

  const parts = normalized
    .split(/(?<=[。！？；;.!?\n])/)
    .map((part) => part.trim())
    .filter(Boolean)

  const result: string[] = []
  let buffer = ''

  const flushBuffer = () => {
    const text = buffer.trim()
    if (text) result.push(text)
    buffer = ''
  }

  for (const part of parts) {
    if (part.length > maxLength) {
      flushBuffer()
      let start = 0
      while (start < part.length) {
        result.push(part.slice(start, start + maxLength).trim())
        start += maxLength
      }
      continue
    }

    const next = buffer ? `${buffer} ${part}` : part
    if (next.length > maxLength) {
      flushBuffer()
      buffer = part
    } else {
      buffer = next
    }
  }

  flushBuffer()
  return result
}

const stopNarration = () => {
  narrationToken.value += 1
  narrationQueue.value = []
  narrationProcessing.value = false

  const audioEl = narrationAudioRef.value
  if (audioEl) {
    audioEl.pause()
    audioEl.removeAttribute('src')
    audioEl.load()
  }

  if (activeAudioUrl.value) {
    URL.revokeObjectURL(activeAudioUrl.value)
    activeAudioUrl.value = ''
  }
}

const playAudioBlob = async (blob: Blob, token: number) => {
  if (token !== narrationToken.value) return

  const audioUrl = URL.createObjectURL(blob)
  const audioEl = narrationAudioRef.value || new Audio()
  narrationAudioRef.value = audioEl

  if (activeAudioUrl.value) {
    URL.revokeObjectURL(activeAudioUrl.value)
  }
  activeAudioUrl.value = audioUrl

  await new Promise<void>(async (resolve) => {
    const finish = () => {
      audioEl.onended = null
      audioEl.onerror = null
      resolve()
    }

    audioEl.onended = finish
    audioEl.onerror = finish
    audioEl.src = audioUrl

    try {
      await audioEl.play()
    } catch {
      finish()
    }
  })
}

const playNarrationBySegments = async (content: string, token: number) => {
  const segments = splitNarrationText(content)
  for (const segment of segments) {
    if (token !== narrationToken.value) return
    const blob = await requestBackendTts({ text: segment })
    await playAudioBlob(blob, token)
  }
}

const drainNarrationQueue = async (token: number) => {
  if (narrationProcessing.value) return
  narrationProcessing.value = true

  try {
    while (token === narrationToken.value && narrationQueue.value.length > 0) {
      const content = normalizeNarrationText(narrationQueue.value.shift() || '')
      if (!content) continue

      try {
        const blob = await requestBackendTts({ text: content })
        await playAudioBlob(blob, token)
      } catch {
        await playNarrationBySegments(content, token).catch(() => undefined)
      }
    }
  } finally {
    narrationProcessing.value = false
    if (token === narrationToken.value && narrationQueue.value.length === 0) {
      emit('narration-ended')
    }
  }
}

const startNarration = (text: string) => {
  const content = normalizeNarrationText(text)
  if (!content) return

  const token = narrationToken.value
  narrationQueue.value.push(content)
  void drainNarrationQueue(token)
}

watch(
  () => props.playSignal,
  () => {
    if (normalizedCue.value === 'greeting') {
      window.setTimeout(() => emit('request-idle'), 1800)
    }
  },
  { immediate: true },
)

watch(
  () => props.narrationSignal,
  () => startNarration(props.narrationText || ''),
)

watch(
  () => normalizedCue.value,
  (cue) => {
    if (cue !== 'teaching') stopNarration()
  },
)

watch(
  () => props.stopSignal,
  () => stopNarration(),
)

onBeforeUnmount(() => {
  stopNarration()
})
</script>

<style scoped>
.agent-core-panel {
  position: relative;
  height: 100%;
  min-height: 18rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at 50% 8%, rgba(90, 200, 250, 0.12), transparent 38%),
    linear-gradient(180deg, #0a0a10 0%, #000000 100%);
  border: 0.5px solid rgba(255, 255, 255, 0.06);
  box-shadow: var(--shadow-floating);
  isolation: isolate;
  cursor: pointer;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}

/* Hover glow */
.agent-core-panel:hover {
  border-color: rgba(90, 200, 250, 0.25);
  box-shadow: var(--shadow-floating), var(--shadow-glow-cyan);
}

/* Inner border glow ring */
.agent-core-panel::before {
  position: absolute;
  inset: 0.5rem;
  content: '';
  border: 0.5px solid rgba(255, 255, 255, 0.04);
  border-radius: calc(var(--radius-xl) - 0.25rem);
  pointer-events: none;
  z-index: 2;
}

/* Click ripple overlay */
.agent-core-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-xl);
  pointer-events: none;
  z-index: 3;
  background: transparent;
  transition: background 0.3s ease;
}
.agent-core-panel:active::after {
  background: radial-gradient(circle at center, rgba(90,200,250,0.08) 0%, transparent 70%);
  transition: background 0s;
}

.agent-core-stage {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: inherit;
  padding: 0;
}

.agent-core-scene {
  min-height: inherit;
}

/* Caption: Apple-style status label */
.caption {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  z-index: 4;
}

.caption span {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--dark-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
}

.caption span::before {
  content: '';
  display: block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: var(--apple-green);
}
.is-teaching .caption span::before { background: var(--apple-blue); }
.is-greeting .caption span::before { background: var(--apple-cyan); }

.caption strong {
  color: rgba(245,245,247,0.5);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-regular);
}

/* Cue-based border glow */
.is-greeting.agent-core-panel {
  border-color: rgba(90, 200, 250, 0.3);
}
.is-teaching.agent-core-panel {
  border-color: rgba(172, 57, 255, 0.25);
  animation: border-glow-teaching 2s ease-in-out infinite;
}

@keyframes border-glow-teaching {
  0%, 100% { border-color: rgba(172, 57, 255, 0.25); }
  50% { border-color: rgba(172, 57, 255, 0.5); }
}

@media (max-width: 720px) {
  .agent-core-panel { min-height: 14rem; }
}
@media (prefers-reduced-motion: reduce) {
  .agent-core-panel,
  .agent-core-panel::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
