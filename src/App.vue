<template>
  <div class="app-layout">
    <!-- ====== Top Nav: 首页 | 数字人 ====== -->
    <header class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__brand">
          <span class="top-nav__brand-badge">AX</span>
          <div>
            <strong>Prism</strong>
            <span>校园 AI 知识助手</span>
          </div>
        </div>

        <nav class="top-nav__tabs" aria-label="主导航">
          <button class="top-nav__tab" :class="{ 'top-nav__tab--active': activeSection === 'home' }" @click="goHome">
            首页
          </button>
          <button class="top-nav__tab" :class="{ 'top-nav__tab--active': activeSection === 'hub' }" @click="goHub">
            数字人
          </button>
        </nav>

        <div class="top-nav__auth">
          <span class="top-nav__auth-role">{{ authStore.loggedIn ? authStore.isAdmin ? '管理员' : '用户' : '访客' }}</span>
          <span class="top-nav__auth-text">{{ authStore.loggedIn ? authStore.displayName || authStore.username : '未登录' }}</span>
          <button v-if="!bypassLogin && authStore.loggedIn" type="button" class="top-nav__tab" @click="logout">退出</button>
        </div>
      </div>

      <!-- ====== Sub Nav (only in hub) ====== -->
      <div v-if="activeSection === 'hub'" class="sub-nav">
        <button class="sub-nav__tab" :class="{ 'sub-nav__tab--active': activeHubPage === 'chat' }" @click="activeHubPage = 'chat'">
          AI 问答
        </button>
        <button class="sub-nav__tab" :class="{ 'sub-nav__tab--active': activeHubPage === 'community' }" @click="activeHubPage = 'community'; communityView = 'list'">
          学生社区
        </button>
        <button v-if="authStore.isAdmin" class="sub-nav__tab" :class="{ 'sub-nav__tab--active': activeHubPage === 'admin' }" @click="activeHubPage = 'admin'">
          管理员
        </button>
      </div>
    </header>

    <!-- ====== Page Content ====== -->
    <main class="page-content">
      <Transition name="page" mode="out-in">
        <!-- Home -->
        <PortfolioHome v-if="activeSection === 'home'" key="home" @open-chat="goHubAndChat" @open-community="goHubAndCommunity" />

        <!-- Hub: digital human + sub-page -->
        <template v-else-if="activeSection === 'hub'" key="hub">
          <div v-if="requiresHubLogin" key="hub-login" class="app-auth-shell">
            <LoginView @login-success="handleLoginSuccess" />
          </div>
          <AgentChat v-else-if="activeHubPage === 'chat'" key="chat" @open-community-post="openPostFromSource" />
          <CommunityView
            v-else-if="activeHubPage === 'community' && communityView === 'list'"
            key="comm-list"
            @open-post="openPostDetail"
          />
          <PostDetailView
            v-else-if="activeHubPage === 'community' && communityView === 'detail'"
            key="comm-detail"
            :post-id="currentPostId"
            @back-list="backToCommunityList"
          />
          <div v-else class="hub-layout">
            <aside class="hub-human">
              <DigitalHumanPanel />
            </aside>
            <section class="hub-main">
              <AdminReviewView v-if="activeHubPage === 'admin' && authStore.isAdmin" key="admin" @go-login="goHome" @logout="logout" />
            </section>
          </div>
        </template>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AgentChat from './views/AgentChat.vue'
import DigitalHumanPanel from './views/DigitalHumanPanel.vue'
import PortfolioHome from './views/PortfolioHome.vue'
import CommunityView from './views/CommunityView.vue'
import PostDetailView from './views/PostDetailView.vue'
import AdminReviewView from './views/AdminReviewView.vue'
import LoginView from './views/LoginView.vue'
import { useAuthStore } from './store/auth'

type MainSection = 'home' | 'hub'
type HubPage = 'chat' | 'community' | 'admin'
type CommunityViewState = 'list' | 'detail'
type LoginRole = 'user' | 'admin'

const authStore = useAuthStore()
const activeSection = ref<MainSection>('home')
const activeHubPage = ref<HubPage>('chat')
const communityView = ref<CommunityViewState>('list')
const currentPostId = ref('')
const bypassLogin = import.meta.env.VITE_BYPASS_LOGIN === 'true'
const requiresHubLogin = computed(() => activeSection.value === 'hub' && !bypassLogin && !authStore.loggedIn)

const updateCursorGlow = () => {
  document.body.classList.toggle('has-cursor-glow', activeSection.value === 'home')
}

