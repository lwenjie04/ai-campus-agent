<template>
  <section class="digital-human">
    <div class="stage-shell">
      <video
        v-show="!showPlaceholder"
        ref="videoRef"
        class="video"
        :class="{
          'is-visible': videoVisible,
          'is-switching': videoSwitching,
          'video--idle': normalizedCue === 'idle',
        }"
        autoplay
        muted
        :loop="isIdleLoop"
        playsinline
        preload="metadata"
        :src="currentVideoSrc"
        @loadeddata="onLoadedData"
        @ended="onEnded"
        @error="onError"
      />

      <div v-if="showPlaceholder" class="placeholder-stage">
        <div class="reserve-frame">
          <div class="reserve-icon">🎥</div>
          <div class="reserve-title">数字人展示区（预留）</div>
          <div class="reserve-hint">请检查视频文件是否存在：</div>
          <div class="reserve-path">public/videos/digital-human/</div>
          <div class="reserve-list">
            <span>greeting.mp4</span>
            <span>idle.mp4</span>
            <span>teaching.mp4</span>
          </div>
        </div>
      </div>

      <div v-if="showDebug" class="debug-box">
        <div>cue: {{ normalizedCue }}</div>
        <div>src: {{ currentVideoSrc }}</div>
        <div>readyState: {{ debugState.readyState }}</div>
        <div>networkState: {{ debugState.networkState }}</div>
        <div>paused: {{ debugState.paused }}</div>
        <div>error: {{ debugState.error || '-' }}</div>
        <div>lastAction: {{ debugState.lastAction || '-' }}</div>
        <div>resourceChecked: {{ debugState.resourceChecked }}</div>
        <div>missingVideos: {{ debugState.missingVideos.join(', ') || '-' }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { appConfig } from '@/config/app'
import { requestBackendTts } from '@/api/tts'
import { normalizeNarrationText, splitNarrationText } from '@/services/narration-text'

const props = defineProps<{
  cueKey: string
  playSignal: number
  narrationText?: string
  narrationSignal?: number
  stopSignal?: number
}>()

const emit = defineEmits<{
  (e: 'request-idle'): void
  (e: 'narration-ended'): void
  (e: 'narration-error'): void
  (e: 'narration-blocked'): void
}>()

// 视频和语音分开管理：mp4 负责画面，TTS 负责朗读文本。
const videoRef = ref<HTMLVideoElement | null>(null)
const showPlaceholder = ref(false)
const videoVisible = ref(false)
const narrationAudioRef = ref<HTMLAudioElement | null>(null)
const narrationToken = ref(0)
const activeAudioUrl = ref('')
const narrationQueue = ref<string[]>([])
const narrationProcessing = ref(false)
// 一次播报只提示一次失败，避免逐段失败刷屏。
let narrationErrorNotified = false
// 移动端自动播放被浏览器拦截时只提示一次。
let narrationBlockedNotified = false
const lastVideoSrc = ref('')
const videoSwitching = ref(false)

const debugState = ref({
  readyState: 0,
  networkState: 0,
  paused: true,
  error: '',
  lastAction: '',
  resourceChecked: false,
  missingVideos: [] as string[],
})

const normalizedCue = computed(() => (props.cueKey || 'idle').trim() || 'idle')
const isIdleLoop = computed(() => normalizedCue.value === 'idle')
const currentVideoSrc = computed(
  () => `${appConfig.digitalHumanVideoBasePath}/${normalizedCue.value}.mp4`,
)
const showDebug = computed(() => appConfig.videoDebug)

const setDebugAction = (text: string) => {
  debugState.value.lastAction = text
}

const syncVideoDebugState = () => {
  const el = videoRef.value
  if (!el) return
  debugState.value.readyState = el.readyState
  debugState.value.networkState = el.networkState
  debugState.value.paused = el.paused
  if (!el.error) {
    debugState.value.error = ''
    return
  }
  const codeMap: Record<number, string> = {
    1: 'MEDIA_ERR_ABORTED',
    2: 'MEDIA_ERR_NETWORK',
    3: 'MEDIA_ERR_DECODE',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
  }
  debugState.value.error = codeMap[el.error.code] || `UNKNOWN(${el.error.code})`
}

// 先探测视频资源是否存在，避免缺文件时页面只表现为“黑屏”。
const probeVideoByMetadata = (src: string, timeoutMs = 4000) =>
  new Promise<boolean>((resolve) => {
    const v = document.createElement('video')
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      v.src = ''
      resolve(ok)
    }
    const timer = window.setTimeout(() => finish(false), timeoutMs)
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => {
      window.clearTimeout(timer)
      finish(true)
    }
    v.onerror = () => {
      window.clearTimeout(timer)
      finish(false)
    }
    v.src = src
    v.load()
  })

