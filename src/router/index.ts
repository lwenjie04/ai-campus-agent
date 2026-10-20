import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/store/auth'

// 页面路由与接口命名空间分开：接口统一走 /api，以下路径只负责页面。
// 会话详情（/chat/:conversationId）要等多会话模型落地后再接入，避免把静态
// /chat/new 误当成已存在的会话 ID。
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/AgentChat.vue'),
    meta: { layout: 'agent' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/AgentChat.vue'),
    meta: { layout: 'agent' },
  },
  {
    path: '/chat/new',
    name: 'chat-new',
    component: () => import('@/views/AgentChat.vue'),
    meta: { layout: 'agent' },
  },
  {
    path: '/community',
    name: 'community',
    component: () => import('@/views/CommunityView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/community/posts/:postId',
    name: 'community-post',
    component: () => import('@/views/PostDetailView.vue'),
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    redirect: '/admin/review',
  },
  {
    path: '/admin/review',
    name: 'admin-review',
    component: () => import('@/views/AdminReviewView.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/admin/retrieval',
    name: 'admin-retrieval',
    component: () => import('@/views/AdminReviewView.vue'),
    props: { initialTab: 'lightrag' },
    meta: { requiresAdmin: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

// 受限页面统一回首页并带上登录意图，登录成功后由 App.vue 按 redirect 回跳。
const loginRedirect = (to: RouteLocationNormalized) => ({
  path: '/',
  query: { login: '1', redirect: to.fullPath },
})

// 守卫单独导出：测试可以复用生产路由的 meta，不挂载真实页面组件。
export const installAuthGuard = (router: Router) => {
  let authHydrated = false

  router.beforeEach((to) => {
    const authStore = useAuthStore()

    // 首次导航前恢复登录态，避免刷新受限页面时被误判为游客。
    if (!authHydrated) {
      authStore.hydrate()
      authHydrated = true
    }

    if (to.meta.requiresAdmin) {
      if (!authStore.loggedIn) return loginRedirect(to)
      if (!authStore.isAdmin) return { path: '/' }
      return true
    }

    if (to.meta.requiresAuth && !authStore.loggedIn) return loginRedirect(to)

    return true
  })

  return router
}

// 工厂形式便于测试用内存 history 断言守卫，生产入口使用浏览器 history。
export const createAppRouter = (history: RouterHistory) => {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, _from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash, behavior: 'smooth' }
      return { top: 0 }
    },
  })

  return installAuthGuard(router)
}

const router = createAppRouter(createWebHistory(import.meta.env.BASE_URL))

export default router
