export const SOURCE_TYPES = {
  official_site: 'official_site',
  academic_system: 'academic_system',
  academic_notice: 'academic_notice',
  student_affairs: 'student_affairs',
  logistics_service: 'logistics_service',
  library_service: 'library_service',
  rule_match: 'rule_match',
}

// 通用官网来源。
// 当真实 RAG 没有命中时，至少返回一个“建议优先核实官网”的基础来源。
const COMMON_OFFICIAL_SOURCE = (providerMode) => ({
  type: SOURCE_TYPES.official_site,
  confidence: providerMode === 'mock' ? 0.6 : 0.7,
  title: '广东第二师范学院官网（建议优先核实）',
  url: 'https://www.gdei.edu.cn',
  snippet:
    providerMode === 'mock'
      ? '示例来源：后续接入 RAG 后将替换为真实检索结果与具体通知链接。'
      : '当前为规则匹配来源（非 RAG 检索），请以后续接入的知识库检索结果为准。',
})

// 规则型来源兜底。
// 这不是严格检索结果，而是根据问题意图给前端一个“建议查看的来源方向”。
export const buildRuleBasedSources = (userText, intent, providerMode = 'mock') => {
  const common = [COMMON_OFFICIAL_SOURCE(providerMode)]

  if (/奖学金|资助|助学金/.test(userText) || intent === 'scholarship') {
    return [
      {
        type: SOURCE_TYPES.student_affairs,
        confidence: 0.78,
        title: '学生工作/资助相关通知（规则匹配）',
        snippet: '奖学金、助学金、评定细则等信息通常由学生工作或资助相关栏目发布。',
      },
      ...common,
    ]
  }

  if (intent === 'teaching' || /课程|课表|选课|教务|转专业|补退选/.test(userText)) {
    return [
      {
        type: SOURCE_TYPES.academic_system,
        confidence: 0.8,
        title: '教务系统 / 教务通知（规则匹配）',
        snippet: '课表、选课、教学安排等问题通常以教务系统与教务通知为准。',
      },
      ...common,
    ]
  }

  if (intent === 'exam' || /考试|补考|重修/.test(userText)) {
    return [
      {
        type: SOURCE_TYPES.academic_notice,
        confidence: 0.82,
        title: '教务考试安排通知（规则匹配）',
        snippet: '考试、补考、重修报名安排以学期教务通知为准。',
      },
      ...common,
    ]
  }

  if (intent === 'life' || /宿舍|食堂|图书馆|后勤|报修/.test(userText)) {
    return [
      {
        type: /图书馆/.test(userText) ? SOURCE_TYPES.library_service : SOURCE_TYPES.logistics_service,
        confidence: 0.75,
        title: '后勤/图书馆服务公告（规则匹配）',
        snippet: '宿舍报修、食堂营业时间、图书馆借阅规则等以对应部门公告为准。',
      },
      ...common,
    ]
  }

  if (intent === 'greeting') return []

  return [
    {
      type: SOURCE_TYPES.rule_match,
      confidence: 0.5,
      title: '通用规则匹配来源',
      snippet: '未命中具体业务分类，建议优先通过学校官网或相关部门通知进一步核实。',
    },
    ...common,
  ]
}
