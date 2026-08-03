<template>
  <div class="augen">
    <!-- ====== Noise Overlay ====== -->
    <div class="noise" />

    <!-- ====== Custom Cursor ====== -->
    <div
      ref="cursorRef"
      class="cursor"
      :class="{ 'is-view': cursorView, 'is-hidden': cursorHidden }"
    >
      <span class="cursor__label">VIEW</span>
    </div>

    <!-- ====== Loading Screen ====== -->
    <div ref="loaderRef" style="position:fixed;inset:0;z-index:10000;background:#faf9f7;display:grid;place-items:center">
      <span ref="textRef" style="font-size:clamp(2.5rem,8vw,5rem);font-weight:700;letter-spacing:-0.04em;color:#1a1a18">PRISM</span>
    </div>

    <!-- ====== Hero + Marquee Video Stage ====== -->
    <section class="hero-stage" aria-label="数智校答">
      <video
        class="hero-stage__video"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        aria-hidden="true"
        @error="onHeroVideoError"
      >
        <source :src="heroVideoSources.webm" type="video/webm">
        <source :src="heroVideoSources.mp4" type="video/mp4">
      </video>
      <div class="hero-stage__fallback" :class="{ 'is-visible': heroVideoFailed }" aria-hidden="true" />
      <div class="hero-stage__veil" aria-hidden="true" />

      <section class="hero">
        <div class="hero__glass">
          <div class="hero__text">
            <h1 class="hero__title">
              <span class="line" data-reveal>数智校答</span>
              <span class="line" data-reveal>智能问答<span class="dot">.</span></span>
            </h1>
            <p class="hero__sub" data-reveal>
              校园智能服务平台&ensp;·&ensp;LightRAG&ensp;·&ensp;数智校答
            </p>
          </div>
        </div>
      </section>

      <!-- ====== Marquee ====== -->
      <div class="marquee">
        <span class="marquee__label">热门问题</span>
        <div ref="marqueeRef" class="marquee__track">
          <button v-for="(tag, i) in allMarqueeTags" :key="i" class="marquee__pill" :style="{ '--pill-bg': tag.bg, '--pill-fg': tag.fg }" @click="emit('openChat')">
            {{ tag.text }}
          </button>
        </div>
      </div>
    </section>

    <!-- ====== Work Grid (功能模块) ====== -->
    <section class="grid">
      <article
        v-for="(item, i) in gridItems" :key="item.title"
        class="grid__item"
        :class="{ 'grid__item--wide': item.wide }"
        :style="`--i: ${i}; --accent: ${item.color}; --accent-bg: ${item.bg}`"
        data-reveal
        @click="emit('openChat')"
      >
        <div class="grid__media">
          <span class="grid__icon" :style="{ background: item.bg }">{{ item.icon }}</span>
          <div class="grid__tag" :style="{ color: item.color }">{{ item.tag }}</div>
        </div>
        <div class="grid__info">
          <h3 class="grid__title">{{ item.title }}</h3>
          <p class="grid__desc">{{ item.desc }}</p>
        </div>
      </article>
    </section>

    <!-- ====== CTA Section ====== -->
    <section class="cta">
      <div class="cta__glow" />
      <div class="cta__rule" data-reveal />
      <h2 class="cta__title" data-reveal>
        有问题？<br />直接问 <span class="cta__brand">数智校答</span>
      </h2>
      <div class="cta__input" data-reveal @click="emit('openChat')">
        <span>输入你的校园问题...</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </section>

    <!-- ====== Footer ====== -->
    <footer class="augen-footer">
      <div class="augen-footer__inner">
        <div class="augen-footer__brand">
          <span class="augen-footer__logo">数智校答</span>
          <span class="augen-footer__tagline">校园智能服务平台</span>
        </div>
        <nav class="augen-footer__nav">
          <span class="augen-footer__nav-label">导航</span>
          <a @click="emit('openChat')">AI 问答</a>
          <a @click="emit('openCommunity')">学生社区</a>
        </nav>
      </div>
      <div class="augen-footer__bottom">
        <span>基于 LightRAG 智能检索</span>
        <span>广东第二师范学院</span>
        <span>&copy; 2026</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const emit = defineEmits<{
  (e: 'openChat'): void
  (e: 'openCommunity'): void
}>()

const loaderRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const marqueeRef = ref<HTMLElement | null>(null)
const heroVideoFailed = ref(false)
const heroVideoSources = {
  webm: '/videos/prism-glass-bg.webm',
  mp4: '/videos/prism-glass-bg.mp4',
}
let marqueeRaf = 0

// ---- Custom cursor ----
const cursorRef = ref<HTMLElement | null>(null)
const cursorView = ref(false)
const cursorHidden = ref(true)
let cursorX = 0
let cursorY = 0
let cursorRaf = 0
const interactiveSelector = 'a, button, .grid__item, .cta__input, .marquee__pill, [data-cursor-view]'

function onHeroVideoError() {
  heroVideoFailed.value = true
}

function onCursorMove(e: MouseEvent) {
  cursorX = e.clientX
  cursorY = e.clientY
  cursorHidden.value = false
}

function onCursorHover(e: MouseEvent) {
  const target = (e.target as HTMLElement)?.closest?.(interactiveSelector)
  cursorView.value = !!target
}

function tickCursor() {
  const el = cursorRef.value
  if (!el) return
  el.style.left = cursorX + 'px'
  el.style.top = cursorY + 'px'
  cursorRaf = requestAnimationFrame(tickCursor)
}

function onCursorLeave() {
  cursorHidden.value = true
  cursorView.value = false
}

// Scroll reveal
function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })

  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
}


const allMarqueeTags = Array(4).fill(null).flatMap(() => [{ text: "转专业申请", bg: "#e8f0fe", fg: "#1967d2" },{ text: "奖学金评定", bg: "#fce8e6", fg: "#c5221f" },{ text: "宿舍报修", bg: "#e6f4ea", fg: "#137333" },{ text: "考试安排", bg: "#fef7e0", fg: "#e37400" },{ text: "选课指南", bg: "#f3e8fd", fg: "#7b1fa2" },{ text: "校园卡办理", bg: "#e0f2f1", fg: "#00695c" },{ text: "社团活动", bg: "#fce4ec", fg: "#c62828" },{ text: "图书馆借阅", bg: "#e8eaf6", fg: "#283593" }])

// Grid items — 每个卡片带独立强调色
const gridItems = [
  { icon: '📚', tag: '选课', title: '课程与选课', desc: '选课时间、课程查询、转专业申请流程', wide: false, color: '#1967d2', bg: '#e8f0fe' },
  { icon: '🎓', tag: '奖学金', title: '奖学金评定', desc: '申请条件、材料准备、截止日期提醒', wide: false, color: '#c5221f', bg: '#fce8e6' },
  { icon: '🏠', tag: '生活', title: '宿舍与校园生活', desc: '宿舍报修、设施使用、生活服务指南', wide: true, color: '#137333', bg: '#e6f4ea' },
  { icon: '📝', tag: '考试', title: '考试与成绩', desc: '考试安排、成绩查询、补考重修流程', wide: false, color: '#e37400', bg: '#fef7e0' },
  { icon: '💡', tag: '社区', title: '学生经验社区', desc: '发帖提问、回复分享、知识沉淀', wide: false, color: '#7b1fa2', bg: '#f3e8fd' },
  { icon: '🔒', tag: '管理', title: '内容审核管理', desc: '管理员审核、知识入库、质量把控', wide: false, color: '#00695c', bg: '#e0f2f1' },
]

function startMarquee() {
  const track = marqueeRef.value
  if (!track) return
  const trackElement = track
  // 4 copies of tags, scroll by 1/4 of total for seamless wrap
  const chunkWidth = trackElement.scrollWidth / 4
  let offset = 0
  function tick() {
    offset -= 0.84
    if (offset <= -chunkWidth) offset += chunkWidth
    trackElement.style.transform = 'translateX(' + offset + 'px)'
    marqueeRaf = requestAnimationFrame(tick)
  }
  marqueeRaf = requestAnimationFrame(tick)
}