const checkRequiredVideos = async () => {
  const names = ['greeting', 'idle', 'teaching']
  const missing: string[] = []
  for (const name of names) {
    const src = `${appConfig.digitalHumanVideoBasePath}/${name}.mp4`
    const ok = await probeVideoByMetadata(src)
    if (!ok) missing.push(`${name}.mp4`)
  }
  debugState.value.resourceChecked = true
  debugState.value.missingVideos = missing
  if (missing.length > 0) {
    setDebugAction(`resource-missing: ${missing.join(', ')}`)
  } else {
    setDebugAction('resource-check-ok')
  }
}

// 同时停止后端 TTS 音频和浏览器语音合成兜底播放。
const stopNarration = () => {
  narrationToken.value += 1
  narrationErrorNotified = false
  narrationBlockedNotified = false
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

  await new Promise<void>((resolve) => {
    const releaseUrl = () => {
      // 播放结束或失败后立即释放 ObjectURL，避免长会话累积内存。
      if (activeAudioUrl.value === audioUrl) {
        URL.revokeObjectURL(audioUrl)
        activeAudioUrl.value = ''
      }
    }

    const finish = () => {
      audioEl.onended = null
      audioEl.onerror = null
      releaseUrl()
      resolve()
    }

    audioEl.onended = finish
    audioEl.onerror = finish
    audioEl.src = audioUrl

    void audioEl.play().catch((error: unknown) => {
      const name = error instanceof Error ? error.name : ''
      if (name === 'NotAllowedError' && token === narrationToken.value && !narrationBlockedNotified) {
        narrationBlockedNotified = true
        emit('narration-blocked')
      }
      finish()
    })
  })
}

const playNarrationBySegments = async (content: string, token: number) => {
  const segments = splitNarrationText(content)
  if (segments.length === 0) return false

  let playedAtLeastOneSegment = false
  for (const segment of segments) {
    if (token !== narrationToken.value) return playedAtLeastOneSegment
    const blob = await requestBackendTts({ text: segment })
    if (token !== narrationToken.value) return playedAtLeastOneSegment
    await playAudioBlob(blob, token)
    playedAtLeastOneSegment = true
  }

  return playedAtLeastOneSegment
}

const drainNarrationQueue = async (token: number) => {
  if (narrationProcessing.value) return
  narrationProcessing.value = true

  try {
    while (token === narrationToken.value && narrationQueue.value.length > 0) {
      const nextText = narrationQueue.value.shift() || ''
      const content = normalizeNarrationText(nextText)
      if (!content) continue

      try {
        const blob = await requestBackendTts({ text: content })
        if (token !== narrationToken.value) return
        await playAudioBlob(blob, token)
      } catch {
        const played = await playNarrationBySegments(content, token).catch(() => false)
        // 分段兜底也失败时给出一次可见提示；文字回答不受影响。
        if (!played && token === narrationToken.value && !narrationErrorNotified) {
          narrationErrorNotified = true
          emit('narration-error')
        }
      }
    }
  } finally {
    narrationProcessing.value = false
    if (token === narrationToken.value && narrationQueue.value.length === 0) {
      emit('narration-ended')
    }
  }
}

// 讲解文本统一通过后端 TTS 合成。
// 前端会把多次传入的讲解片段排队顺序播放，从而实现“边生成边讲解”。
const startNarration = async (text: string) => {
  const token = narrationToken.value
  const content = normalizeNarrationText(text || '')
  if (!content) {
    return
  }

  narrationQueue.value.push(content)
  void drainNarrationQueue(token)
}

// 每次切换 cue 都重新加载对应视频，并配合样式类做淡入效果。
const playCurrentVideo = async () => {
  showPlaceholder.value = false
  const nextSrc = currentVideoSrc.value
  const isSourceChanged = nextSrc !== lastVideoSrc.value
  if (isSourceChanged) {
    videoVisible.value = false
    videoSwitching.value = true
  }
  await nextTick()

  const el = videoRef.value
  if (!el) return
  setDebugAction('playCurrentVideo')

  try {
    el.currentTime = 0
  } catch {
    // ignore
  }
  el.load()

  try {
    el.muted = true
    el.volume = 1
    await el.play()
    lastVideoSrc.value = nextSrc
    syncVideoDebugState()
  } catch {
    setDebugAction('muted-play-failed')
    syncVideoDebugState()
  }
}

