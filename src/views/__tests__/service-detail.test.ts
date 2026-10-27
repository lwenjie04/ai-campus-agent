import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ServiceDetailView from '@/views/ServiceDetailView.vue'

const stubRoute = { template: '<div />' }

const setup = async (serviceId: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stubRoute },
      { path: '/services', name: 'services', component: stubRoute },
      { path: '/services/:serviceId', name: 'service-detail', component: stubRoute },
    ],
  })
  await router.push(`/services/${serviceId}`)
  await router.isReady()
  const wrapper = mount(ServiceDetailView, {
    props: { serviceId },
    global: {
      plugins: [router],
      stubs: { 'el-button': { template: '<button><slot /></button>' } },
    },
  })
  return { router, wrapper }
}

const sectionTitles = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper.findAll('h2').map((title) => title.text())

describe('办事指南详情', () => {
  it('展示事项说明、关键词和带链接的来源参考', async () => {
    const { wrapper } = await setup('teaching-transfer-major')

    expect(wrapper.text()).toContain('转专业申请')
    expect(wrapper.text()).toContain('来源参考')
    expect(wrapper.text()).toContain('关于2025年普通本科生转专业工作的通知')
    expect(
      wrapper
        .find('a[href="https://www.gdei.edu.cn/nw/2025/1215/c2066a103188/page.psp"]')
        .exists(),
    ).toBe(true)
    expect(wrapper.text()).toContain('旧年度通知不作为当前办理依据')
  })

  it('actionUrl 为空时不渲染办理入口，只保留未核实提示', async () => {
    const { wrapper } = await setup('teaching-transfer-major')

    expect(sectionTitles(wrapper)).not.toContain('办理入口')
    expect(wrapper.find('a.detail-entry').exists()).toBe(false)
    expect(wrapper.text()).toContain('当前未核实到可用的线上办理入口')
  })

  it('来源没有链接时显示未提供，不伪造入口', async () => {
    const { wrapper } = await setup('teaching-public-elective')

    expect(wrapper.text()).toContain('通知原文链接未提供')
    expect(wrapper.findAll('a.source-link')).toHaveLength(0)
    expect(wrapper.find('a.detail-entry').exists()).toBe(false)
  })

  it('无效事项显示无效状态与返回办事指南入口', async () => {
    const { wrapper } = await setup('not-a-service')

    expect(wrapper.find('[data-testid="service-invalid"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('无效事项')
    expect(wrapper.text()).toContain('返回办事指南')
  })
})
