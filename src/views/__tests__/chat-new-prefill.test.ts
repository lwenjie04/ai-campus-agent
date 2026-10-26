import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AgentChat from '@/views/AgentChat.vue'
import { prefillChatQuestion } from '@/services/chat-draft'
import { useAgentStore } from '@/store/agent'

vi.mock('@/api/llm', () => ({
  streamChat: vi.fn(),
}))

const stubRoute = { template: '<div />' }

let focusCalls = 0

// 输入框只暴露 modelValue 与 focus，便于断言“预填但未发送”。
const InputBoxStub = {
  name: 'InputBox',
  props: {
    modelValue: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
  emits: ['send', 'update:modelValue'],
  methods: {
    focus() {
      focusCalls += 1
    },
  },
  template: '<div data-testid="chat-input">{{ modelValue }}</div>',
}

const createTestRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stubRoute },
      { path: '/chat/new', name: 'chat-new', component: stubRoute },
      { path: '/chat/:conversationId', name: 'chat-detail', component: stubRoute },
    ],
  })
  await router.push('/chat/new')
  await router.isReady()
  return router
}

const mountAgentChat = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAgentStore()
  const sendSpy = vi.spyOn(store, 'sendMessage')
  const router = await createTestRouter()
  const wrapper = mount(AgentChat, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ChatWindow: true,
        DigitalHumanPlayer: true,
        HistoryDrawer: true,
        SourceCard: true,
        InputBox: InputBoxStub,
        'el-dialog': true,
        'el-select': true,
        'el-option': true,
        'el-input': true,
        'el-button': true,
      },
    },
  })
  await flushPromises()
  return { wrapper, sendSpy, store }
}

beforeEach(() => {
  focusCalls = 0
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('新对话预填问题', () => {
  it('转问后只预填问题并聚焦，不自动发送也不请求模型', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    prefillChatQuestion('帮我查一下「材料」相关的办事事项和学校最新通知。')

    const { wrapper, sendSpy } = await mountAgentChat()

    expect(wrapper.get('[data-testid="chat-input"]').text()).toContain('材料')
    expect(sendSpy).not.toHaveBeenCalled()
    expect(fetchStub).not.toHaveBeenCalled()
    expect(focusCalls).toBeGreaterThan(0)
  })

  it('刷新页面后只恢复草稿，不重复发送', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    prefillChatQuestion('帮我查一下「报修」相关的办事事项和学校最新通知。')

    const first = await mountAgentChat()
    expect(first.wrapper.get('[data-testid="chat-input"]').text()).toContain('报修')

    // 模拟刷新：卸载后重新挂载同一 localStorage 的草稿。
    first.wrapper.unmount()
    const second = await mountAgentChat()

    expect(second.wrapper.get('[data-testid="chat-input"]').text()).toContain('报修')
    expect(second.sendSpy).not.toHaveBeenCalled()
    expect(first.sendSpy).not.toHaveBeenCalled()
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