onMounted(() => {
  // Custom cursor
  const augen = document.querySelector('.augen') as HTMLElement | null
  augen?.addEventListener('mousemove', onCursorMove, { passive: true })
  augen?.addEventListener('mouseover', onCursorHover, { passive: true })
  augen?.addEventListener('mouseleave', onCursorLeave)
  cursorRaf = requestAnimationFrame(tickCursor)

  const loader = loaderRef.value
  const text = textRef.value
  if (!loader || !text) return
  const loaderElement = loader
  const textElement = text
  startMarquee()

  // Fade in text (CSS transition on inline style)
  textElement.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out'
  textElement.style.opacity = '0'
  textElement.style.transform = 'scale(0.88)'
  requestAnimationFrame(() => {
    textElement.style.opacity = '1'
    textElement.style.transform = 'scale(1)'
  })

  // Start breathing after fade-in (RAF loop)
  let breathRaf = 0
  const breathStart = performance.now() + 500
  function breathe(now: number) {
    const t = (now - breathStart) * 0.003
    if (t > 0) {
      const s = Math.sin(t)
      textElement.style.opacity = String(0.65 + s * 0.25)
      textElement.style.transform = `scale(${1 + s * 0.02})`
    }
    if (now - breathStart < 1300) {
      breathRaf = requestAnimationFrame(breathe)
    } else {
      // Slide out
      textElement.style.transition = 'none'
      loaderElement.style.transition = 'transform 0.5s cubic-bezier(0.76,0,0.24,1), opacity 0.5s ease-in'
      loaderElement.style.transform = 'translateY(-100%)'
      loaderElement.style.opacity = '0'
      setTimeout(() => {
        loaderElement.style.display = 'none'
        setupReveal()
      }, 550)
    }
  }
  setTimeout(() => {
    breathRaf = requestAnimationFrame(breathe)
  }, 500)
})

onUnmounted(() => {
  cancelAnimationFrame(cursorRaf)
  const augen = document.querySelector('.augen') as HTMLElement | null
  augen?.removeEventListener('mousemove', onCursorMove)
  augen?.removeEventListener('mouseover', onCursorHover)
  augen?.removeEventListener('mouseleave', onCursorLeave)
})
</script>

<style scoped>
/* ==========================================================================
   Linear / Vercel style — warm white × near-black
   ========================================================================== */

.augen {
  --bg: #faf9f7;
  --card: #ffffff;
  --card-hover: #f5f4f2;
  --line: rgba(0,0,0,0.06);
  --line-strong: rgba(0,0,0,0.1);
  --ink: #1a1a18;
  --ink-muted: rgba(26,26,24,0.45);
  --ink-faint: rgba(26,26,24,0.22);
  --accent: #5e6ad2;
  --accent-light: rgba(94,106,210,0.08);

  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  overflow-x: hidden;
}

/* ---- Noise ---- */
.noise {
  position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.015;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---- Custom Cursor ---- */
.cursor {
  position: fixed; z-index: 9999; pointer-events: none;
  width: 4.5rem; height: 4.5rem;
  margin-left: -2.25rem; margin-top: -2.25rem;
  border-radius: 50%;
  background: rgba(0,0,0,0.04);
  backdrop-filter: blur(0.5rem);
  -webkit-backdrop-filter: blur(0.5rem);
  border: 0.5px solid rgba(0,0,0,0.1);
  display: grid; place-items: center;
  transition: width 0.3s, height 0.3s, margin 0.3s, background 0.3s, border-color 0.3s, opacity 0.2s;
  opacity: 0;
}
.cursor.is-view {
  width: 6.5rem; height: 6.5rem; margin-left: -3.25rem; margin-top: -3.25rem;
  background: var(--accent-light);
  border-color: rgba(94,106,210,0.3);
}
.cursor.is-hidden { opacity: 0; }
.cursor__label {
  font-size: 0.625rem; font-weight: 600; letter-spacing: 0.08em;
  color: var(--accent); opacity: 0; transition: opacity 0.2s;
}
.cursor.is-view .cursor__label { opacity: 1; }


/* Loading styles in non-scoped block below */

/* ---- Hero video stage ---- */
.hero-stage {
  position: relative;
  z-index: 1;
  overflow: hidden;
  isolation: isolate;
  background: #f8f7f4;
}

.hero-stage__video,
.hero-stage__fallback,
.hero-stage__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-stage__video {
  z-index: -3;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.84;
  filter: saturate(1.32) contrast(1.02) brightness(1.03);
}

.hero-stage__fallback {
  z-index: -4;
  opacity: 0.96;
  background:
    radial-gradient(ellipse 36% 28% at 18% 28%, rgba(93, 177, 255, 0.58), transparent 66%),
    radial-gradient(ellipse 30% 36% at 80% 18%, rgba(132, 105, 255, 0.46), transparent 68%),
    radial-gradient(ellipse 44% 30% at 56% 78%, rgba(82, 218, 190, 0.48), transparent 64%),
    radial-gradient(ellipse 30% 24% at 18% 78%, rgba(255, 187, 122, 0.32), transparent 64%),
    linear-gradient(120deg, #f7fbff 0%, #dfeeff 42%, #f1ebff 68%, #effaf1 100%);
  background-size: 116% 116%, 124% 124%, 132% 132%, 120% 120%, 100% 100%;
  animation: prism-video-fallback 18s ease-in-out infinite alternate;
  filter: saturate(1.24) contrast(1.03);
}

.hero-stage__fallback.is-visible {
  opacity: 1;
}

.hero-stage__veil {
  z-index: -2;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.08) 48%, rgba(255,255,255,0.58) 100%),
    linear-gradient(90deg, rgba(255,255,255,0.58), rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.48)),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23f)' opacity='.34'/%3E%3C/svg%3E");
  background-size: 100% 100%, 100% 100%, 9rem 9rem;
  backdrop-filter: blur(0.65rem) saturate(1.12);
  -webkit-backdrop-filter: blur(0.65rem) saturate(1.12);
  mix-blend-mode: normal;
}

