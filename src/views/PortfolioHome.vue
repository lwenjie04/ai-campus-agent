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

    <!-- ====== Hero ====== -->
    <section class="hero">
      <div class="hero__bg-orbs">
        <span class="orb orb--violet"></span>
        <span class="orb orb--amber"></span>
      </div>
      <div class="hero__glass">
        <div class="hero__text">
          <h1 class="hero__title">
            <span class="line" data-reveal>Prism</span>
            <span class="line" data-reveal>Studio<span class="dot">.</span></span>
          </h1>
          <p class="hero__sub" data-reveal>
            校园 AI 知识助手&ensp;·&ensp;LightRAG&ensp;·&ensp;Prism Core
          </p>
        </div>
      </div>
    </section>

    <!-- ====== Marquee ====== -->
    <div class="marquee">
      <span class="marquee__label">热门问题</span>
      <div ref="marqueeRef" class="marquee__track">
        <button v-for="(tag, i) in allMarqueeTags" :key="i" class="marquee__pill" :style="{ background: tag.bg, color: tag.fg }" @click="emit('openChat')">
          {{ tag.text }}
        </button>
      </div>
    </div>

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
        有问题？<br />直接问 <span class="cta__brand">Prism</span>
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
          <span class="augen-footer__logo">Prism</span>
          <span class="augen-footer__tagline">校园 AI 知识助手</span>
        </div>
        <nav class="augen-footer__nav">
          <span class="augen-footer__nav-label">导航</span>
          <a @click="emit('openChat')">AI 问答</a>
          <a @click="emit('openCommunity')">学生社区</a>
        </nav>
      </div>
      <div class="augen-footer__bottom">
        <span>基于 LightRAG · Prism Core</span>
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
let marqueeRaf = 0

// ---- Custom cursor ----
const cursorRef = ref<HTMLElement | null>(null)
const cursorView = ref(false)
const cursorHidden = ref(true)
let cursorX = 0
let cursorY = 0
let cursorRaf = 0
const interactiveSelector = 'a, button, .grid__item, .cta__input, .marquee__pill, [data-cursor-view]'

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
    offset -= 1.2
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

/* ---- Hero ---- */
.hero {
  position: relative; z-index: 1;
  overflow: visible;
  min-height: 55vh;
  display: flex; align-items: center; justify-content: center;
  /* 紫+琥珀双色渐变背景，供磨砂玻璃模糊 */
  background:
    radial-gradient(ellipse 80% 60% at 25% 25%, rgba(139,92,246,0.3), transparent 55%),
    radial-gradient(ellipse 70% 55% at 75% 35%, rgba(251,191,36,0.28), transparent 55%),
    #faf9f7;
}

/* Ambient light halos — soft glowing orbs, not hard circles */
.hero__bg-orbs {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
}
.orb {
  position: absolute; border-radius: 50%;
}
.orb--violet {
  width: 26rem; height: 26rem;
  background: radial-gradient(circle at 50% 50%, rgba(139,92,246,0.5) 0%, rgba(139,92,246,0.15) 35%, transparent 70%);
  top: 10%; left: 5%;
  animation: orb-float-violet 8s ease-in-out infinite;
}
.orb--violet::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 3rem; height: 3rem;
  margin: -1.5rem 0 0 -1.5rem;
  border-radius: 50%;
  background: rgba(255,255,255,0.7);
  filter: blur(0.5rem);
}
.orb--amber {
  width: 22rem; height: 22rem;
  background: radial-gradient(circle at 50% 50%, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.12) 35%, transparent 70%);
  top: 15%; right: 5%;
  animation: orb-float-amber 10s ease-in-out infinite;
}
.orb--amber::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 2.5rem; height: 2.5rem;
  margin: -1.25rem 0 0 -1.25rem;
  border-radius: 50%;
  background: rgba(255,255,255,0.65);
  filter: blur(0.5rem);
}

/* Frosted glass card — blurs the gradient + orbs behind it */
.hero__glass {
  position: relative; z-index: 2;
  width: min(86vw, 42rem);
  padding: clamp(3rem, 8vh, 6rem) clamp(2rem, 4vw, 4rem);
  display: flex; flex-direction: column; align-items: center;
  /* 半透明白底 + 强力毛玻璃 */
  background: rgba(255,255,255,0.35);
  backdrop-filter: blur(3rem);
  -webkit-backdrop-filter: blur(3rem);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 1.5rem;
  box-shadow:
    0 4px 24px rgba(0,0,0,0.06),
    inset 0 1px 0 rgba(255,255,255,0.5);
}

.hero__text { text-align: center; }

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
.hero__title .line { display: block; }
.hero__title .dot { color: var(--accent); }

.hero__sub {
  margin: clamp(1rem, 2vw, 1.5rem) 0 0;
  font-size: clamp(1rem, 1.8vw, 1.25rem);
  color: var(--ink-muted);
  letter-spacing: -0.01em; font-weight: 400;
}

/* ---- Marquee ---- */
.marquee {
  position: relative; z-index: 1;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 0.625rem 0;
  display: flex; align-items: center;
  overflow: hidden;
}
.marquee__label {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: #fff;
  font-size: var(--font-size-caption);
  font-weight: 600;
  margin-left: var(--space-4);
  z-index: 2;
  margin-right: var(--space-3);
}
.marquee__track {
  display: flex;
  mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%);
}
.marquee__pill {
  all: unset;
  flex-shrink: 0;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-subhead);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.marquee__pill:hover {
  transform: scale(1.06);
  box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.1);
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
  .orb { animation: none !important; }
}
</style>

<style>
@keyframes orb-float-violet {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25%  { transform: translate(14rem, -10rem) scale(1.15); }
  50%  { transform: translate(-10rem, -14rem) scale(0.85); }
  75%  { transform: translate(-14rem, 5rem) scale(1.1); }
}
@keyframes orb-float-amber {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(-16rem, 10rem) scale(1.2); }
  66%  { transform: translate(10rem, -14rem) scale(0.8); }
}
</style>
