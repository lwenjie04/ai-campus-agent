import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackError } from '@/api/feedback'
import MessageActions from '../MessageActions.vue'

const submitAnswerFeedback = vi.fn()

vi.mock('@/api/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/feedback')>()
  return {
    ...actual,
    submitAnswerFeedback: (...args: unknown[]) => submitAnswerFeedback(...args),
  }
})

afterEach(() => {
  submitAnswerFeedback.mockReset()
})

describe('MessageActions', () => {
  it('提交成功后显示已记录并通知父组件', async () => {
    submitAnswerFeedback.mockResolvedValue({ requestId: 'req-1', value: 'helpful', updatedAt: '' })
    const wrapper = mount(MessageActions, { props: { requestId: 'req-1' } })

    await wrapper.get('[aria-label="有帮助"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('已记录'))
    expect(wrapper.emitted('submitted')?.[0]).toEqual(['helpful'])
  })

  it('已记录时不再显示反馈按钮', () => {
    const wrapper = mount(MessageActions, { props: { requestId: 'req-1', initialValue: 'none' } })
    expect(wrapper.text()).toContain('已记录')
    expect(wrapper.find('[aria-label="有帮助"]').exists()).toBe(false)
  })

  it('409 不可反馈时提示且不提供重试', async () => {
    submitAnswerFeedback.mockRejectedValue(
      new FeedbackError('该回答没有可用反馈凭据', 'FEEDBACK_NOT_ELIGIBLE', 409),
    )
    const wrapper = mount(MessageActions, { props: { requestId: 'req-2' } })

    await wrapper.get('[aria-label="有帮助"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('暂不支持反馈'))
    expect(wrapper.text()).not.toContain('重试')
  })

  it('429 限频时给出秒数并允许重试', async () => {
    submitAnswerFeedback.mockRejectedValue(
      new FeedbackError('反馈操作过于频繁', 'RATE_LIMITED', 429, 12),
    )
    const wrapper = mount(MessageActions, { props: { requestId: 'req-3' } })

    await wrapper.get('[aria-label="没帮助"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('12 秒后再试'))
    expect(wrapper.text()).toContain('重试')
  })
})