/* ---- Hero ---- */
.hero {
  position: relative; z-index: 1;
  overflow: visible;
  min-height: 55vh;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
}

/* Frosted glass card — blurs the gradient + orbs behind it */
.hero__glass {
  position: relative; z-index: 2;
  width: min(88vw, 46rem);
  padding: clamp(3.25rem, 8vh, 6.5rem) clamp(2rem, 5vw, 4.5rem);
  display: flex; flex-direction: column; align-items: center;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.48), rgba(246,247,250,0.16) 46%, rgba(255,255,255,0.32)),
    radial-gradient(circle at 18% 14%, rgba(255,255,255,0.58), transparent 24%),
    radial-gradient(circle at 76% 72%, rgba(94,106,210,0.14), transparent 38%);
  backdrop-filter: blur(3.5rem) saturate(1.18) contrast(0.96);
  -webkit-backdrop-filter: blur(3.5rem) saturate(1.18) contrast(0.96);
  border: 1px solid rgba(255,255,255,0.58);
  border-radius: clamp(1.25rem, 2vw, 2rem);
  box-shadow:
    0 1.5rem 5.5rem rgba(31,35,66,0.1),
    0 0.35rem 1.4rem rgba(31,35,66,0.055),
    inset 0 1px 0 rgba(255,255,255,0.72),
    inset 0 -1px 0 rgba(255,255,255,0.2);
}

.hero__glass::before,
.hero__glass::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
}

.hero__glass::before {
  z-index: -1;
  background:
    linear-gradient(115deg, transparent 0 22%, rgba(255,255,255,0.42) 34%, transparent 48% 100%),
    linear-gradient(180deg, rgba(255,255,255,0.32), transparent 42%, rgba(255,255,255,0.16));
  opacity: 0.5;
  transform: translateX(-16%);
  animation: glass-sheen 8s ease-in-out infinite;
}

.hero__glass::after {
  border: 1px solid rgba(255,255,255,0.34);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.14),
    inset 0 0.85rem 2.4rem rgba(255,255,255,0.22);
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23f)' opacity='.42'/%3E%3C/svg%3E"),
    linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
  background-size: 11rem 11rem, 3.5rem 3.5rem, 3.5rem 3.5rem;
  mask-image: radial-gradient(circle at 50% 50%, black 0 56%, transparent 88%);
  opacity: 0.38;
  mix-blend-mode: overlay;
}

.hero__text { position: relative; z-index: 1; text-align: center; }

