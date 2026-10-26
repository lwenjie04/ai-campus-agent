// 5.2：办事指南的领域类型。事项数据源为 docs/service-catalog-v2.json（5.1 人工确认）。
// 分类固定为教学、考试、奖助、生活四类，新增分类需要同步事项清单与首页入口。
export type ServiceCategoryId = 'teaching' | 'exam' | 'scholarship' | 'life'

export type ServiceCategory = {
  id: ServiceCategoryId
  label: string
  title: string
  description: string
}

// 来源只用于溯源：旧年度通知和学校制度文本不代表当前办理条件与时间。
export type ServiceSource = {
  title: string
  sourceDate: string | null
  sourceLocator: string | null
  referenceUrl: string | null
  freshness: string | null
  checkedAt: string | null
}

export type ServiceItem = {
  id: string
  category: ServiceCategoryId
  title: string
  keywords: string[]
  purpose: string
  questionTemplate: string
  source: ServiceSource
  // 未核实到当前官方入口时保持 null，页面不渲染任何办理按钮。
  actionUrl: string | null
}
