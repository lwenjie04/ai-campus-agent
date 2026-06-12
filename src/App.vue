<template>
  <div v-if="!bypassLogin && !authStore.loggedIn" class="app-auth-shell">
    <LoginView @login-success="handleLoginSuccess" />
  </div>

  <div v-else class="app-layout">
    <header class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__brand">
          <span class="top-nav__brand-badge">AI</span>
          <div>
            <strong>广东第二师范学院</strong>
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
          <span class="top-nav__auth-role">{{ authStore.isAdmin ? '管理员' : '普通用户' }}</span>
          <span class="top-nav__auth-text">{{ authStore.displayName || authStore.username }}</span>
          <button v-if="!bypassLogin" type="button" class="top-nav__tab" @click="logout">退出</button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <AgentChat v-if="activeSection === 'home'" @open-community-post="openPostFromSource" />

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
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AgentChat from './views/AgentChat.vue'
import CommunityView from './views/CommunityView.vue'
import PostDetailView from './views/PostDetailView.vue'
import AdminReviewView from './views/AdminReviewView.vue'
import LoginView from './views/LoginView.vue'
import { useAuthStore } from './store/auth'

type MainSection = 'home' | 'community' | 'admin'
type CommunityViewState = 'list' | 'detail'
type LoginRole = 'user' | 'admin'

const authStore = useAuthStore()
const activeSection = ref<MainSection>('home')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')
const bypassLogin = import.meta.env.VITE_BYPASS_LOGIN !== 'false'

const goHome = () => {
  activeSection.value = 'home'
}

const goCommunity = () => {
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

const handleLoginSuccess = (role: LoginRole) => {
  activeSection.value = role === 'admin' ? 'admin' : 'home'
}

const logout = () => {
  authStore.logout()
  if (bypassLogin) {
    authStore.enterGuestUser()
  }
  activeSection.value = 'home'
  communityView.value = 'list'
  currentPostId.value = ''
}

onMounted(() => {
  authStore.hydrate()
  if (bypassLogin && !authStore.loggedIn) {
    authStore.enterGuestUser()
  }
  if (authStore.loggedIn) {
    activeSection.value = authStore.isAdmin ? 'admin' : 'home'
  }
})
</script>

<style scoped>
.app-auth-shell {
  min-height: 100vh;
}

.app-layout {
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 8%, rgba(103, 232, 249, 0.18), transparent 26%),
    radial-gradient(circle at 78% 0%, rgba(143, 156, 255, 0.24), transparent 32%),
    linear-gradient(135deg, #070b18 0%, #101633 52%, #192052 100%);
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 14px 18px 0;
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
  border: 1px solid rgba(188, 205, 255, 0.16);
  border-radius: 24px;
  background: rgba(10, 15, 35, 0.72);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(18px);
}

.top-nav__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f7fbff;
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
  color: rgba(217, 227, 255, 0.72);
  font-size: 13px;
}

.top-nav__brand-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.32), rgba(103, 232, 249, 0.18));
  color: #eef4ff;
  font-size: 18px;
  font-weight: 800;
  border: 1px solid rgba(188, 205, 255, 0.18);
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
  background: rgba(103, 232, 249, 0.12);
  color: #bff7ff;
  font-size: 13px;
  font-weight: 700;
}

.top-nav__auth-text {
  color: rgba(217, 227, 255, 0.76);
  font-size: 14px;
  font-weight: 700;
}

.top-nav__tab {
  border: 1px solid rgba(188, 205, 255, 0.16);
  border-radius: 999px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(238, 244, 255, 0.78);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.top-nav__tab:hover {
  transform: translateY(-1px);
  color: #f7fbff;
  border-color: rgba(103, 232, 249, 0.36);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
}

.top-nav__tab--active {
  border-color: rgba(143, 156, 255, 0.46);
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.3), rgba(103, 232, 249, 0.13));
  color: #ffffff;
}

.page-content {
  padding-top: 10px;
}

@media (max-width: 900px) {
  .top-nav {
    padding: 12px 12px 0;
  }

  .top-nav__inner {
    flex-direction: column;
    align-items: stretch;
  }

  .top-nav__tabs {
    width: 100%;
  }

  .top-nav__auth {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .top-nav__tab {
    flex: 1 1 0;
  }
}
</style>
