<template>
  <div class="pixel-bot" :class="[`pixel-bot--${cueClass}`, { 'is-hover': hovered }]"
    @pointermove="hovered = true" @pointerleave="hovered = false">
    <canvas ref="canvas" class="pixel-bot__canvas" width="256" height="320" />
    <div class="pixel-bot__label">
      <span class="status-dot" :class="cueClass" />
      <span>{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ cueKey?: string }>(),
  { cueKey: 'idle' })

const hovered = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)

const cue = computed(() => {
  const c = (props.cueKey || 'idle').trim()
  return ['idle', 'greeting', 'teaching'].includes(c) ? c : 'idle'
})
const cueClass = computed(() => cue.value)
const statusText = computed(() => {
  if (cue.value === 'teaching') return '正在回答'
  if (cue.value === 'greeting') return '已唤醒'
  return '待机中'
})

// ============================================================
// Pixel Art — 32×40 grid, rendered at 8x → 256×320 canvas
// Color palette
// ============================================================
const PX = 8 // pixel size on canvas
const C = {
  _: '',           // transparent
  H: '#b8e0ff',    // head highlight (top-left bright)
  h: '#7cc4f0',    // head mid
  B: '#4a9eef',    // head blue (main)
  b: '#2a6ab8',    // head dark blue (shadow bottom-right)
  D: '#1a3a60',    // outline / head edge dark
  S: '#0a1630',    // screen bg (very dark)
  s: '#0d1d3a',    // screen border
  C: '#4af0f0',    // cyan expression glow
  c: '#2088a0',    // expression dim
  T: '#3a7ed0',    // body light
  t: '#2a5ea8',    // body mid
  d: '#1a3e78',    // body dark
  L: '#5ae0ff',    // chest light
  l: '#3090c0',    // chest mid
  O: '#103060',    // deepest outline
}

// 32×40 pixel grid — each row is a string, each char = color key
// Position: character centered, facing viewer, standing
const sprite = [
//  0         1         2         3
//  0123456789012345678901234567890123
  '________________________________', // 0
  '________________________________',
  '____________HHHHHH______________', // 2
  '__________HHhhhhHHHH____________',
  '_________HHhhBBBBhhHH___________', // 4  ← cloud bumps top
  '________HHhBBBBBBBBhHH__________',
  '_______HHhBBBBBBBBBBhH__________', // 6
  '______HHhBBBBBBBBBBBBhH_________',
  '_____HhBBBBssssssssBBBBhH_______', // 8  ← screen border starts
  '_____HhBBBssSSSSSSssBBBBh_______',
  '____HhBBssSSSSSSSSSSssBBhH______', // 10
  '____HhBBsSSSSSSSSSSSSsBBh_______',
  '____HhBBsSSCCC__CCSSSSsBh_______', // 12 ← eyes: ">  _"
  '____HhBBsSSC_____CCSSSsB________',
  '_____HhBsSSC_____CCSSsBh________', // 14
  '_____HhBssSSCC__CCSSSSsB________',
  '_____HhhBssSSSSSSSSSSsBh________', // 16 ← screen bottom
  '______HhhBBsssssssssBBh_________',
  '_______HhhBBBBBBBBBBB___________', // 18 ← chin
  '________HhhhBBBBBBhhH___________',
  '_________HHhhhhhhHH_____________', // 20
  '__________HHHHHHHH______________',
  '________________________________', // 22
  '___________TTTTTTTT_____________', // ← body starts
  '__________TttttttttT____________', // 24
  '__________tTLLLLLLTt____________',
  '__________tTLL__LLTt____________', // 26 ← chest with "> _"
  '__________tTLL__LLTt____________',
  '__________TttttttttT____________', // 28
  '__________dddddddddd____________',
  '___________dddddddd_____________', // 30
  '________________________________',
  '____________OO__OO______________', // 32 ← feet
  '____________OO__OO______________',
  '____________OO__OO______________', // 34
  '____________OO__OO______________',
  '________________________________', // 36
  '________________________________',
  '________________________________', // 38
  '________________________________',
]

// Arms (drawn separately — positioned relative to body)
const leftArm = [
  '___',
  '_TT',
  '_tT',
  '_tt',
  '_tt',
  '_Tt',
  '_TT',
  '__T',
]

const rightArm = [
  '___',
  'TT_',
  'Tt_',
  'tt_',
  'tt_',
  'tT_',
  'TT_',
  'T__',
]

// ---- Render ----
let animFrame = 0
let blinkPhase = 0
let bobPhase = 0

function drawSprite(ctx: CanvasRenderingContext2D, grid: string[], ox: number, oy: number) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const key = row[x] as keyof typeof C
      const color = C[key]
      if (color) {
        ctx.fillStyle = color
        ctx.fillRect(ox + x * PX, oy + y * PX, PX, PX)
      }
    }
  }
}

