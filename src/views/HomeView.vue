<template>
  <div class="home">
    <section class="hero">
      <p class="hero__kicker">数智校答</p>
      <h1 class="hero__title">校园智能问答</h1>
      <p class="hero__lead">查询教务、考试、奖助学金和生活服务信息。</p>

      <div class="hero__actions">
        <el-button type="primary" class="hero__cta" round @click="startChat">开始提问</el-button>
        <button type="button" class="hero__help" @click="emit('open-help')">
          使用说明
          <img src="/icons/chevron-right.svg" alt="" aria-hidden="true" />
        </button>
      </div>

      <!-- 界面预览：只展示静态示例，不是真实会话，也不提供可聚焦的假输入框。 -->
      <div class="preview" role="img" aria-label="问答界面预览">
        <div class="preview__top">
          <span class="preview__brand">
            <img src="/icons/brand-messages-square.svg" alt="" aria-hidden="true" />
            数智校答
          </span>
          <span class="preview__tag">
            <img src="/icons/shield-check.svg" alt="" aria-hidden="true" />
            官方资料优先 · 回答附来源
          </span>
        </div>

        <div class="preview__body">
          <aside class="preview__side">
            <span class="preview__new">新建对话</span>
            <span class="preview__side-nav">
              <img src="/icons/brand-messages-square.svg" alt="" aria-hidden="true" />
              智能问答
            </span>
            <span class="preview__side-label">最近对话</span>
            <span class="preview__side-item">转专业需要什么条件？</span>
            <span class="preview__side-item">奖助学金申请材料</span>
            <span class="preview__side-item">宿舍报修入口</span>
            <span class="preview__side-foot">校园信息查询</span>
          </aside>

          <div class="preview__main">
            <h3>转专业需要什么条件？</h3>
            <p class="preview__answer">先核对本学年通知，再确认申请资格与接收要求。</p>
            <p class="preview__note">资格、材料和办理时间，逐项确认。历史通知仅供了解流程。</p>
            <div class="preview__steps">
              <span>01 核对申请资格</span>
              <span>02 查看专业要求</span>
              <span>03 确认办理入口</span>
            </div>
            <p class="preview__source">
              <img src="/icons/file-text.svg" alt="" aria-hidden="true" />
              官方通知 · 关于2025年普通本科生转专业工作的通知
            </p>
            <div class="preview__input">
              <span>继续追问校园事项…</span>
              <span class="preview__send">
                <img src="/icons/send-arrow-up.svg" alt="" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="services">
      <h2 class="services__title">常办事项</h2>
      <div class="services__grid">
        <button
          v-for="category in SERVICE_CATEGORIES"
          :key="category.id"
          type="button"
          class="service-card"
          @click="openCategory(category.id)"
        >
          <span class="service-card__label">{{ category.label }}</span>
          <strong class="service-card__title">{{ category.title }}</strong>
          <span class="service-card__desc">{{ category.description }}</span>
          <span class="service-card__plus" aria-hidden="true">
            <img src="/icons/plus.svg" alt="" />
          </span>
        </button>
      </div>
    </section>

    <footer class="home-footer">
      <p class="home-footer__note">
        官方资料有出处，社区经验有标识。涉及办理条件与时间，请以学校最新通知为准。
      </p>
      <div class="home-footer__row">
        <span class="home-footer__brand">
          <img src="/icons/brand-messages-square.svg" alt="" aria-hidden="true" />
          数智校答
        </span>
        <span class="home-footer__meta">校园服务 · 来源可查 · 按需讲解</span>
        <span class="home-footer__meta">设计概念 / Direction B</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { SERVICE_CATEGORIES, type ServiceCategoryId } from '@/data/services'

const emit = defineEmits<{
  (e: 'open-help'): void
}>()

const router = useRouter()

const startChat = () => {
  void router.push('/chat/new')
}

const openCategory = (category: ServiceCategoryId) => {
  void router.push({ path: '/services', query: { category } })
}
</script>

<style scoped>
.home {
  min-height: 100%;
  background: var(--white);
}

.hero {
  padding: clamp(3rem, 7vw, 5.5rem) 1.5rem clamp(2.5rem, 5vw, 4rem);
  text-align: center;
}

.hero__kicker {
  margin: 0;
  color: var(--muted);
  font-size: 1rem;
}

