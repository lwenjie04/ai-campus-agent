<template>
  <div
    class="app-layout"
    :class="{ 'app-layout--agent': isAgentLayout }"
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
            :class="{ 'top-nav__tab--active': isHomeActive }"
            data-testid="nav-service-desk"
            @click="goHome"
          >
            <span class="top-nav__index">01</span>
            <span>智能服务台</span>
          </button>
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': isCommunityActive }"
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
            :class="{ 'top-nav__tab--active': isAdminActive }"
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

    <div v-if="pendingIntent" class="intent-banner" role="status">
      <span class="intent-banner__text">上次未完成的操作：{{ intentLabel }}</span>
      <span class="intent-banner__actions">
        <button type="button" class="intent-banner__primary" @click="resumeIntent">继续</button>
        <button type="button" class="intent-banner__secondary" @click="dismissIntent">忽略</button>
      </span>
    </div>

    <main
      class="page-content"
      :class="{ 'page-content--agent': isAgentLayout }"
    >
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-on="routeListeners" />
      </RouterView>
    </main>
  </div>

  <!-- 登录弹窗：未登录访问受限入口时弹出，登录成功后回到原目标。 -->
  <el-dialog
    v-model="loginDialogVisible"
    :show-close="false"
    width="min(62rem, calc(100vw - 1.5rem))"
    append-to-body
    :close-on-click-modal="true"
    class="login-dialog"
    @closed="handleDialogClosed"
  >
    <LoginView @login-success="handleLoginSuccess" />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './store/auth'
import { useSessionLifecycle } from './composables/useSessionLifecycle'
import { useAuthIntentStore, type AuthIntent } from './store/auth-intent'
import { intentDestination } from './store/auth-intent-destination'
import { safeInternalPath } from './router/return-to'

// 登录页按需加载，首屏只加载当前路由的页面组件。
const LoginView = defineAsyncComponent(() => import('./views/LoginView.vue'))

const authStore = useAuthStore()
const authIntentStore = useAuthIntentStore()
const route = useRoute()
const router = useRouter()
const pendingIntent = ref<AuthIntent | null>(null)

// 登录/退出时切换会话作用域并清理界面；注册一次即可。
useSessionLifecycle()

const intentLabel = computed(() => {
  if (!pendingIntent.value) return ''
  if (pendingIntent.value.type === 'open-post') return '打开校园社区帖子'
  if (pendingIntent.value.type === 'enter-admin') return '进入知识运营后台'
  return '继续上次操作'
})

const loginDialogVisible = ref(false)

const isAgentLayout = computed(() => route.meta.layout === 'agent')
const isHomeActive = computed(
  () => route.name === 'home' || route.name === 'chat' || route.name === 'chat-new',
)
const isCommunityActive = computed(() => route.path.startsWith('/community'))
const isAdminActive = computed(() => route.path.startsWith('/admin'))

const openLogin = () => {
  loginDialogVisible.value = true
}

const goHome = () => {
  router.push('/')
}

const goCommunity = () => {
  // 未登录时由路由守卫跳回首页并给出登录意图，登录成功后自动回到 /community。
  router.push('/community')
}

const goAdmin = () => {
  if (!authStore.isAdmin) return
  router.push('/admin/review')
}

const openPostFromSource = (postId: string) => {
  if (!postId) return
  router.push(`/community/posts/${encodeURIComponent(postId)}`)
}

const backToCommunityList = () => {
  router.push('/community')
}

// 只给当前页面绑定它真正会发出的事件，避免无关监听器落到根节点上。
type RouteListener = (...args: never[]) => void
const routeListeners = computed<Record<string, RouteListener>>(() => {
  const listeners: Record<string, RouteListener> = {}

  switch (String(route.name || '')) {
    case 'home':
    case 'chat':
    case 'chat-new':
    case 'chat-detail':
      listeners['open-community-post'] = openPostFromSource
      listeners['require-login'] = openLogin
      break
    case 'community':
      listeners['open-post'] = openPostFromSource
      break
    case 'community-post':
      listeners['back-list'] = backToCommunityList
      break
    case 'admin-review':
    case 'admin-retrieval':
      listeners['go-login'] = goHome
      listeners.logout = logout
      break
    default:
      break
  }

  return listeners
})

// 执行一条已确认的登录后意图；返回是否已经处理（避免再走 redirect）。
const runIntent = (intent: AuthIntent): boolean => {
  const destination = intentDestination(intent)
  if (!destination) return false

  authIntentStore.consume(intent.intentId)
  pendingIntent.value = null
  void router.replace(destination)
  return true
}

const handleLoginSuccess = () => {
  loginDialogVisible.value = false

  // 登录前明确提交的动作只执行一次。
  const intent = authIntentStore.peek()
  if (intent && intent.type !== 'send-question' && runIntent(intent)) return

  // 只接受站内路径，避免登录后被带到外部地址。
  const redirect = safeInternalPath(route.query.redirect)
  if (redirect) {
    router.replace(redirect)
  }
}

const handleDialogClosed = () => {
  // 取消登录保留意图，但本轮不执行；刷新后由顶部提示条再次确认。
  const intent = authIntentStore.peek()
  if (intent && intent.type !== 'send-question') pendingIntent.value = intent

  // 清掉一次性参数，避免刷新后再次弹出登录框。
  if (!route.query.login && !route.query.redirect) return

  const query = { ...route.query }
  delete query.login
  delete query.redirect
  router.replace({ path: route.path, query })
}

const resumeIntent = () => {
  if (!pendingIntent.value) return
  if (!authStore.loggedIn) {
    openLogin()
    return
  }
  if (!runIntent(pendingIntent.value)) pendingIntent.value = null
}

const dismissIntent = () => {
  authIntentStore.clear()
  pendingIntent.value = null
}

onMounted(() => {
  // 刷新恢复时先确认，不自动执行任何待办动作。
  const intent = authIntentStore.peek()
  if (intent && intent.type !== 'send-question') pendingIntent.value = intent
})

const logout = () => {
  authStore.logout()
  router.push('/')
}

watch(
  () => route.query.login,
  (value) => {
    if (value === '1') loginDialogVisible.value = true
  },
  { immediate: true },
)
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

.intent-banner {
  position: relative;
  z-index: 2;
  width: min(100%, 108rem);
  margin: 0.6rem auto 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  border: 1px solid var(--line-strong);
  border-left: 0.3rem solid var(--teal);
  padding: 0.6rem 0.8rem;
  background: var(--paper-raised);
  box-shadow: var(--shadow-sm);
  font-size: 0.8rem;
}

.intent-banner__text {
  min-width: 0;
  color: var(--ink-soft);
}

.intent-banner__actions {
  display: inline-flex;
  gap: 0.45rem;
}

.intent-banner__primary,
.intent-banner__secondary {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.intent-banner__primary {
  border-color: var(--ink);
  color: var(--white);
  background: var(--ink);
}

.intent-banner__secondary {
  color: var(--ink-soft);
  background: transparent;
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
