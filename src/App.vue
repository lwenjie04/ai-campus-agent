<template>
  <div class="app-layout">
    <!--
      顶部导航固定保留：
      后续无论切到首页还是学生社区，导航本身都不需要重新创建。
    -->
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
            <span class="top-nav__auth-text">{{ authStore.displayName || '已登录' }}</span>
            <button type="button" class="top-nav__tab" @click="logout">退出</button>
          </template>
          <button
            v-else
            type="button"
            class="top-nav__tab"
            :class="{ 'top-nav__tab--active': activeSection === 'login' }"
            @click="goLogin"
          >
            登录
          </button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <AgentChat v-if="activeSection === 'home'" @open-community-post="openPostFromSource" />

      <AdminReviewView
        v-else-if="activeSection === 'admin' && authStore.isAdmin"
        @go-login="goLogin"
        @logout="logout"
      />

      <LoginView
        v-else-if="activeSection === 'login' || (activeSection === 'admin' && !authStore.isAdmin)"
        @login-success="goAdmin"
        @go-home="goHome"
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

type MainSection = 'home' | 'community' | 'admin' | 'login'
type CommunityViewState = 'list' | 'detail'

const authStore = useAuthStore()
const activeSection = ref<MainSection>('home')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')

const goHome = () => {
  activeSection.value = 'home'
}

const goCommunity = () => {
  activeSection.value = 'community'
  communityView.value = 'list'
}

const goLogin = () => {
  activeSection.value = 'login'
}

const goAdmin = () => {
  activeSection.value = authStore.isAdmin ? 'admin' : 'login'
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

const logout = () => {
  authStore.logout()
  activeSection.value = 'home'
}

onMounted(() => {
  authStore.hydrate()
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(241, 255, 238, 0.98), rgba(216, 248, 206, 0.92) 42%, rgba(137, 223, 98, 0.95) 100%);
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

.top-nav__brand-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(73, 165, 86, 0.18), rgba(173, 241, 145, 0.42));
  color: #2f7b40;
  font-size: 18px;
  font-weight: 800;
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
  }

  .top-nav__tab {
    flex: 1 1 0;
  }
}
</style>