.hero__title {
  margin: 0.9rem 0 0;
  color: var(--text);
  font-size: clamp(2.6rem, 5vw, 4.5rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.hero__lead {
  margin: 1.1rem 0 0;
  color: var(--muted);
  font-size: 1.0625rem;
  line-height: 1.7;
}

.hero__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 1.9rem;
}

.hero__cta {
  min-height: 2.9rem;
  padding-inline: 1.6rem;
  font-size: 0.95rem;
}

.hero__help {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  padding: 0.4rem 0.2rem;
  color: var(--link);
  background: transparent;
  font-size: 0.95rem;
  cursor: pointer;
}

.hero__help img {
  width: 0.9rem;
  height: 0.9rem;
}

.preview {
  width: min(100%, 1000px);
  margin: clamp(2.5rem, 5vw, 4rem) auto 0;
  overflow: hidden;
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
  background: var(--white);
  box-shadow: var(--shadow-lg);
  text-align: left;
}

.preview__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--soft);
  padding: 0.9rem 1.25rem;
}

.preview__brand,
.preview__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text);
  font-size: 0.82rem;
}

.preview__brand img {
  width: 1.05rem;
  height: 1.05rem;
}

.preview__tag {
  color: var(--muted);
  font-size: 0.76rem;
}

.preview__tag img {
  width: 0.95rem;
  height: 0.95rem;
}

.preview__body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 430px;
}

.preview__side {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-right: 1px solid var(--soft);
  padding: 1rem;
  background: var(--white);
}

.preview__new {
  display: inline-flex;
  justify-content: center;
  border-radius: var(--radius-pill);
  padding: 0.5rem;
  color: var(--white);
  background: var(--brand);
  font-size: 0.76rem;
  font-weight: 500;
}

.preview__side-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 10px;
  padding: 0.5rem;
  color: var(--text);
  background: var(--silver);
  font-size: 0.76rem;
  font-weight: 500;
}

.preview__side-nav img {
  width: 0.9rem;
  height: 0.9rem;
}

.preview__side-label {
  margin-top: 0.4rem;
  color: var(--faint);
  font-size: 0.7rem;
}

.preview__side-item {
  padding: 0.15rem 0.5rem;
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.6;
}

.preview__side-foot {
  margin-top: auto;
  padding: 0.5rem;
  color: var(--faint);
  font-size: 0.72rem;
}

.preview__main {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1.6rem 1.1rem;
}

.preview__main h3 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.preview__answer {
  margin: 0.9rem 0 0;
  color: var(--text);
  font-size: 0.95rem;
  line-height: 1.7;
}

.preview__note {
  margin: 0.6rem 0 1.1rem;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.65;
}

.preview__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  color: var(--muted);
  background: var(--silver);
  font-size: 0.78rem;
}

.preview__source {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.9rem 0 0;
  color: var(--link);
  font-size: 0.78rem;
}

.preview__source img {
  width: 0.9rem;
  height: 0.9rem;
}

.preview__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.55rem 0.6rem 0.55rem 1rem;
  color: var(--faint);
  font-size: 0.82rem;
}

.preview__send {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: var(--brand);
}

.preview__send img {
  width: 1rem;
  height: 1rem;
  filter: brightness(0) invert(1);
}

.services {
  padding: clamp(3rem, 6vw, 5rem) 1.5rem;
  background: var(--white);
}

.services__title {
  width: min(100%, 1028px);
  margin: 0 auto 2rem;
  font-size: clamp(2rem, 3.4vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.services__grid {
  width: min(100%, 1028px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.5rem;
}

.service-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 15rem;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  text-align: left;
  background: var(--silver);
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.service-card:hover {
  border-color: var(--border);
  background: var(--white);
}

.service-card__label {
  color: var(--muted);
  font-size: 0.82rem;
}

.service-card__title {
  color: var(--text);
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.service-card__desc {
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.6;
}

.service-card__plus {
  position: absolute;
  left: 1.5rem;
  bottom: 1.5rem;
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  background: var(--white);
}

.service-card__plus img {
  width: 1rem;
  height: 1rem;
}

.home-footer {
  border-top: 1px solid var(--soft);
  padding: 2rem 1.5rem;
  background: var(--silver);
}

.home-footer__note {
  width: min(100%, 1028px);
  margin: 0 auto 1.4rem;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.6;
}

.home-footer__row {
  width: min(100%, 1028px);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  color: var(--muted);
  font-size: 0.78rem;
}

.home-footer__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text);
  font-weight: 600;
}

.home-footer__brand img {
  width: 1rem;
  height: 1rem;
}

.home-footer__meta {
  color: var(--faint);
}

.home-footer__meta:last-child {
  margin-left: auto;
}

@media (max-width: 63.99rem) {
  .services__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 47.99rem) {
  .preview__body {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  .preview__side {
    display: none;
  }

  .preview__main {
    padding: 1.1rem;
  }

  .services__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero {
    padding-top: 2.5rem;
  }
}
</style>
