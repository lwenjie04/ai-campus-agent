<template>
  <section class="digital-human">
    <div class="stage-shell">
      <video
        v-show="!showPlaceholder"
        ref="videoRef"
        class="video"
        autoplay
        muted
        playsinline
        preload="metadata"
        :src="currentVideoSrc"
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

      <div class="floor-line"></div>
      <div class="cue-chip">{{ cueText }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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

const videoRef = ref<HTMLVideoElement | null>(null)
const showPlaceholder = ref(false)
const narrationAudioRef = ref<HTMLAudioElement | null>(null)
const narrationToken = ref(0)
const activeAudioUrl = ref('')

const normalizedCue = computed(() => (props.cueKey || 'idle').trim() || 'idle')
const currentVideoSrc = computed(
  () => `${appConfig.digitalHumanVideoBasePath}/${normalizedCue.value}.mp4`,
)
const cueText = computed(() => `视频状态：${normalizedCue.value}`)

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

const normalizeNarrationText = (raw: string) =>
  raw
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

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
    // fallback
  }

  startNarrationWithBrowser(content, token)
}

const playCurrentVideo = async () => {
  showPlaceholder.value = false
  await nextTick()

  const el = videoRef.value
  if (!el) return

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
      return
    } catch {
      // fallback to muted autoplay
    }
  }

  try {
    el.muted = true
    el.volume = 1
    await el.play()
  } catch {
    // 自动播放受限时不直接显示占位，等待媒体错误事件做最终判定。
  }
}

const stopVideo = () => {
  const el = videoRef.value
  if (!el) return
  el.pause()
  try {
    el.currentTime = 0
  } catch {
    // ignore
  }
}

const onEnded = async () => {
  if (normalizedCue.value === 'greeting') {
    emit('request-idle')
    return
  }
  if (normalizedCue.value === 'idle' || normalizedCue.value === 'teaching') {
    await playCurrentVideo()
  }
}

const onError = () => {
  // 欢迎视频加载失败时，直接切待机，避免首屏直接落到占位文案。
  if (normalizedCue.value === 'greeting' || normalizedCue.value === 'teaching') {
    emit('request-idle')
    return
  }
  // 待机视频也失败，才显示占位提示。
  showPlaceholder.value = true
}

watch(
  () => props.playSignal,
  () => {
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
    if (cue !== 'teaching') {
      stopNarration()
    }
  },
)

watch(
  () => props.stopSignal,
  () => {
    stopVideo()
    stopNarration()
  },
)

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
    radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.8), transparent 34%),
    linear-gradient(
      180deg,
      rgba(236, 248, 234, 0.72) 0%,
      rgba(166, 236, 156, 0.62) 65%,
      rgba(99, 221, 85, 0.8) 100%
    );
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
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

.floor-line {
  position: absolute;
  left: 16%;
  right: 16%;
  bottom: 14%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.85), rgba(58, 103, 61, 0.7));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
}

.cue-chip {
  position: absolute;
  right: 10px;
  top: 10px;
  max-width: 70%;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  color: #2f5c33;
  font-size: 11px;
  line-height: 1.2;
}
</style>
