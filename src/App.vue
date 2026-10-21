<template>
  <div
    class="app-layout"
    :class="{ 'app-layout--agent': isAgentLayout }"
  >
    <header class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__brand">
          <img
            class="top-nav__brand-mark"
            src="/icons/brand-messages-square.svg"
            alt=""
            aria-hidden="true"
          />
          <div>
            <strong>数智校答</strong>
            <span class="top-nav__brand-subtitle">校园智能问答</span>
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
            <span>智能问答</span>
          </button>
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': isCommunityActive }"
            data-testid="nav-community"
            @click="goCommunity"
          >
            <span>校园社区</span>
          </button>
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': isServicesActive }"
            data-testid="nav-services"
            @click="goServices"
          >
            <span>办事指南</span>
          </button>
          <button type="button" class="top-nav__tab" data-testid="nav-about" @click="openHelp">
            <span>关于校答</span>
          </button>
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': isAdminActive }"
            data-testid="nav-knowledge-ops"
            @click="goAdmin"
          >
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
    <LoginView @login-success="handleLoginSuccess" @close="loginDialogVisible = false" />
  </el-dialog>

  <HelpPanel v-model="helpVisible" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './store/auth'
import { useSessionLifecycle } from './composables/useSessionLifecycle'
import { useAuthIntentStore, type AuthIntent } from './store/auth-intent'
import { intentDestination } from './store/auth-intent-destination'
import { safeInternalPath } from './router/return-to'

// 登录页与帮助面板按需加载，首屏只加载当前路由页面。
const LoginView = defineAsyncComponent(() => import('./views/LoginView.vue'))
const HelpPanel = defineAsyncComponent(() => import('./components/HelpPanel.vue'))

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
const helpVisible = ref(false)

const isAgentLayout = computed(() => route.meta.layout === 'agent')
const isHomeActive = computed(
  () =>
    route.name === 'home' ||
    route.name === 'chat' ||
    route.name === 'chat-new' ||
    route.name === 'chat-detail',
)
const isCommunityActive = computed(() => route.path.startsWith('/community'))
const isServicesActive = computed(() => route.path.startsWith('/services'))
const isAdminActive = computed(() => route.path.startsWith('/admin'))

const openLogin = () => {
  loginDialogVisible.value = true
}

const openHelp = () => {
  helpVisible.value = true
}

const goHome = () => {
  router.push('/')
}

const goCommunity = () => {
  // 未登录时由路由守卫跳回首页并给出登录意图，登录成功后自动回到 /community。
  router.push('/community')
}

const goServices = () => {
  router.push('/services')
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
      listeners['open-help'] = openHelp
      break
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
  background: var(--silver);
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
  border-bottom: 1px solid var(--soft);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(16px);
}

.top-nav__inner {
  width: min(100%, 112rem);
  min-height: 4rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0 1.5rem;
}

.top-nav__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.top-nav__brand-mark {
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
}

.top-nav__brand strong {
  display: block;
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.top-nav__brand-subtitle {
  display: none;
  margin-top: 0.1rem;
  color: var(--faint);
  font-size: 0.75rem;
}

.top-nav__tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.25rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.top-nav__tabs::-webkit-scrollbar {
  display: none;
}

.top-nav__tab {
  min-width: max-content;
  min-height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-pill);
  padding: 0.45rem 0.9rem;
  color: var(--muted);
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease;
}

.top-nav__tab:hover {
  color: var(--text);
  background: var(--silver);
}

.top-nav__tab--active,
.top-nav__tab--active:hover {
  color: var(--brand);
  background: var(--tint);
}

.top-nav__auth {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
  min-width: 0;
}

.top-nav__auth .top-nav__tab {
  min-height: 2.25rem;
  padding: 0.4rem 0.65rem;
  color: var(--brand);
}

.top-nav__auth-role {
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  padding: 0.25rem 0.55rem;
  color: var(--brand);
  background: var(--tint);
  font-size: 0.75rem;
  font-weight: 500;
}

.top-nav__auth-text {
  min-width: 0;
  max-width: 9rem;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-content {
  min-width: 0;
  padding: 0;
}

.intent-banner {
  position: relative;
  z-index: 2;
  width: min(100% - 2rem, 108rem);
  margin: 0.75rem auto 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  border: 1px solid var(--soft);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.85rem;
  background: var(--white);
  box-shadow: var(--shadow-md);
  font-size: 0.8125rem;
}

.intent-banner__text {
  min-width: 0;
  color: var(--muted);
}

.intent-banner__actions {
  display: inline-flex;
  gap: 0.45rem;
}

.intent-banner__primary,
.intent-banner__secondary {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.35rem 0.8rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.intent-banner__primary {
  border-color: var(--brand);
  color: var(--white);
  background: var(--brand);
}

.intent-banner__primary:hover {
  border-color: var(--brand-hover);
  background: var(--brand-hover);
}

.intent-banner__secondary {
  color: var(--muted);
  background: var(--white);
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
  .top-nav__inner {
    flex-wrap: wrap;
    min-height: 0;
    padding: 0.6rem 1rem;
    gap: 0.4rem 0.75rem;
  }

  .top-nav__brand {
    flex: 1;
  }

  .top-nav__auth {
    margin-left: 0;
  }

  .top-nav__tabs {
    order: 3;
    flex-basis: 100%;
    justify-content: space-between;
    border-top: 1px solid var(--soft);
    padding-top: 0.4rem;
  }

  .top-nav__tab {
    padding-inline: 0.5rem;
    font-size: 0.82rem;
  }

  .top-nav__auth-text {
    max-width: 5.5rem;
  }
}

@media (min-width: 48rem) {
  .top-nav__brand-subtitle {
    display: block;
  }
}

@media (min-width: 64rem) {
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
