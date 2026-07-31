<template>
  <section class="voice-orb-stage" :style="stageStyle">
    <div class="orb-wrap" :class="`state-${normalizedCueKey}`">
      <div class="orb halo" />
      <div class="orb ring" />
      <div class="orb core">
        <div class="core-highlight" />
      </div>
    </div>

    <div class="cue-chip">
      <span class="cue-dot" :class="`is-${normalizedCueKey}`" />
      <span>{{ cueLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { requestBackendTts } from '@/api/tts'

const props = defineProps<{
  cueKey: string
  playSignal: number
  narrationText?: string
  narrationSignal?: number
  narrationVoiceName?: string
  edgeSoftness?: number
}>()

const emit = defineEmits<{
  (e: 'request-idle'): void
  (e: 'narration-ended'): void
}>()

const availableVoices = ref<SpeechSynthesisVoice[]>([])
const greetingTimer = ref<number | undefined>(undefined)
const narrationAudioRef = ref<HTMLAudioElement | null>(null)
const activeAudioUrl = ref('')
const narrationToken = ref(0)

const cueLabelMap: Record<string, string> = {
  greeting: '欢迎开场',
  idle: '待机',
  teaching: '讲解中',
}

const normalizedCueKey = computed(() => (props.cueKey || 'idle').trim() || 'idle')
const cueLabel = computed(() => cueLabelMap[normalizedCueKey.value] || `状态：${normalizedCueKey.value}`)

const normalizedEdgeSoftness = computed(() => {
  const n = Number(props.edgeSoftness ?? 18)
  if (!Number.isFinite(n)) return 18
  return Math.max(0, Math.min(100, Math.round(n)))
})

const stageStyle = computed(() => {
  const level = normalizedEdgeSoftness.value / 100
  return {
    '--edge-shadow': `${(14 + level * 40).toFixed(1)}px`,
    '--edge-alpha': `${(0.18 + level * 0.24).toFixed(3)}`,
  }
})

const clearGreetingTimer = () => {
  if (greetingTimer.value) {
    window.clearTimeout(greetingTimer.value)
    greetingTimer.value = undefined
  }
}

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

const preferredVoiceNameKeywords = [
  'xiaoxiao',
  'xiaoyi',
  'xiaohan',
  'yunxi',
  'xiaomeng',
  'huihui',
  'chinese',
  'mandarin',
]

const resolveNarrationVoice = () => {
  const voices = availableVoices.value
  if (!voices.length) return null

  const explicitName = String(props.narrationVoiceName || '').trim()
  if (explicitName) {
    const explicitMatched = voices.find((v) => v.name === explicitName)
    if (explicitMatched) return explicitMatched
  }

  const zhVoices = voices.filter((v) => /zh|cmn|chinese/i.test(v.lang) || /中|华|汉语|普通话/i.test(v.name))
  if (!zhVoices.length) return null

  const ranked = [...zhVoices].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    const aScore = preferredVoiceNameKeywords.reduce((acc, key) => acc + (aName.includes(key) ? 1 : 0), 0)
    const bScore = preferredVoiceNameKeywords.reduce((acc, key) => acc + (bName.includes(key) ? 1 : 0), 0)
    return bScore - aScore
  })

  return ranked[0] || zhVoices[0]
}

const normalizeNarrationText = (raw: string) =>
  raw
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

const startNarrationWithBrowserTts = (text: string, token: number) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    emit('narration-ended')
    return
  }

  const content = normalizeNarrationText(text || '')
  if (!content) {
    emit('narration-ended')
    return
  }

  const utterance = new SpeechSynthesisUtterance(content)
  const preferredVoice = resolveNarrationVoice()
  utterance.voice = preferredVoice || null
  utterance.lang = preferredVoice?.lang || 'zh-CN'
  utterance.rate = 0.92
  utterance.pitch = 1
  utterance.volume = 1
  utterance.onend = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }
  utterance.onerror = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

const startNarrationWithBackendTts = async (text: string, token: number) => {
  const blob = await requestBackendTts({
    text,
    voiceName: props.narrationVoiceName,
  })
  if (token !== narrationToken.value) return false

  const audioUrl = URL.createObjectURL(blob)
  const audioEl = narrationAudioRef.value || new Audio()
  narrationAudioRef.value = audioEl

  if (activeAudioUrl.value) {
    URL.revokeObjectURL(activeAudioUrl.value)
  }
  activeAudioUrl.value = audioUrl

  audioEl.onended = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }
  audioEl.onerror = () => {
    if (token === narrationToken.value) emit('narration-ended')
  }
  audioEl.src = audioUrl
  audioEl.playbackRate = 1
  await audioEl.play()
  return true
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
    const ok = await startNarrationWithBackendTts(content, token)
    if (ok) return
  } catch {
    // fallback
  }

  startNarrationWithBrowserTts(content, token)
}

