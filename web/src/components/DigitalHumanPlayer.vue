<template>
  <section class="digital-human" :class="`is-${normalizedCue}`">
    <video
      v-show="!showFallback"
      ref="videoRef"
      class="digital-human__video"
      :class="{ 'is-ready': videoReady }"
      :src="currentVideoSrc"
      :loop="normalizedCue !== 'greeting'"
      autoplay
      muted
      playsinline
      preload="auto"
      @loadeddata="handleLoaded"
      @ended="handleEnded"
      @error="handleVideoError"
    />

    <div v-if="showFallback" class="digital-human__fallback" role="status">
      <span class="digital-human__fallback-mark">AI</span>
      <strong>数字人资源暂不可用</strong>
      <span>请检查视频文件后重试</span>
    </div>

    <div class="digital-human__shade" aria-hidden="true" />

    <div class="digital-human__status">
      <span class="digital-human__pulse" aria-hidden="true" />
      <span>{{ statusLabel }}</span>
      <strong>{{ sourceLabel }}</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { requestBackendTts } from '@/api/tts'
import { normalizeNarrationText } from '@/utils/text'

const VIDEO_BASE_PATH = '/videos/digital-human'

const props = defineProps<{
  cueKey: string
  playSignal: number
  narrationText?: string
  narrationSignal?: number
  stopSignal?: number
  sourceCount?: number
}>()

const emit = defineEmits<{
  (event: 'request-idle'): void
  (event: 'narration-ended'): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const activeAudioUrl = ref('')
const playbackToken = ref(0)
const narrationQueue: string[] = []
let narrationQueueRunning = false
let activePlaybackResolve: (() => void) | null = null
const videoReady = ref(false)
const showFallback = ref(false)

const normalizedCue = computed(() => {
  const cue = (props.cueKey || 'idle').trim()
  return ['idle', 'greeting', 'teaching'].includes(cue) ? cue : 'idle'
})

const currentVideoSrc = computed(
  () => `${VIDEO_BASE_PATH}/${normalizedCue.value}.mp4`,
)

const statusLabel = computed(() => {
  if (normalizedCue.value === 'teaching') return '正在为你讲解'
  if (normalizedCue.value === 'greeting') return '数字人已唤醒'
  return '数字人在线'
})

const sourceLabel = computed(() => {
  const count = Math.max(0, Math.round(props.sourceCount || 0))
  return count > 0 ? `${count} 个参考来源` : '等待提问'
})

const releaseCurrentAudio = () => {
  const audio = audioRef.value
  if (audio) {
    audio.pause()
    audio.onended = null
    audio.onerror = null
    audio.removeAttribute('src')
    audio.load()
  }
  if (activeAudioUrl.value) {
    URL.revokeObjectURL(activeAudioUrl.value)
    activeAudioUrl.value = ''
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  activePlaybackResolve?.()
  activePlaybackResolve = null
}

const stopAudio = () => {
  playbackToken.value += 1
  narrationQueue.length = 0
  releaseCurrentAudio()
}

const speakWithBrowser = (text: string, token: number) => new Promise<void>((resolve) => {
  if (!('speechSynthesis' in window)) {
    resolve()
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.96
  utterance.pitch = 1
  const finish = () => {
    if (activePlaybackResolve === finish) activePlaybackResolve = null
    resolve()
  }
  utterance.onend = finish
  utterance.onerror = finish
  activePlaybackResolve = finish
  window.speechSynthesis.cancel()
  if (token === playbackToken.value) window.speechSynthesis.speak(utterance)
  else finish()
})

const playNarrationChunk = async (text: string, token: number) => {
  try {
    const blob = await requestBackendTts({ text })
    if (token !== playbackToken.value) return

    const url = URL.createObjectURL(blob)
    const audio = audioRef.value || new Audio()
    audioRef.value = audio
    activeAudioUrl.value = url
    audio.src = url
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (activePlaybackResolve === finish) activePlaybackResolve = null
        resolve()
      }
      activePlaybackResolve = finish
      audio.onended = finish
      audio.onerror = () => reject(new Error('TTS_AUDIO_PLAYBACK_FAILED'))
      audio.play().catch(reject)
    })
  } catch {
    if (token === playbackToken.value) await speakWithBrowser(text, token)
  } finally {
    releaseCurrentAudio()
  }
}

