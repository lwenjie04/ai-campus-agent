<template>
  <section class="digital-human">
    <div class="stage-shell">
      <video
        v-show="!showPlaceholder"
        ref="videoRef"
        class="video"
        muted
        playsinline
        :src="currentVideoSrc"
        @ended="onEnded"
        @error="onError"
      />

      <div v-if="showPlaceholder" class="placeholder-stage">
        <div class="reserve-frame">
          <div class="reserve-icon">🎬</div>
          <div class="reserve-title">数字人展示区（预留）</div>
          <div class="reserve-hint">后续放入 mp4 视频素材后自动播放</div>
          <div class="reserve-path">`public/videos/digital-human/`</div>
        </div>
      </div>

      <div class="floor-line"></div>
      <div class="cue-chip">{{ cueText }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { appConfig } from '@/config/app'

const props = defineProps<{
  cueKey: string
  playSignal: number
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const showPlaceholder = ref(true)

const currentVideoSrc = computed(
  () => `${appConfig.digitalHumanVideoBasePath}/${props.cueKey || 'idle'}.mp4`,
)

const cueText = computed(() => `视频触发：${props.cueKey || 'idle'}`)

const playVideo = async () => {
  showPlaceholder.value = false
  await nextTick()

  const el = videoRef.value
  if (!el) return
  el.currentTime = 0

  try {
    await el.play()
  } catch {
    showPlaceholder.value = true
  }
}

const onEnded = async () => {
  if (props.cueKey === 'idle') return
  const el = videoRef.value
  if (!el) return

  el.src = `${appConfig.digitalHumanVideoBasePath}/idle.mp4`

  try {
    await el.play()
  } catch {
    showPlaceholder.value = true
  }
}

const onError = () => {
  showPlaceholder.value = true
}

watch(
  () => props.playSignal,
  () => {
    void playVideo()
  },
  { immediate: true },
)
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