.hero__title {
  margin: 0;
  font-size: clamp(3.5rem, 10vw, 8rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.9;
  color: var(--ink);
  display: grid; gap: 0;
  justify-items: center;
}
.hero__title .line {
  display: block;
  position: relative;
}
.hero__title .dot { color: var(--accent); }

.hero__sub {
  margin: clamp(1rem, 2vw, 1.5rem) 0 0;
  font-size: clamp(1rem, 1.8vw, 1.25rem);
  color: rgba(26,26,24,0.56);
  letter-spacing: -0.01em; font-weight: 400;
  text-shadow: 0 1px 0 rgba(255,255,255,0.45);
}

/* ---- Marquee ---- */
.marquee {
  position: relative; z-index: 1;
  border-top: 1px solid rgba(255,255,255,0.62);
  border-bottom: 1px solid rgba(31,35,66,0.06);
  padding: 0.7rem 0;
  display: flex; align-items: center;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.22)),
    rgba(255,255,255,0.32);
  backdrop-filter: blur(1.7rem) saturate(1.28) contrast(0.94);
  -webkit-backdrop-filter: blur(1.7rem) saturate(1.28) contrast(0.94);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.84),
    inset 0 -1px 0 rgba(255,255,255,0.3),
    0 0.8rem 2.2rem rgba(31,35,66,0.045);
}
.marquee__label {
  flex-shrink: 0;
  padding: 0.48rem 0.92rem;
  border-radius: var(--radius-pill);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.02)),
    rgba(26,26,24,0.78);
  color: #fff;
  font-size: var(--font-size-caption);
  font-weight: 600;
  margin-left: var(--space-4);
  z-index: 2;
  margin-right: var(--space-3);
  border: 1px solid rgba(255,255,255,0.28);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.24),
    0 0.45rem 1rem rgba(0,0,0,0.1);
}
.marquee__track {
  display: flex;
  gap: 0.55rem;
  mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%);
}
.marquee__pill {
  all: unset;
  position: relative;
  flex-shrink: 0;
  padding: 0.5rem 1.08rem;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-subhead);
  font-weight: 600;
  color: var(--pill-fg);
  text-shadow: 0 1px 0 rgba(255,255,255,0.38);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.24)),
    radial-gradient(circle at 18% 18%, rgba(255,255,255,0.86), transparent 34%),
    color-mix(in srgb, var(--pill-bg) 44%, rgba(255,255,255,0.64));
  border: 1px solid rgba(255,255,255,0.72);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.92),
    inset 0 -1px 0 rgba(255,255,255,0.18),
    inset 0 0 1.15rem rgba(255,255,255,0.26),
    0 0.42rem 1.15rem rgba(31,35,66,0.075);
  backdrop-filter: blur(1.65rem) saturate(1.35) contrast(0.92);
  -webkit-backdrop-filter: blur(1.65rem) saturate(1.35) contrast(0.92);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.marquee__pill::before,
.marquee__pill::after {
  content: '';
  position: absolute;
  pointer-events: none;
}
.marquee__pill::before {
  inset: 0.08rem 0.12rem auto;
  height: 42%;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.68), transparent);
  opacity: 0.82;
}
.marquee__pill::after {
  inset: 0;
  border-radius: inherit;
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.35' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"),
    linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0));
  background-size: 6rem 6rem, 100% 100%;
  opacity: 0.3;
  mix-blend-mode: overlay;
}
.marquee__pill:hover {
  transform: translateY(-0.08rem) scale(1.035);
  border-color: rgba(255,255,255,0.82);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.84),
    0 0.7rem 1.45rem rgba(31,35,66,0.11);
}

/* ---- Grid ---- */
.grid {
  position: relative; z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: clamp(2rem, 5vw, 4rem) 0.75rem;
  max-width: 64rem; margin: 0 auto;
}

.grid__item {
  position: relative;
  padding: clamp(1.75rem, 3.5vw, 2.5rem);
  border-radius: 1rem;
  background: var(--card);
  border: 1px solid var(--line);
  transition: all 0.3s cubic-bezier(0,0,0.2,1);
  display: grid; gap: var(--space-4);
  align-content: start;
  overflow: hidden;
}
.grid__item::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 1rem;
  border-left: 3px solid transparent;
  transition: border-color 0.3s ease;
  pointer-events: none; z-index: 1;
}
.grid__item:hover {
  background: var(--card-hover);
  border-color: var(--line-strong);
  box-shadow: 0 2px 4px rgba(0,0,0,0.02), 0 12px 32px rgba(0,0,0,0.07);
  transform: translateY(-2px);
}
.grid__item:hover::before {
  border-left-color: var(--accent);
}
.grid__item--wide { grid-column: span 2; }

.grid__icon {
  font-size: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: #f5f4f2;
}
.grid__item:hover .grid__icon {
  transform: scale(1.08);
  transition: transform 0.25s ease;
}

.grid__tag {
  display: inline-block; margin-top: var(--space-3);
  font-size: 0.6875rem; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
}