function drawAll(ctx: CanvasRenderingContext2D, bob: number, blink: boolean) {
  ctx.clearRect(0, 0, 256, 320)

  const bx = 64  // base x offset for body
  const by = 36  // base y offset for body
  const bobY = Math.round(bob)

  // Arms (behind body)
  drawSprite(ctx, leftArm, bx - 22, by + 184 + bobY)
  drawSprite(ctx, rightArm, bx + 126, by + 184 + bobY)

  // Body
  ctx.save()
  ctx.translate(0, bobY)
  drawSprite(ctx, sprite, bx, by)

  // Blink override: draw closed eyes
  if (blink) {
    ctx.fillStyle = C.S
    ctx.fillRect(bx + 12 * PX, by + 12 * PX, 5 * PX, 3 * PX)  // left eye closed
    ctx.fillRect(bx + 19 * PX, by + 12 * PX, 4 * PX, 3 * PX)  // right eye closed
    // Dim lines
    ctx.fillStyle = C.c
    ctx.fillRect(bx + 12 * PX, by + 12 * PX + PX, 5 * PX, PX)
    ctx.fillRect(bx + 20 * PX, by + 12 * PX + PX, 3 * PX, PX)
  }
  ctx.restore()
}

function render(t: number) {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  // Animation parameters
  const bobAmp = cue.value === 'teaching' ? 2 : 1
  bobPhase += 0.05
  const bob = Math.sin(bobPhase) * bobAmp

  const blinkInterval = cue.value === 'greeting' ? 120 : cue.value === 'teaching' ? 60 : 180
  blinkPhase++
  const blink = blinkPhase % blinkInterval < 6

  drawAll(ctx, bob, blink)

  // Screen glow effect
  if (cue.value === 'greeting' || cue.value === 'teaching') {
    const glowAlpha = 0.08 + Math.sin(t * 0.004) * 0.04
    const bx = 64, by = 36
    ctx.fillStyle = `rgba(74,240,240,${glowAlpha})`
    ctx.fillRect(bx + 8 * PX, by + 10 * PX, 17 * PX, 8 * PX)
  }

  // Generating: particle sparkles
  if (cue.value === 'teaching') {
    for (let i = 0; i < 4; i++) {
      const px = 80 + Math.sin(t * 0.003 + i * 1.7) * 50 + i * 30
      const py = 20 + Math.cos(t * 0.004 + i * 2.1) * 40 + (i % 2) * 30
      const a = 0.4 + Math.sin(t * 0.005 + i) * 0.4
      ctx.fillStyle = `rgba(74,240,240,${Math.max(0, a)})`
      ctx.fillRect(Math.round(px / PX) * PX, Math.round(py / PX) * PX, PX * 2, PX * 2)
    }
  }

  animFrame = requestAnimationFrame(render)
}

onMounted(() => { animFrame = requestAnimationFrame(render) })
onBeforeUnmount(() => { cancelAnimationFrame(animFrame) })
</script>

<style scoped>
.pixel-bot {
  position: relative;
  width: 100%; height: 100%; min-height: 18rem;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-xl);
  background: radial-gradient(circle at 50% 35%, rgba(74,158,239,0.08), transparent 55%),
              linear-gradient(180deg, #0a0a12 0%, #000 100%);
  cursor: pointer; overflow: hidden;
  image-rendering: pixelated;
}

.pixel-bot__canvas {
  width: 60%; max-width: 12rem;
  height: auto; aspect-ratio: 256 / 320;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(0 0.5rem 1.5rem rgba(0,0,0,0.3));
}

/* ====== States via CSS filter overlay ====== */
.pixel-bot--idle .pixel-bot__canvas {
  animation: float 4s ease-in-out infinite;
}
.pixel-bot--greeting .pixel-bot__canvas {
  animation: float-active 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0.5rem 1.5rem rgba(0,0,0,0.3)) drop-shadow(0 0 0.5rem rgba(74,240,240,0.3));
}
.pixel-bot--teaching .pixel-bot__canvas {
  animation: shake 0.3s ease-in-out infinite;
  filter: drop-shadow(0 0.5rem 1.5rem rgba(0,0,0,0.3)) drop-shadow(0 0 0.75rem rgba(172,57,255,0.4));
}

/* ====== Hover ====== */
.pixel-bot.is-hover .pixel-bot__canvas {
  filter: drop-shadow(0 0.5rem 1.5rem rgba(0,0,0,0.3)) drop-shadow(0 0 1rem rgba(74,240,240,0.25));
}

/* ====== Label ====== */
.pixel-bot__label {
  position: absolute; bottom: 0.5rem; left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.25rem 0.75rem; border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.06); backdrop-filter: blur(0.5rem);
  color: var(--dark-muted); font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}
.status-dot { width: 0.375rem; height: 0.375rem; border-radius: 50%; }
.status-dot.idle { background: #34c759; }
.status-dot.greeting { background: #4af0f0; }
.status-dot.teaching { background: #ac39ff; animation: dot-pulse 1.2s ease-out infinite; }

/* ====== Keyframes ====== */
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes float-active { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.02); } }
@keyframes shake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(0.5px,-0.5px); } 50% { transform: translate(-0.5px,0.5px); } 75% { transform: translate(-0.5px,0); } }
@keyframes dot-pulse { 0% { box-shadow: 0 0 0 0 rgba(172,57,255,0.5); } 100% { box-shadow: 0 0 0 0.5rem rgba(172,57,255,0); } }

@media (max-width: 720px) { .pixel-bot { min-height: 14rem; } .pixel-bot__canvas { max-width: 9rem; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; } }
</style>
