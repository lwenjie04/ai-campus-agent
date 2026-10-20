import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { installAuthGuard, routes } from '@/router'
import { useAuthStore } from '@/store/auth'

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

  it('游客访问社区被带回首页并保留登录意图', async () => {
    const { router } = await setup()

    await router.push('/community')

    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.login).toBe('1')
    expect(router.currentRoute.value.query.redirect).toBe('/community')
  })

  it('游客直接访问后台同样被拦截', async () => {
    const { router } = await setup()

    await router.push('/admin/review')

    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.login).toBe('1')
  })

  it('普通用户可进社区但不能进后台', async () => {
    const { router, auth } = await setup()
    auth.loggedIn = true
    auth.role = 'user'

    await router.push('/community')
    expect(router.currentRoute.value.path).toBe('/community')

    await router.push('/admin/review')
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.login).toBeUndefined()
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

  it('未知路径进入 404', async () => {
    const { router } = await setup()

    await router.push('/not-a-real-page')

    expect(router.currentRoute.value.name).toBe('not-found')
  })
})