const drainNarrationQueue = async () => {
  if (narrationQueueRunning) return
  narrationQueueRunning = true
  const token = playbackToken.value

  try {
    while (token === playbackToken.value && narrationQueue.length > 0) {
      const text = narrationQueue.shift()
      if (text) await playNarrationChunk(text, token)
    }

    if (token === playbackToken.value && narrationQueue.length === 0) {
      emit('narration-ended')
    }
  } finally {
    narrationQueueRunning = false
    if (narrationQueue.length > 0) void drainNarrationQueue()
  }
}

const enqueueNarration = (rawText: string) => {
  const text = normalizeNarrationText(rawText)
  if (!text) return
  narrationQueue.push(text)
  void drainNarrationQueue()
}

const playVideo = async () => {
  videoReady.value = false
  showFallback.value = false
  await nextTick()

  const video = videoRef.value
  if (!video) return
  video.muted = true
  video.load()

  try {
    await video.play()
  } catch {
    showFallback.value = true
  }
}

const handleLoaded = () => {
  showFallback.value = false
  requestAnimationFrame(() => {
    videoReady.value = true
  })
}

const handleEnded = () => {
  if (normalizedCue.value === 'greeting') emit('request-idle')
}

const handleVideoError = () => {
  videoReady.value = false
  showFallback.value = true
  if (normalizedCue.value !== 'idle') emit('request-idle')
}

watch(
  () => [normalizedCue.value, props.playSignal],
  () => void playVideo(),
  { immediate: true },
)

watch(
  () => props.narrationSignal,
  () => enqueueNarration(props.narrationText || ''),
)

watch(
  () => props.stopSignal,
  () => {
    videoRef.value?.pause()
    stopAudio()
  },
)

onBeforeUnmount(() => {
  videoRef.value?.pause()
  stopAudio()
})
</script>

<style scoped>
.digital-human {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-xl);
  background: linear-gradient(180deg, #dcefdc 0%, #aedcaf 100%);
  isolation: isolate;
}

.digital-human__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  opacity: 0;
  transform: scale(1.015);
  transition: opacity 360ms ease, transform 520ms ease;
}

.digital-human__video.is-ready {
  opacity: 1;
  transform: scale(1);
}

.digital-human__shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 58%, rgba(5, 8, 14, 0.72) 100%);
}

.digital-human__status {
  position: absolute;
  right: 4%;
  bottom: 3%;
  left: 4%;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  gap: 0.55rem;
  padding: 0.55rem 0.75rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.875rem;
  background: rgba(10, 14, 22, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 0.75rem;
  backdrop-filter: blur(1rem) saturate(135%);
}

.digital-human__status strong {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.54);
  font-weight: 500;
}

.digital-human__pulse {
  width: 0.45rem;
  height: 0.45rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #45d483;
  box-shadow: 0 0 0 0 rgba(69, 212, 131, 0.45);
  animation: status-pulse 2s ease-out infinite;
}

.is-teaching .digital-human__pulse {
  background: #6cb8ff;
  animation-duration: 1.1s;
}

.digital-human__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  color: rgba(255, 255, 255, 0.88);
  text-align: center;
  background: #0a0e17;
}

.digital-human__fallback span:last-child {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
}

.digital-human__fallback-mark {
  display: grid;
  width: 3.25rem;
  aspect-ratio: 1;
  place-items: center;
  color: #08111f;
  font-weight: 800;
  border-radius: 50%;
  background: #9fd7ff;
}

@keyframes status-pulse {
  0% { box-shadow: 0 0 0 0 rgba(69, 212, 131, 0.45); }
  70%, 100% { box-shadow: 0 0 0 0.55rem rgba(69, 212, 131, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .digital-human__video,
  .digital-human__pulse {
    transition: none;
    animation: none;
  }
}
</style>
