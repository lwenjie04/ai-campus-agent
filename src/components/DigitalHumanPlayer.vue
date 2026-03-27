<template>
  <section class="digital-human">
    <div class="stage-shell">
      <video
        v-show="!showPlaceholder"
        ref="videoRef"
        class="video"
        :class="{ 'is-visible': videoVisible, 'is-switching': videoSwitching }"
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
}>()

// 视频和语音分开管理：mp4 负责画面，TTS 负责朗读文本。
const videoRef = ref<HTMLVideoElement | null>(null)
const showPlaceholder = ref(false)
const videoVisible = ref(false)
const narrationAudioRef = ref<HTMLAudioElement | null>(null)
const narrationToken = ref(0)
const activeAudioUrl = ref('')
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// 清理 markdown 痕迹，避免 TTS 把符号也读出来。
const normalizeNarrationText = (raw: string) =>
  raw
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

// 浏览器 TTS 只是兜底方案，只有后端 TTS 不可用时才启用。
const startNarrationWithBrowser = (text: string, token: number) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    emit('narration-ended')
    return
  }
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.rate = 0.95
  utter.pitch = 1
  utter.volume = 1
  utter.onend = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }
  utter.onerror = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

// 优先请求后端 TTS，失败后再回退到浏览器自带语音。
const startNarration = async (text: string) => {
  stopNarration()
  const token = narrationToken.value
  const content = normalizeNarrationText(text || '')
  if (!content) {
    emit('narration-ended')
    return
  }

  try {
    const blob = await requestBackendTts({ text: content })
    if (token !== narrationToken.value) return
    const audioUrl = URL.createObjectURL(blob)
    const audioEl = narrationAudioRef.value || new Audio()
    narrationAudioRef.value = audioEl
    if (activeAudioUrl.value) URL.revokeObjectURL(activeAudioUrl.value)
    activeAudioUrl.value = audioUrl
    audioEl.onended = () => {
      if (token === narrationToken.value) emit('narration-ended')
    }
    audioEl.onerror = () => {
      if (token === narrationToken.value) emit('narration-ended')
    }
    audioEl.src = audioUrl
    await audioEl.play()
    return
  } catch {
    // fallback to browser tts
  }
  startNarrationWithBrowser(content, token)
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

  if (normalizedCue.value === 'greeting') {
    try {
      el.muted = false
      el.volume = 1
      await el.play()
      lastVideoSrc.value = nextSrc
      syncVideoDebugState()
      return
    } catch {
      setDebugAction('greeting-play-failed-fallback-muted')
    }
  }

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
.digital-human {
  height: 100%;
}

.stage-shell {
  position: relative;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 6%, rgba(240, 251, 240, 0.55), transparent 40%),
    linear-gradient(
      180deg,
      rgba(206, 228, 206, 0.92) 0%,
      rgba(184, 227, 185, 0.94) 58%,
      rgba(146, 211, 148, 0.95) 100%
    );
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
  opacity: 0;
  transition: opacity 420ms ease-in-out;
  transform: scale(1);
  transform-origin: center;
}

.video.is-switching {
  transform: scale(1.01);
  transition:
    opacity 420ms ease-in-out,
    transform 460ms ease-out;
}

.video.is-visible {
  opacity: 1;
  transform: scale(1);
}

.placeholder-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  box-sizing: border-box;
}

.reserve-frame {
  width: min(92%, 420px);
  height: min(78%, 520px);
  border-radius: 22px;
  border: 2px dashed rgba(39, 121, 46, 0.35);
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
  padding: 20px;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.reserve-icon {
  font-size: 34px;
  line-height: 1;
}

.reserve-title {
  color: #14371b;
  font-size: 18px;
  font-weight: 800;
}

.reserve-hint {
  color: #285533;
  font-size: 13px;
}

.reserve-path {
  color: #2f6d3d;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.65);
}

.reserve-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.reserve-list span {
  font-size: 11px;
  color: #285c34;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.debug-box {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 3;
  max-width: calc(100% - 20px);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.35;
  color: #15321a;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(21, 50, 26, 0.2);
  backdrop-filter: blur(4px);
}
</style>