const goHome = () => { activeSection.value = 'home'; updateCursorGlow() }
const goHub = () => { activeSection.value = 'hub'; activeHubPage.value = 'chat'; updateCursorGlow() }
const goHubAndChat = () => { activeSection.value = 'hub'; activeHubPage.value = 'chat'; updateCursorGlow() }
const goHubAndCommunity = () => { activeSection.value = 'hub'; activeHubPage.value = 'community'; communityView.value = 'list'; updateCursorGlow() }

const openPostDetail = (postId: string) => {
  currentPostId.value = postId; communityView.value = 'detail'
}
const openPostFromSource = (postId: string) => { openPostDetail(postId) }
const backToCommunityList = () => { communityView.value = 'list' }

const handleLoginSuccess = (_role: LoginRole) => {
  activeSection.value = 'hub'
  if (!activeHubPage.value) activeHubPage.value = 'chat'
  updateCursorGlow()
}
const logout = () => {
  authStore.logout()
  if (bypassLogin) authStore.enterGuestUser()
  activeSection.value = 'home'; communityView.value = 'list'; currentPostId.value = ''
}

onMounted(() => {
  authStore.hydrate()
  if (bypassLogin && !authStore.loggedIn) authStore.enterGuestUser()
  if (authStore.loggedIn) activeSection.value = 'home'
  updateCursorGlow()
})
</script>

<style scoped>
.app-auth-shell { min-height: 100vh; }

.app-layout {
  min-height: 100vh;
  background: #faf9f7;
  font-family: var(--font-sans);
}

/* ====== Top Nav — Apple text-only style ====== */
.top-nav {
  position: sticky; top: 0; z-index: 50;
  padding: 0 var(--space-6);
  background: rgba(250,249,247,0.85);
  backdrop-filter: blur(1.5rem);
  -webkit-backdrop-filter: blur(1.5rem);
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
}

.top-nav__inner {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  max-width: 92rem; margin: 0 auto;
  height: 3rem;
}

.top-nav__brand {
  position: absolute; left: 0;
  display: flex; align-items: center; gap: 0.5rem;
  color: #1a1a18; text-decoration: none;
}
.top-nav__brand strong {
  font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;
}
.top-nav__brand span { display: none; } /* hide subtitle on desktop */

.top-nav__brand-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.75rem; height: 1.75rem; border-radius: 0.375rem;
  background: #5e6ad2;
  color: #fff; font-size: 0.7rem; font-weight: 700;
}

.top-nav__tabs {
  display: flex; align-items: center; gap: 0.125rem;
}

.top-nav__auth { position: absolute; right: 0; display: flex; align-items: center; gap: var(--space-3); }
.top-nav__auth-role {
  font-size: 0.75rem; color: rgba(26,26,24,0.4); font-weight: 500;
}
.top-nav__auth-text {
  font-size: 0.8125rem; color: rgba(26,26,24,0.6); font-weight: 500;
}

.top-nav__tab {
  all: unset;
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem; font-weight: 500;
  color: rgba(26,26,24,0.5);
  cursor: pointer;
  border-radius: 0.25rem;
  transition: color 0.15s;
}
.top-nav__tab:hover { color: #1a1a18; }
.top-nav__tab--active {
  color: #1a1a18;
  font-weight: 600;
}

/* ====== Sub Nav ====== */
.sub-nav {
  display: flex; align-items: center; justify-content: center; gap: 0.25rem;
  padding: 0.375rem 0 0.5rem;
  border-bottom: 0.5px solid rgba(0,0,0,0.04);
}

.sub-nav__tab {
  all: unset;
  padding: 0.375rem 1rem;
  font-size: 0.8125rem; font-weight: 500;
  color: rgba(26,26,24,0.4);
  cursor: pointer;
  border-radius: 0.25rem;
  transition: color 0.15s;
}
.sub-nav__tab:hover { color: #1a1a18; }
.sub-nav__tab--active {
  color: #1a1a18;
  font-weight: 600;
}

/* ====== Hub Layout ====== */
.hub-layout {
  display: grid;
  grid-template-columns: 16.5rem 1fr;
  height: calc(100vh - 6rem);
  overflow: hidden;
}
.hub-human {
  border-right: 0.5px solid rgba(255,255,255,0.08);
  background: #0a0a0a;
  padding: var(--space-4);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.hub-main { min-width: 0; overflow-y: auto; background: var(--dark-bg); }

.page-content { padding-top: 0; }

/* ====== Page Transition ====== */
.page-enter-active { transition: opacity 0.2s ease-out, transform 0.25s cubic-bezier(0,0,0.2,1); }
.page-leave-active { transition: opacity 0.15s ease-in; }
.page-enter-from { opacity: 0; transform: translateY(0.5rem); }
.page-leave-to { opacity: 0; }

@media (max-width: 860px) {
  .hub-layout { grid-template-columns: 1fr; }
  .hub-human { display: none; }
  .top-nav__inner { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: none; }
}
</style>
