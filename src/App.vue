<template>
  <div
    class="app-layout"
    :class="{ 'app-layout--agent': activeSection === 'home' }"
  >
    <header class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__brand">
          <span class="top-nav__brand-mark" aria-hidden="true">校答</span>
          <div>
            <span class="top-nav__brand-kicker">GDEI / CAMPUS AI</span>
            <strong>数智校答</strong>
            <span class="top-nav__brand-subtitle">可信校园事项导办</span>
          </div>
        </div>

        <nav class="top-nav__tabs" aria-label="主导航">
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'home' }"
            data-testid="nav-service-desk"
            @click="goHome"
          >
            <span class="top-nav__index">01</span>
            <span>智能服务台</span>
          </button>
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'community' }"
            data-testid="nav-community"
            @click="goCommunity"
          >
            <span class="top-nav__index">02</span>
            <span>校园社区</span>
          </button>
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'admin' }"
            data-testid="nav-knowledge-ops"
            @click="goAdmin"
          >
            <span class="top-nav__index">03</span>
            <span>知识运营</span>
          </button>
        </nav>

        <div class="top-nav__auth">
          <template v-if="authStore.loggedIn">
            <span class="top-nav__auth-role">{{ authStore.isAdmin ? '知识运营员' : '校园用户' }}</span>
            <span class="top-nav__auth-text">{{ authStore.displayName || authStore.username }}</span>
            <button type="button" class="top-nav__tab" @click="logout">退出</button>
          </template>
          <button v-else type="button" class="top-nav__tab" @click="openLogin">登录</button>
        </div>
      </div>
    </header>

    <main
      class="page-content"
      :class="{ 'page-content--agent': activeSection === 'home' }"
    >
      <AgentChat v-if="activeSection === 'home'" @open-community-post="openPostFromSource" @require-login="openLogin" />

      <AdminReviewView
        v-else-if="activeSection === 'admin' && authStore.isAdmin"
        @go-login="goHome"
        @logout="logout"
      />

      <CommunityView
        v-else-if="activeSection === 'community' && communityView === 'list'"
        @open-post="openPostDetail"
      />

      <PostDetailView
        v-else-if="activeSection === 'community' && communityView === 'detail'"
        :post-id="currentPostId"
        @back-list="backToCommunityList"
      />
    </main>
  </div>

  <!-- 登录弹窗：未登录访问受限入口时弹出 -->
  <el-dialog
    v-model="loginDialogVisible"
    :show-close="false"
    width="min(62rem, calc(100vw - 1.5rem))"
    append-to-body
    :close-on-click-modal="true"
    class="login-dialog"
    @closed="clearPendingLoginAction"
  >
    <LoginView @login-success="handleLoginSuccess" />
  </el-dialog>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'
import AgentChat from './views/AgentChat.vue'
import { useAuthStore } from './store/auth'

// 服务台首屏只同步加载主问答，登录、社区和知识运营后台按进入时再下载。
const LoginView = defineAsyncComponent(() => import('./views/LoginView.vue'))
const CommunityView = defineAsyncComponent(() => import('./views/CommunityView.vue'))
const PostDetailView = defineAsyncComponent(() => import('./views/PostDetailView.vue'))
const AdminReviewView = defineAsyncComponent(() => import('./views/AdminReviewView.vue'))

type MainSection = 'home' | 'community' | 'admin'
type CommunityViewState = 'list' | 'detail'

const authStore = useAuthStore()
const activeSection = ref<MainSection>('home')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')

// 登录弹窗：登录成功后执行的回调（用于「登录后回到刚才的操作」）
const loginDialogVisible = ref(false)
let pendingLoginAction: (() => void) | null = null

const clearPendingLoginAction = () => {
  pendingLoginAction = null
}

const openLogin = () => {
  clearPendingLoginAction()
  loginDialogVisible.value = true
}

const requestLogin = (afterLogin?: () => void) => {
  pendingLoginAction = afterLogin || null
  loginDialogVisible.value = true
}

const goHome = () => {
  activeSection.value = 'home'
}

const goCommunityAfterLogin = () => {
  activeSection.value = 'community'
  communityView.value = 'list'
}

const goCommunity = () => {
  // 未登录访问校园社区 → 弹登录弹窗，登录成功后自动进入社区
  if (!authStore.loggedIn) {
    requestLogin(goCommunityAfterLogin)
    return
  }
  goCommunityAfterLogin()
}

const goAdmin = () => {
  if (!authStore.isAdmin) {
    activeSection.value = 'home'
    return
  }
  activeSection.value = 'admin'
}

const openPostDetail = (postId: string) => {
  currentPostId.value = postId
  activeSection.value = 'community'
  communityView.value = 'detail'
}

const openPostFromSource = (postId: string) => {
  openPostDetail(postId)
}

const backToCommunityList = () => {
  communityView.value = 'list'
}

