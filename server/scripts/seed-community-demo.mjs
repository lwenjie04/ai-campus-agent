import { isMySqlConfigured, query } from '../mysql.mjs'

const postIds = [
  'post_demo_teaching_01',
  'post_demo_scholarship_01',
  'post_demo_life_01',
  'post_demo_pending_01',
]

const replyIds = [
  'reply_demo_teaching_01',
  'reply_demo_teaching_02',
  'reply_demo_scholarship_01',
  'reply_demo_pending_01',
]

const knowledgeIds = ['ck_demo_pending_01', 'ck_demo_approved_01']
const reviewTargetIds = [...postIds, ...replyIds, ...knowledgeIds]

if (!isMySqlConfigured()) {
  console.error('MySQL 未配置，无法写入演示数据。')
  process.exit(1)
}

const deleteByIds = async (table, column, ids) => {
  if (!ids.length) return
  await query(`DELETE FROM ${table} WHERE ${column} IN (${ids.map(() => '?').join(',')})`, ids)
}

await deleteByIds('community_review_logs', 'target_id', reviewTargetIds)
await deleteByIds('community_knowledge', 'id', knowledgeIds)
await deleteByIds('community_replies', 'id', replyIds)
await deleteByIds('community_posts', 'id', postIds)

const postSql = `
  INSERT INTO community_posts (
    id,
    author_name,
    author_role,
    title,
    content,
    category,
    tags,
    status,
    knowledge_status,
    quality_score,
    reply_count,
    like_count,
    view_count,
    last_replied_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

await query(postSql, [
  'post_demo_teaching_01',
  '林同学',
  'student',
  '转专业后课程补退选和成绩认定怎么操作？',
  '我已经转到软件工程专业，想确认这学期课程补退选、成绩认定和学分转换应该先做哪一步，怕错过时间节点。',
  'teaching',
  JSON.stringify(['转专业', '补退选', '成绩认定']),
  'approved',
  'approved',
  8.6,
  2,
  6,
  48,
  '2026-03-27 10:20:00',
  '2026-03-26 09:10:00',
  '2026-03-27 10:20:00',
])

await query(postSql, [
  'post_demo_scholarship_01',
  '陈同学',
  'student',
  '竞赛奖学金材料一般要提前准备哪些？',
  '我准备申报竞赛奖学金，想先确认材料清单、学院提交流程和常见遗漏项，有没有同学办过可以分享经验。',
  'scholarship',
  JSON.stringify(['竞赛奖学金', '材料准备', '学院提交']),
  'approved',
  'pending',
  8.2,
  1,
  5,
  35,
  '2026-03-27 09:30:00',
  '2026-03-26 14:00:00',
  '2026-03-27 09:30:00',
])

await query(postSql, [
  'post_demo_life_01',
  '黄同学',
  'student',
  '海珠校区宿舍报修一般多久会处理？',
  '想了解一下宿舍空调和热水器报修流程，如果线上报修后迟迟没人联系，一般要找谁跟进。',
  'life',
  JSON.stringify(['宿舍', '报修', '后勤']),
  'approved',
  'none',
  7.1,
  0,
  2,
  18,
  null,
  '2026-03-26 18:40:00',
  '2026-03-26 18:40:00',
])

await query(postSql, [
  'post_demo_pending_01',
  '周同学',
  'student',
  '下学期选修课什么时候开放？',
  '想提前了解一下下学期公共选修课的开放时间和选课入口，方便安排自己的学习计划。',
  'teaching',
  JSON.stringify(['选修课', '选课', '教务']),
  'pending',
  'none',
  6.3,
  0,
  0,
  4,
  null,
  '2026-03-27 11:00:00',
  '2026-03-27 11:00:00',
])

const replySql = `
  INSERT INTO community_replies (
    id,
    post_id,
    author_name,
    author_role,
    content,
    status,
    quality_score,
    like_count,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

await query(replySql, [
  'reply_demo_teaching_01',
  'post_demo_teaching_01',
  '李同学',
  'student',
  '我去年是先看教务处通知确认补退选时间，再联系学院教务员核对需要保留和补选的课程，最后再处理成绩认定表。',
  'approved',
  8.4,
  4,
  '2026-03-27 09:50:00',
  '2026-03-27 09:50:00',
])

await query(replySql, [
  'reply_demo_teaching_02',
  'post_demo_teaching_01',
  '王同学',
  'student',
  '如果公共任选课也要认定，建议一起把原专业成绩单和课程对应说明准备好，不然学院会让你补材料。',
  'approved',
  8.1,
  2,
  '2026-03-27 10:20:00',
  '2026-03-27 10:20:00',
])

await query(replySql, [
  'reply_demo_scholarship_01',
  'post_demo_scholarship_01',
  '许同学',
  'student',
  '我们学院去年要求先交竞赛获奖证明、申报表和汇总表，最好提前找辅导员确认附件模板是不是最新版本。',
  'approved',
  7.8,
  3,
  '2026-03-27 09:30:00',
  '2026-03-27 09:30:00',
])

await query(replySql, [
  'reply_demo_pending_01',
  'post_demo_life_01',
  '赵同学',
  'student',
  '我之前是先在线报修，过两天没反馈就给宿管阿姨登记，再联系后勤老师跟进。',
  'pending',
  6.2,
  0,
  '2026-03-27 11:10:00',
  '2026-03-27 11:10:00',
])

const knowledgeSql = `
  INSERT INTO community_knowledge (
    id,
    post_id,
    title,
    summary,
    content,
    category,
    keywords,
    confidence,
    status,
    source_type,
    review_note,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

await query(knowledgeSql, [
  'ck_demo_pending_01',
  'post_demo_scholarship_01',
  '学生社区经验总结：竞赛奖学金材料准备',
  '根据学生社区讨论，竞赛奖学金通常需要提前准备获奖证明、申报表和学院汇总材料，正式模板和提交节点仍应以学院或学校最新通知为准。',
  '主题：竞赛奖学金材料准备\n\n主帖内容：我准备申报竞赛奖学金，想先确认材料清单、学院提交流程和常见遗漏项。\n\n已审核回复整理：学院去年要求先交竞赛获奖证明、申报表和汇总表，建议提前找辅导员确认模板是否为最新版本。\n\n提示：以上内容来自学生社区经验整理，仅供参考，请以学校官方通知为准。',
  'scholarship',
  JSON.stringify(['竞赛奖学金', '材料准备', '获奖证明', '申报表']),
  0.45,
  'pending',
  'community_summary',
  '等待管理员确认后再进入 RAG',
  '2026-03-27 11:20:00',
  '2026-03-27 11:20:00',
])

await query(knowledgeSql, [
  'ck_demo_approved_01',
  'post_demo_teaching_01',
  '学生社区经验总结：转专业后课程补退选与成绩认定',
  '根据学生社区讨论，转专业后的补退选通常需要先查看教务处通知，再联系学院确认课程安排，同时尽早准备成绩认定和课程对应材料。',
  '主题：转专业后课程补退选和成绩认定\n\n主帖内容：我已经转到软件工程专业，想确认这学期课程补退选、成绩认定和学分转换应该先做哪一步。\n\n已审核回复整理：1. 先看教务通知确认补退选时间；2. 联系学院教务员核对课程；3. 一起准备成绩认定表和原专业成绩单。\n\n提示：以上内容来自学生社区经验整理，仅供参考，请以学校官方通知为准。',
  'teaching',
  JSON.stringify(['转专业', '补退选', '成绩认定', '课程认定']),
  0.45,
  'approved',
  'community_summary',
  '已确认可作为辅助知识来源',
  '2026-03-27 11:25:00',
  '2026-03-27 11:25:00',
])

const reviewSql = `
  INSERT INTO community_review_logs (
    target_type,
    target_id,
    action,
    reviewer,
    note,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`

await query(reviewSql, ['post', 'post_demo_teaching_01', 'approve', 'admin', '演示数据：帖子审核通过', '2026-03-27 09:20:00'])
await query(reviewSql, ['reply', 'reply_demo_teaching_01', 'approve', 'admin', '演示数据：回复审核通过', '2026-03-27 09:55:00'])
await query(reviewSql, ['reply', 'reply_demo_teaching_02', 'approve', 'admin', '演示数据：回复审核通过', '2026-03-27 10:25:00'])
await query(reviewSql, ['knowledge', 'ck_demo_approved_01', 'approve', 'admin', '演示数据：社区知识审核通过', '2026-03-27 11:26:00'])
await query(reviewSql, ['knowledge', 'ck_demo_pending_01', 'generate_knowledge', 'admin', '演示数据：已生成待审核社区知识', '2026-03-27 11:21:00'])

const [postCount] = await query('SELECT COUNT(*) AS count FROM community_posts')
const [replyCount] = await query('SELECT COUNT(*) AS count FROM community_replies')
const [knowledgeCount] = await query('SELECT COUNT(*) AS count FROM community_knowledge')

console.log(
  JSON.stringify(
    {
      seeded: true,
      posts: postCount.count,
      replies: replyCount.count,
      knowledge: knowledgeCount.count,
    },
    null,
    2,
  ),
)

process.exit(0)