const stopVideo = () => {
  const el = videoRef.value
  if (!el) return
  setDebugAction('stopVideo')
  el.pause()
  try {
    el.currentTime = 0
  } catch {
    // ignore
  }
  syncVideoDebugState()
}

// 等视频数据真正加载完成后再显示，减少闪白或空帧。
const onLoadedData = () => {
  setDebugAction('loadeddata')
  showPlaceholder.value = false
  requestAnimationFrame(() => {
    videoVisible.value = true
    window.setTimeout(() => {
      videoSwitching.value = false
    }, 460)
  })
  syncVideoDebugState()
}

// 欢迎视频只播放一次；待机和讲解状态需要持续可用。
const onEnded = async () => {
  setDebugAction('ended')
  if (normalizedCue.value === 'greeting') {
    emit('request-idle')
    return
  }
  if (normalizedCue.value === 'idle' || normalizedCue.value === 'teaching') {
    const el = videoRef.value
    if (!el) return
    try {
      el.currentTime = 0
      await el.play()
      syncVideoDebugState()
    } catch {
      await playCurrentVideo()
    }
  }
}

const onError = () => {
  setDebugAction('error')
  syncVideoDebugState()
  if (normalizedCue.value === 'greeting' || normalizedCue.value === 'teaching') {
    emit('request-idle')
    return
  }
  videoVisible.value = false
  showPlaceholder.value = true
}

watch(
  () => props.playSignal,
  () => {
    // 父组件通过递增 playSignal 的方式，强制重播同一个 cue 视频。
    void playCurrentVideo()
  },
  { immediate: true },
)

watch(
  () => props.narrationSignal,
  () => {
    void startNarration(props.narrationText || '')
  },
)

watch(
  () => normalizedCue.value,
  (cue) => {
    // 一旦离开 teaching 状态，就立即停止当前讲解语音。
    if (cue !== 'teaching') stopNarration()
  },
)

watch(
  () => props.stopSignal,
  () => {
    stopVideo()
    stopNarration()
  },
)

onMounted(() => {
  // 资源检测放在挂载后异步执行，避免阻塞首屏渲染。
  void checkRequiredVideos()
})

onBeforeUnmount(() => {
  stopVideo()
  stopNarration()
})
</script>


<style scoped>
.digital-human,
.stage-shell {
  width: 100%;
  height: 100%;
}

.stage-shell {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.55), transparent 28%),
    linear-gradient(145deg, var(--tint) 0%, var(--soft) 52%, var(--border) 100%);
}

.stage-shell::before,
.stage-shell::after {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  content: "";
}

.stage-shell::before {
  inset: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.32);
  clip-path: polygon(0 0, 35% 0, 35% 1px, 65% 1px, 65% 0, 100% 0, 100% 100%, 0 100%);
}

.stage-shell::after {
  right: -12%;
  bottom: -28%;
  width: 58%;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  box-shadow: 0 0 0 3rem rgba(255, 255, 255, 0.045), 0 0 0 6rem rgba(255, 255, 255, 0.035);
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  opacity: 0;
  filter: saturate(0.88) contrast(1.04);
  transform: translateY(0.35rem) scale(0.99);
  transform-origin: center bottom;
  transition: opacity 420ms ease, transform 520ms var(--ease-out);
}

.video.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.video.is-switching {
  opacity: 0;
  transform: translateY(0.55rem) scale(0.985);
}

.video--idle.is-visible {
  transform: scale(1.045);
}

.placeholder-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.reserve-frame {
  width: min(100%, 25rem);
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  border: 1px dashed var(--border);
  padding: 1.5rem;
  color: var(--ink);
  background: var(--white);
  text-align: center;
}

.reserve-icon { font-size: 2rem; }
.reserve-title { font-family: var(--font-display); font-size: 1.2rem; font-weight: 900; }
.reserve-hint, .reserve-path, .reserve-list { font-size: 0.75rem; }
.reserve-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; }
.reserve-list span, .reserve-path { border: 1px solid var(--line); padding: 0.25rem 0.4rem; background: var(--white); }

.debug-box {
  position: absolute;
  right: 0.6rem;
  top: 0.6rem;
  z-index: 4;
  max-width: calc(100% - 1.2rem);
  border: 1px solid var(--ink);
  padding: 0.55rem;
  color: var(--white);
  background: rgba(17, 24, 29, 0.82);
  font-family: var(--font-mono);
  font-size: 0.61rem;
  line-height: 1.45;
}
</style>
