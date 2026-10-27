import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { SERVICE_CATEGORIES } from '@/data/services'

const stubRoute = { template: '<div />' }

const createTestRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stubRoute },
      { path: '/services', component: stubRoute },
      { path: '/chat/new', component: stubRoute },
    ],
  })
  await router.push('/')
  await router.isReady()
  return router
}

const mountHome = (router: Awaited<ReturnType<typeof createTestRouter>>) =>
  mount(HomeView, {
    global: {
      plugins: [router],
      stubs: {
        'el-button': { template: '<button><slot /></button>' },
      },
    },
  })

describe('首页常办事项入口', () => {
  it('四张卡片分别跳到对应分类的办事指南 URL', async () => {
    const router = await createTestRouter()
    const wrapper = mountHome(router)
    const cards = wrapper.findAll('.service-card')

    expect(cards).toHaveLength(SERVICE_CATEGORIES.length)

    for (const [index, category] of SERVICE_CATEGORIES.entries()) {
      await cards[index]!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/services')
      expect(router.currentRoute.value.query.category).toBe(category.id)
    }
  })

  it('卡片右下角加号与卡片本身进入同一分类', async () => {
    const router = await createTestRouter()
    const wrapper = mountHome(router)
    const plusIcons = wrapper.findAll('.service-card__plus')

    expect(plusIcons).toHaveLength(SERVICE_CATEGORIES.length)

    await plusIcons[3]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/services')
    expect(router.currentRoute.value.query.category).toBe(SERVICE_CATEGORIES[3]!.id)
  })
})