const handleLoginSuccess = () => {
  loginDialogVisible.value = false
  if (pendingLoginAction) {
    const action = pendingLoginAction
    pendingLoginAction = null
    action()
    return
  }
  // 默认保持当前页面（如登录前在首页发消息，登录后停留原处，由 AgentChat 自动补发）
}

const logout = () => {
  authStore.logout()
  activeSection.value = 'home'
  communityView.value = 'list'
  currentPostId.value = ''
}

onMounted(() => {
  authStore.hydrate()
})
</script>


<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  min-height: 100%;
  overflow-x: clip;
}

.app-layout {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  overflow-x: clip;
  background:
    linear-gradient(rgba(17, 24, 29, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17, 24, 29, 0.045) 1px, transparent 1px),
    var(--paper);
  background-size: 2.5rem 2.5rem;
}

.app-layout::before {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: "";
  opacity: 0.34;
  background:
    radial-gradient(circle at 92% 9%, rgba(240, 79, 47, 0.2), transparent 22rem),
    radial-gradient(circle at 2% 88%, rgba(14, 140, 136, 0.14), transparent 27rem);
}

.top-nav,
.page-content {
  position: relative;
  z-index: 1;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 0.65rem 0.75rem 0;
}

.top-nav__inner {
  width: min(100%, 108rem);
  margin: 0 auto;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-raised) 93%, transparent);
  box-shadow: 0 0.3rem 0 var(--ink);
  backdrop-filter: blur(16px);
}

.top-nav__brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
}

.top-nav__brand-mark {
  width: 2.85rem;
  height: 2.85rem;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--white);
  background: var(--signal);
  font-family: var(--font-display);
  font-size: 0.86rem;
  font-weight: 900;
  letter-spacing: -0.08em;
  transform: rotate(-7deg);
}

.top-nav__brand strong,
.top-nav__brand span {
  display: block;
}

.top-nav__brand strong {
  margin-top: 0.05rem;
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.05em;
}

.top-nav__brand-kicker {
  color: var(--teal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.top-nav__brand-subtitle {
  display: none !important;
  margin-top: 0.18rem;
  color: var(--ink-soft);
  font-size: 0.72rem;
}

.top-nav__tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  scrollbar-width: none;
}

.top-nav__tabs::-webkit-scrollbar {
  display: none;
}

.top-nav__tab {
  min-width: max-content;
  min-height: 2.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 0;
  border-right: 1px solid var(--line);
  padding: 0.7rem 0.9rem;
  color: var(--ink-soft);
  background: transparent;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease;
}

.top-nav__tab:hover {
  color: var(--ink);
  background: var(--paper-deep);
}

.top-nav__tab--active {
  color: var(--white);
  background: var(--ink);
}

.top-nav__tab--active:hover {
  color: var(--white);
  background: var(--ink);
}

.top-nav__index {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
}

.top-nav__auth {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.55rem 0.7rem;
}

.top-nav__auth .top-nav__tab {
  min-height: 2.45rem;
  margin-left: auto;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.8rem;
}

.top-nav__auth-role {
  flex: 0 0 auto;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  color: #075f5c;
  background: var(--teal-soft);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 800;
}

.top-nav__auth-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-content {
  min-width: 0;
  padding: 0.75rem;
}

:global(.el-dialog.login-dialog) {
  padding: 0;
  background: var(--paper-raised);
}

:global(.el-dialog.login-dialog .el-dialog__header) {
  display: none;
}

:global(.el-dialog.login-dialog .el-dialog__body) {
  padding: 0;
}

@media (max-width: 47.99rem) {
  .top-nav__tabs > .top-nav__tab {
    min-width: 0;
    flex: 1 1 0;
    padding-inline: 0.55rem;
  }
}

@media (min-width: 48rem) {
  .top-nav {
    padding: 0.9rem 1rem 0;
  }

  .top-nav__inner {
    display: grid;
    grid-template-columns: minmax(13rem, 1fr) auto;
    align-items: center;
  }

  .top-nav__brand-subtitle {
    display: block !important;
  }

  .top-nav__tabs {
    grid-column: 1 / -1;
  }

  .top-nav__auth {
    justify-content: flex-end;
  }

  .page-content {
    padding: 1rem;
  }
}

@media (min-width: 64rem) {
  .top-nav__inner {
    grid-template-columns: minmax(15rem, 0.8fr) auto minmax(15rem, 0.8fr);
  }

  .top-nav__tabs {
    grid-column: auto;
    border: 0;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }

  .top-nav__tab {
    min-height: 4.2rem;
  }

  .top-nav__auth .top-nav__tab {
    min-height: 2.55rem;
  }

  .app-layout--agent {
    height: 100dvh;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .page-content--agent {
    min-height: 0;
    overflow: hidden;
  }
}
</style>
