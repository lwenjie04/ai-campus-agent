export type ServiceCategoryId = 'teaching' | 'scholarship' | 'exam' | 'life'

export type ServiceCategory = {
  id: ServiceCategoryId
  label: string
  title: string
  description: string
}

// 首页常办事项与办事指南共用；2.2 只落地分类，具体事项数据在 5.1 补。
const teaching: ServiceCategory = {
  id: 'teaching',
  label: '教务办理',
  title: '转专业与选课',
  description: '资格、材料、办理入口。',
}

export const DEFAULT_SERVICE_CATEGORY = teaching

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  teaching,
  { id: 'scholarship', label: '奖助学金', title: '奖助学金申请', description: '条件、证明、提交方式。' },
  { id: 'exam', label: '考试安排', title: '补考与考试安排', description: '报名、时间、成绩查询。' },
  { id: 'life', label: '生活服务', title: '宿舍与生活服务', description: '宿舍、报修、校车服务。' },
]

export const isServiceCategoryId = (value: unknown): value is ServiceCategoryId =>
  SERVICE_CATEGORIES.some((category) => category.id === value)
