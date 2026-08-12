<template>
  <div
    class="app-layout"
    :class="{ 'app-layout--agent': activeSection === 'home' }"
  >
    <header class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__brand">
          <div>
            <strong>数智校答</strong>
            <span>校园智能服务平台</span>
          </div>
        </div>

        <nav class="top-nav__tabs" aria-label="主导航">
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'home' }"
            @click="goHome"
          >
            首页
          </button>
          <button
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'community' }"
            @click="goCommunity"
          >
            学生社区
          </button>
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'admin' }"
            @click="goAdmin"
          >
            管理员页
          </button>
        </nav>

        <div class="top-nav__auth">
          <template v-if="authStore.loggedIn">
            <span class="top-nav__auth-role">{{ authStore.isAdmin ? '管理员' : '普通用户' }}</span>
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
    width="min(440px, calc(100vw - 24px))"
    append-to-body
    :close-on-click-modal="true"
    class="login-dialog"
  >
    <LoginView @login-success="handleLoginSuccess" />
  </el-dialog>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'
import AgentChat from './views/AgentChat.vue'
import { useAuthStore } from './store/auth'

// 比赛首屏只同步加载主问答，登录、社区和管理后台按进入时再下载。
const LoginView = defineAsyncComponent(() => import('./views/LoginView.vue'))
const CommunityView = defineAsyncComponent(() => import('./views/CommunityView.vue'))
const PostDetailView = defineAsyncComponent(() => import('./views/PostDetailView.vue'))
const AdminReviewView = defineAsyncComponent(() => import('./views/AdminReviewView.vue'))

type MainSection = 'home' | 'community' | 'admin'
type CommunityViewState = 'list' | 'detail'
type LoginRole = 'user' | 'admin'

const authStore = useAuthStore()
const activeSection = ref<MainSection>('home')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')

// 登录弹窗：登录成功后执行的回调（用于「登录后回到刚才的操作」）
const loginDialogVisible = ref(false)
let pendingLoginAction: (() => void) | null = null

const openLogin = () => {
  loginDialogVisible.value = true
}

const requestLogin = (afterLogin?: () => void) => {
  pendingLoginAction = afterLogin || null
  loginDialogVisible.value = true
}

const goHome = () => {
  activeSection.value = 'home'
}

const goCommunity = () => {
  // 未登录访问学生社区 → 弹登录弹窗，不切换页面
  if (!authStore.loggedIn) {
    openLogin()
    return
  }
  activeSection.value = 'community'
  communityView.value = 'list'
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

const handleLoginSuccess = (_role: LoginRole) => {
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
  min-height: 100%;
  width: 100%;
  overflow-x: clip;
}

:global(body) {
  margin: 0;
}

.app-auth-shell {
  min-height: 100vh;
}

.app-layout {
  width: 100%;
  min-height: 100vh;
  overflow-x: clip;
  background:
    radial-gradient(circle at top left, rgba(241, 255, 238, 0.98), rgba(216, 248, 206, 0.92) 42%, rgba(137, 223, 98, 0.95) 100%);
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 14px 18px 0;
  box-sizing: border-box;
  backdrop-filter: blur(16px);
}

.top-nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: 1680px;
  margin: 0 auto;
  padding: 14px 20px;
  border: 1px solid rgba(103, 167, 94, 0.2);
  border-radius: 24px;
  background: rgba(251, 255, 248, 0.82);
  box-shadow: 0 14px 36px rgba(55, 116, 63, 0.12);
}

.top-nav__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #184e30;
}

.top-nav__brand strong,
.top-nav__brand span {
  display: block;
}

.top-nav__brand strong {
  font-size: 20px;
}

.top-nav__brand span {
  margin-top: 2px;
  color: rgba(24, 78, 48, 0.72);
  font-size: 13px;
}

.top-nav__tabs {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-nav__auth {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-nav__auth-role {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(97, 167, 92, 0.14);
  color: #2a6b3f;
  font-size: 13px;
  font-weight: 700;
}

.top-nav__auth-text {
  color: rgba(24, 78, 48, 0.74);
  font-size: 14px;
  font-weight: 700;
}

.top-nav__tab {
  border: 1px solid rgba(86, 157, 90, 0.18);
  border-radius: 999px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.74);
  color: rgba(23, 77, 46, 0.72);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.top-nav__tab:hover {
  transform: translateY(-1px);
  color: #1b5a37;
  box-shadow: 0 10px 22px rgba(55, 116, 63, 0.1);
}

.top-nav__tab--active {
  border-color: rgba(85, 169, 86, 0.32);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(223, 250, 214, 0.92));
  color: #20653d;
}

.page-content {
  min-width: 0;
  padding-top: 10px;
  box-sizing: border-box;
}

/*
 * 桌面端由应用壳层统一分配“导航 + 页面内容”的视口高度。
 * 只约束数字人首页，社区和管理员页继续使用正常文档滚动。
 */
@media (min-width: 981px) {
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

/* ====== 登录弹窗 ====== */
:global(.el-dialog.login-dialog) {
  border-radius: 24px;
  padding: 0;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 24px 64px rgba(30, 80, 40, 0.22);
}

:global(.el-dialog.login-dialog .el-dialog__header) {
  display: none;
}

:global(.el-dialog.login-dialog .el-dialog__body) {
  padding: 0;
}

@media (max-width: 900px) {
  .top-nav {
    padding: 12px 12px 0;
  }

  .top-nav__inner {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
  }

  .top-nav__tabs {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .top-nav__auth {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .top-nav__tab {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    padding-inline: 10px;
  }
}
</style>
