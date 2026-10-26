import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ServiceDirectoryView from '@/views/ServiceDirectoryView.vue'
import { readNewChatDraft } from '@/services/chat-draft'
import { readPendingQuestion } from '@/services/pending-question'

const stubRoute = { template: '<div />' }

// 用原生 input 模拟 ElInput 的 v-model，测试不依赖完整 Element Plus 渲染。
const ElInputStub = {
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue', 'clear'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const createTestRouter = async (fullPath: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stubRoute },
      { path: '/services', name: 'services', component: stubRoute },
      { path: '/services/:serviceId', name: 'service-detail', component: stubRoute },
      { path: '/chat/new', name: 'chat-new', component: stubRoute },
    ],
  })
  await router.push(fullPath)
  await router.isReady()
  return router
}

const setup = async (fullPath = '/services?category=teaching') => {
  const router = await createTestRouter(fullPath)
  const wrapper = mount(ServiceDirectoryView, {
    global: {
      plugins: [router],
      stubs: {
        'el-input': ElInputStub,
        'el-empty': { template: '<div class="el-empty"><slot /></div>' },
        'el-button': { template: '<button><slot /></button>' },
      },
    },
  })
  return { router, wrapper }
}

const typeSearch = async (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], term: string) => {
  await wrapper.get('[data-testid="service-search-input"]').setValue(term)
  await flushPromises()
}

describe('办事指南搜索与无结果转问', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('按标题和关键词过滤，并把搜索词保留在 URL', async () => {
    const { router, wrapper } = await setup()

    await typeSearch(wrapper, 'CET')

    expect(router.currentRoute.value.query.q).toBe('CET')
    expect(wrapper.findAll('[data-testid="service-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('大学英语四、六级报名')
    expect(wrapper.text()).not.toContain('转专业申请')
    expect(wrapper.get('[data-testid="service-search-count"]').text()).toBe('找到 1 项')

    // 关键词搜索跨分类生效：当前在教务办理分类，仍能找到生活服务事项。
    await typeSearch(wrapper, '报修')
    expect(router.currentRoute.value.query.q).toBe('报修')
    expect(wrapper.findAll('[data-testid="service-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('校园设施报修')
  })

  it('只匹配标题与关键词，不匹配用途中的词', async () => {
    const { wrapper } = await setup()

    await typeSearch(wrapper, '材料')

    expect(wrapper.findAll('[data-testid="service-item"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="service-search-empty"]').text()).toContain(
      '没有找到与「材料」匹配的事项',
    )
  })

  it('无结果时保留搜索词，并提供带着该词转问的入口', async () => {
    const { router, wrapper } = await setup()

    await typeSearch(wrapper, '材料')

    expect(router.currentRoute.value.query.q).toBe('材料')
    expect(wrapper.get('[data-testid="service-search-empty"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="service-ask-bridge"]').text()).toContain('向校答提问')

    await wrapper.get('[data-testid="service-ask-bridge"]').trigger('click')
    await flushPromises()

    expect(readNewChatDraft()).toContain('材料')
    expect(readNewChatDraft()).toContain('帮我查一下')
    expect(router.currentRoute.value.name).toBe('chat-new')
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('转问只预填草稿，不请求模型也不进入待发队列', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    const { wrapper } = await setup()

    await typeSearch(wrapper, '材料')
    await wrapper.get('[data-testid="service-ask-bridge"]').trigger('click')
    await flushPromises()

    expect(fetchStub).not.toHaveBeenCalled()
    expect(readPendingQuestion()).toBeNull()
  })

  it('刷新时重复读取草稿不会重复发送', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    const { router, wrapper } = await setup()

    await typeSearch(wrapper, '材料')
    await wrapper.get('[data-testid="service-ask-bridge"]').trigger('click')
    await flushPromises()

    const staged = readNewChatDraft()
    expect(router.currentRoute.value.fullPath).toBe('/chat/new')
    // 模拟刷新：草稿仍在，重新读取不消费、不排队、不发请求。
    expect(readNewChatDraft()).toBe(staged)
    wrapper.unmount()
    expect(readNewChatDraft()).toBe(staged)
    expect(fetchStub).not.toHaveBeenCalled()
    expect(readPendingQuestion()).toBeNull()
  })

  it('清除搜索后恢复分类列表，并从 URL 移除搜索词', async () => {
    const { router, wrapper } = await setup('/services?category=exam')

    await typeSearch(wrapper, 'CET')
    await wrapper.get('[data-testid="service-search-input"]').setValue('')
    await flushPromises()

    expect(router.currentRoute.value.query.q).toBeUndefined()
    expect(router.currentRoute.value.query.category).toBe('exam')
    expect(wrapper.findAll('[data-testid="service-item"]')).toHaveLength(3)
  })
})
