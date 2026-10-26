import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { routes } from '@/router'

const stub = { template: '<div />' }

// 路由表复用生产定义，页面组件换成空壳；断言办事指南列表/详情的 URL 解析。
const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: routes.map((route) => ({ ...route, component: stub }) as RouteRecordRaw),
  })

describe('办事指南路由', () => {
  it('列表路由保留分类查询参数', async () => {
    const router = createTestRouter()
    await router.push('/services?category=exam')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('services')
    expect(router.currentRoute.value.query.category).toBe('exam')
  })

  it('详情路由把 serviceId 传给页面 props', async () => {
    const router = createTestRouter()
    await router.push('/services/life-facility-repair')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('service-detail')
    expect(router.currentRoute.value.params.serviceId).toBe('life-facility-repair')
  })
})