watch(
  () => props.narrationSignal,
  () => {
    void startNarration(props.narrationText || '')
  },
)

watch(
  () => [props.playSignal, normalizedCueKey.value],
  () => {
    clearGreetingTimer()
    if (normalizedCueKey.value === 'greeting') {
      greetingTimer.value = window.setTimeout(() => emit('request-idle'), 2200)
    }
    if (normalizedCueKey.value !== 'teaching') {
      stopNarration()
    }
  },
  { immediate: true },
)

const syncVoices = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  availableVoices.value = window.speechSynthesis.getVoices()
}

onMounted(() => {
  syncVoices()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices)
  }
})

onBeforeUnmount(() => {
  clearGreetingTimer()
  stopNarration()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.removeEventListener('voiceschanged', syncVoices)
  }
})
</script>

<style scoped>
.voice-orb-stage {
  position: relative;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(61, 128, 142, 0.26), transparent 45%),
    radial-gradient(90% 85% at 10% 90%, rgba(61, 125, 142, 0.14), transparent 62%),
    linear-gradient(180deg, #0b1219 0%, #0b1118 45%, #0a1016 100%);
  box-shadow:
    inset 0 0 var(--edge-shadow) rgba(0, 0, 0, var(--edge-alpha)),
    inset 0 0 0 1px rgba(132, 197, 220, 0.08);
}

.voice-orb-stage::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, rgba(102, 225, 255, 0.06) 0%, rgba(102, 225, 255, 0) 55%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 38%);
}

.orb-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.orb {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
}

.halo {
  width: clamp(210px, 38vw, 320px);
  aspect-ratio: 1 / 1;
  background: radial-gradient(circle, rgba(88, 225, 255, 0.2) 0%, rgba(88, 225, 255, 0) 72%);
  filter: blur(4px);
}

.ring {
  width: clamp(132px, 24vw, 198px);
  aspect-ratio: 1 / 1;
  border: 1.4px solid rgba(122, 227, 255, 0.36);
  box-shadow:
    inset 0 0 14px rgba(76, 187, 219, 0.15),
    0 0 16px rgba(65, 176, 206, 0.2);
}

.core {
  width: clamp(96px, 17vw, 138px);
  aspect-ratio: 1 / 1;
  background:
    radial-gradient(circle at 30% 26%, rgba(214, 252, 255, 0.95) 0%, rgba(128, 231, 255, 0.82) 40%, rgba(88, 214, 243, 0.66) 72%, rgba(54, 174, 210, 0.44) 100%);
  box-shadow:
    0 0 0 1px rgba(207, 247, 255, 0.32),
    0 8px 28px rgba(41, 127, 156, 0.32);
  overflow: hidden;
}

.core-highlight {
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 62%);
}

.orb-wrap.state-idle .core {
  animation: coreIdle 4.8s ease-in-out infinite;
}

.orb-wrap.state-idle .ring {
  animation: ringIdle 4.8s ease-in-out infinite;
}

.orb-wrap.state-greeting .core {
  animation: corePulse 2.2s ease-in-out infinite;
}

.orb-wrap.state-greeting .ring {
  animation: ringPulse 2.2s ease-in-out infinite;
}

.orb-wrap.state-teaching .core {
  animation: corePulse 1.2s ease-in-out infinite;
}

.orb-wrap.state-teaching .ring {
  animation: ringPulse 1.2s ease-in-out infinite;
}

@keyframes coreIdle {
  0%,
  100% {
    transform: scale(1);
    filter: saturate(1);
  }
  50% {
    transform: scale(1.04);
    filter: saturate(1.06);
  }
}

@keyframes ringIdle {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.58;
  }
  50% {
    transform: scale(1.03);
    opacity: 0.82;
  }
}

@keyframes corePulse {
  0%,
  100% {
    transform: scale(1);
    filter: saturate(1.03);
  }
  50% {
    transform: scale(1.13);
    filter: saturate(1.16);
  }
}

@keyframes ringPulse {
  0% {
    transform: scale(0.96);
    opacity: 0.78;
  }
  70% {
    opacity: 0.24;
  }
  100% {
    transform: scale(1.15);
    opacity: 0;
  }
}

.cue-chip {
  position: absolute;
  right: 10px;
  top: 10px;
  max-width: 78%;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(14, 30, 38, 0.68);
  border: 1px solid rgba(120, 208, 236, 0.26);
  backdrop-filter: blur(8px);
  color: #bfeaf8;
  font-size: 11px;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cue-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #6dc6dd;
  box-shadow: 0 0 0 3px rgba(109, 198, 221, 0.2);
}

.cue-dot.is-greeting {
  background: #f6bf75;
  box-shadow: 0 0 0 3px rgba(246, 191, 117, 0.24);
}

.cue-dot.is-teaching {
  background: #6ee4ff;
  box-shadow: 0 0 0 3px rgba(110, 228, 255, 0.24);
}
</style>
