import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { installAuthGuard, routes } from '@/router'
import { useAuthStore } from '@/store/auth'
import { useAuthIntentStore } from '@/store/auth-intent'

const stub = { template: '<div />' }

// 复用生产路由的 path/meta，但把页面组件换成空壳，守卫测试不依赖真实页面与网络。
const createTestRouter = () => {
  const testRoutes = routes.map((route) => ({ ...route, component: stub }) as RouteRecordRaw)
  const router = createRouter({ history: createMemoryHistory(), routes: testRoutes })
  return installAuthGuard(router)
}

const setup = async () => {
  setActivePinia(createPinia())
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  return { router, auth: useAuthStore() }
}

describe('路由守卫', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('游客可直接访问问答路由', async () => {
    const { router } = await setup()

    await router.push('/chat')
    expect(router.currentRoute.value.name).toBe('chat')

    await router.push('/chat/new')
    expect(router.currentRoute.value.name).toBe('chat-new')
  })

  it('游客访问社区或后台时带回首页并保留 returnTo', async () => {
    const targets = ['/community', '/community/posts/p1', '/admin/review', '/admin/retrieval']

    for (const target of targets) {
      const { router } = await setup()
      await router.push(target)

      expect(router.currentRoute.value.path).toBe('/')
      expect(router.currentRoute.value.query.login).toBe('1')
      expect(router.currentRoute.value.query.redirect).toBe(target)
    }
  })

  it('游客访问帖子或后台时登记可恢复的登录意图', async () => {
    const { router } = await setup()

    await router.push('/community/posts/p1')
    const postIntent = useAuthIntentStore().peek()
    expect(postIntent?.type).toBe('open-post')
    expect(postIntent?.target).toBe('p1')

    await router.push('/admin/review')
    const adminIntent = useAuthIntentStore().peek()
    expect(adminIntent?.type).toBe('enter-admin')
    expect(adminIntent?.target).toBe('/admin/review')
  })

  it('登录意图页本身不再触发跳转，取消登录不会形成循环', async () => {
    const { router } = await setup()

    await router.push('/?login=1&redirect=/community')
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.redirect).toBe('/community')

    // 用户取消登录：App 清除一次性参数，仍停留在首页。
    await router.replace({ path: '/', query: {} })
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.login).toBeUndefined()
  })

  it('普通用户可进社区，但后台返回 403 并带 from', async () => {
    const { router, auth } = await setup()
    auth.loggedIn = true
    auth.role = 'user'

    await router.push('/community')
    expect(router.currentRoute.value.name).toBe('community')

    await router.push('/community/posts/p1')
    expect(router.currentRoute.value.name).toBe('community-post')

    await router.push('/admin/review')
    expect(router.currentRoute.value.name).toBe('forbidden')
    expect(router.currentRoute.value.query.from).toBe('/admin/review')

    await router.push('/admin/retrieval')
    expect(router.currentRoute.value.name).toBe('forbidden')
    expect(router.currentRoute.value.query.from).toBe('/admin/retrieval')
  })

  it('管理员可进审核与检索运行两个路由', async () => {
    const { router, auth } = await setup()
    auth.loggedIn = true
    auth.role = 'admin'

    await router.push('/admin/review')
    expect(router.currentRoute.value.name).toBe('admin-review')

    await router.push('/admin/retrieval')
    expect(router.currentRoute.value.name).toBe('admin-retrieval')
  })

  it('403 页面本身可被未登录用户直接打开，不弹登录', async () => {
    const { router } = await setup()

    await router.push('/403')

    expect(router.currentRoute.value.name).toBe('forbidden')
    expect(router.currentRoute.value.query.login).toBeUndefined()
  })

  it('未知路径进入 404', async () => {
    const { router } = await setup()

    await router.push('/not-a-real-page')

    expect(router.currentRoute.value.name).toBe('not-found')
  })
})
