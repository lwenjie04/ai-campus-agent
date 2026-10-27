import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ServiceDirectoryView from '@/views/ServiceDirectoryView.vue'

const stubRoute = { template: '<div />' }

const createTestRouter = async (fullPath: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stubRoute },
      { path: '/services', name: 'services', component: stubRoute },
      { path: '/services/:serviceId', name: 'service-detail', component: stubRoute },
    ],
  })
  await router.push(fullPath)
  await router.isReady()
  return router
}

const setup = async (fullPath: string) => {
  const router = await createTestRouter(fullPath)
  const wrapper = mount(ServiceDirectoryView, {
    global: {
      plugins: [router],
      stubs: {
        'el-empty': { template: '<div class="el-empty"><slot /></div>' },
        'el-button': { template: '<button><slot /></button>' },
      },
    },
  })
  return { router, wrapper }
}

describe('办事指南列表', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('按 URL 分类展示对应事项，并渲染详情链接', async () => {
    const { wrapper } = await setup('/services?category=exam')
    const items = wrapper.findAll('[data-testid="service-item"]')

    expect(items).toHaveLength(3)
    expect(wrapper.text()).toContain('补考与成绩录入')
    expect(wrapper.text()).not.toContain('转专业申请')
    expect(items[0]!.attributes('href')).toBe('/services/exam-retake')
  })

  it('切换分类后 URL 与列表同步更新', async () => {
    const { router, wrapper } = await setup('/services?category=exam')

    await wrapper.findAll('.category-tab')[3]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.category).toBe('life')
    expect(wrapper.text()).toContain('校园设施报修')
    expect(wrapper.text()).not.toContain('补考与成绩录入')
  })

  it('非法分类回落到默认分类并规范化 URL', async () => {
    const { router, wrapper } = await setup('/services?category=unknown')
    await flushPromises()

    expect(router.currentRoute.value.query.category).toBe('teaching')
    expect(wrapper.text()).toContain('转专业申请')
  })
})