.grid__title {
  margin: 0;
  font-size: clamp(1.125rem, 1.8vw, 1.5rem);
  font-weight: 600; letter-spacing: -0.02em;
  color: var(--ink);
}
.grid__desc {
  margin: var(--space-1) 0 0;
  font-size: 0.875rem;
  color: var(--ink-muted);
  line-height: 1.65; max-width: 34ch;
}

/* ---- CTA ---- */
.cta {
  position: relative; z-index: 1;
  padding: clamp(5rem, 12vh, 9rem) clamp(1.5rem, 6vw, 4rem);
  text-align: center;
  overflow: hidden;
}

.cta__glow {
  position: absolute; top: 50%; left: 50%;
  width: 32rem; height: 16rem;
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse, rgba(94,106,210,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.cta__rule {
  width: 2rem; height: 2px;
  margin: 0 auto clamp(2rem, 3vw, 2.5rem);
  background: var(--line-strong);
  border-radius: 999px;
}

.cta__title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 700; letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--ink);
}
.cta__brand { color: var(--accent); }

.cta__input {
  display: inline-flex; align-items: center; gap: var(--space-3);
  margin-top: clamp(2rem, 3vw, 2.5rem);
  padding: 0.875rem 1.5rem;
  border-radius: 0.75rem;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0,0,0.2,1);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.cta__input:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(0,0,0,0.03), 0 12px 32px rgba(94,106,210,0.1);
  color: var(--ink);
}
.cta__input svg { opacity: 0.2; transition: opacity 0.2s, transform 0.2s; color: var(--accent); }
.cta__input:hover svg { opacity: 0.6; transform: translateX(3px); }

/* ---- Footer ---- */
.augen-footer {
  position: relative; z-index: 1;
  padding: clamp(3rem, 6vh, 5rem) clamp(1.5rem, 6vw, 4rem);
  border-top: 1px solid var(--line);
}
.augen-footer__inner {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: var(--space-8);
  max-width: 64rem; margin: 0 auto;
}
.augen-footer__brand {
  display: grid; gap: var(--space-1);
}
.augen-footer__logo {
  font-size: 1.125rem; font-weight: 700; letter-spacing: -0.02em;
  color: var(--ink);
}
.augen-footer__tagline {
  font-size: 0.8125rem; color: var(--ink-faint);
}
.augen-footer__nav {
  display: grid; gap: 0.375rem;
  justify-items: end;
}
.augen-footer__nav-label {
  font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ink-faint);
  margin-bottom: 0.25rem;
}
.augen-footer__nav a {
  font-size: 0.875rem; color: var(--ink-muted);
  transition: color 0.2s;
}
.augen-footer__nav a:hover { color: var(--ink); }
.augen-footer__bottom {
  display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-4);
  margin-top: clamp(2rem, 4vh, 3rem);
  padding-top: clamp(1.5rem, 3vh, 2rem);
  border-top: 1px solid var(--line);
  font-size: 0.75rem; color: var(--ink-faint);
}

/* ---- Reveal ---- */
[data-reveal] {
  opacity: 0; transform: translateY(2rem);
  transition: opacity 0.6s cubic-bezier(0,0,0.2,1), transform 0.6s cubic-bezier(0,0,0.2,1);
  transition-delay: calc(var(--i, 0) * 0.05s);
}
[data-reveal].revealed { opacity: 1; transform: translateY(0); }

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr; padding: 2rem 1rem; }
  .grid__item--wide { grid-column: span 1; }
  .cursor { display: none; }
  .augen { cursor: auto; }
  .hero__title { font-size: clamp(2.5rem, 14vw, 4rem); }
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
  .hero__glass::before { animation: none !important; }
  .hero-stage__fallback { animation: none !important; }
  .hero-stage__video { display: none; }
}
</style>

<style>
@keyframes prism-video-fallback {
  0% {
    background-position: 0% 18%, 100% 12%, 44% 96%, 0% 92%, 50% 50%;
    transform: scale(1);
  }
  42% {
    background-position: 22% 4%, 78% 36%, 58% 72%, 18% 70%, 50% 50%;
    transform: scale(1.035);
  }
  100% {
    background-position: 38% 34%, 56% 6%, 72% 86%, 34% 54%, 50% 50%;
    transform: scale(1.06);
  }
}

@keyframes glass-sheen {
  0%, 100% { transform: translateX(-22%); opacity: 0.34; }
  42% { transform: translateX(18%); opacity: 0.74; }
  64% { transform: translateX(28%); opacity: 0.22; }
}

</style>
