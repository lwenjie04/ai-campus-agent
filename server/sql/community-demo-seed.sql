USE `ai_campus_agent`;

-- 这份数据用于本地演示学生社区完整链路：
-- 1. 社区首页能看到已通过帖子
-- 2. 管理员页能看到待审核帖子 / 待审核回复
-- 3. 候选池里能看到高价值帖子
-- 4. 待审核社区知识里能看到待确认条目
-- 5. RAG 可以命中已通过的社区知识

DELETE FROM `community_review_logs`
WHERE `target_id` IN (
  'post_demo_teaching_01',
  'post_demo_scholarship_01',
  'post_demo_life_01',
  'post_demo_pending_01',
  'reply_demo_teaching_01',
  'reply_demo_teaching_02',
  'reply_demo_scholarship_01',
  'reply_demo_pending_01',
  'ck_demo_pending_01',
  'ck_demo_approved_01'
);

DELETE FROM `community_knowledge`
WHERE `id` IN ('ck_demo_pending_01', 'ck_demo_approved_01');

DELETE FROM `community_replies`
WHERE `id` IN (
  'reply_demo_teaching_01',
  'reply_demo_teaching_02',
  'reply_demo_scholarship_01',
  'reply_demo_pending_01'
);

DELETE FROM `community_posts`
WHERE `id` IN (
  'post_demo_teaching_01',
  'post_demo_scholarship_01',
  'post_demo_life_01',
  'post_demo_pending_01'
);

INSERT INTO `community_posts` (
  `id`,
  `author_name`,
  `author_role`,
  `title`,
  `content`,
  `category`,
  `tags`,
  `status`,
  `knowledge_status`,
  `quality_score`,
  `reply_count`,
  `like_count`,
  `view_count`,
  `last_replied_at`,
  `created_at`,
  `updated_at`
) VALUES
(
  'post_demo_teaching_01',
  '林同学',
  'student',
  '转专业后课程补退选和成绩认定怎么操作？',
  '我已经转到软件工程专业，想确认这学期课程补退选、成绩认定和学分转换应该先做哪一步，怕错过时间节点。',
  'teaching',
  JSON_ARRAY('转专业', '补退选', '成绩认定'),
  'approved',
  'approved',
  8.60,
  2,
  6,
  48,
  '2026-03-27 10:20:00',
  '2026-03-26 09:10:00',
  '2026-03-27 10:20:00'
),
(
  'post_demo_scholarship_01',
  '陈同学',
  'student',
  '竞赛奖学金材料一般要提前准备哪些？',
  '我准备申报竞赛奖学金，想先确认材料清单、学院提交流程和常见遗漏项，有没有同学办过可以分享经验。',
  'scholarship',
  JSON_ARRAY('竞赛奖学金', '材料准备', '学院提交'),
  'approved',
  'pending',
  8.20,
  1,
  5,
  35,
  '2026-03-27 09:30:00',
  '2026-03-26 14:00:00',
  '2026-03-27 09:30:00'
),
(
  'post_demo_life_01',
  '黄同学',
  'student',
  '海珠校区宿舍报修一般多久会处理？',
  '想了解一下宿舍空调和热水器报修流程，如果线上报修后迟迟没人联系，一般要找谁跟进。',
  'life',
  JSON_ARRAY('宿舍', '报修', '后勤'),
  'approved',
  'none',
  7.10,
  0,
  2,
  18,
  NULL,
  '2026-03-26 18:40:00',
  '2026-03-26 18:40:00'
),
(
  'post_demo_pending_01',
  '周同学',
  'student',
  '下学期选修课什么时候开放？',
  '想提前了解一下下学期公共选修课的开放时间和选课入口，方便安排自己的学习计划。',
  'teaching',
  JSON_ARRAY('选修课', '选课', '教务'),
  'pending',
  'none',
  6.30,
  0,
  0,
  4,
  NULL,
  '2026-03-27 11:00:00',
  '2026-03-27 11:00:00'
);

INSERT INTO `community_replies` (
  `id`,
  `post_id`,
  `author_name`,
  `author_role`,
  `content`,
  `status`,
  `quality_score`,
  `like_count`,
  `created_at`,
  `updated_at`
) VALUES
(
  'reply_demo_teaching_01',
  'post_demo_teaching_01',
  '李同学',
  'student',
  '我去年是先看教务处通知确认补退选时间，再联系学院教务员核对需要保留和补选的课程，最后再处理成绩认定表。',
  'approved',
  8.40,
  4,
  '2026-03-27 09:50:00',
  '2026-03-27 09:50:00'
),
(
  'reply_demo_teaching_02',
  'post_demo_teaching_01',
  '王同学',
  'student',
  '如果公共任选课也要认定，建议一起把原专业成绩单和课程对应说明准备好，不然学院会让你补材料。',
  'approved',
  8.10,
  2,
  '2026-03-27 10:20:00',
  '2026-03-27 10:20:00'
),
(
  'reply_demo_scholarship_01',
  'post_demo_scholarship_01',
  '许同学',
  'student',
  '我们学院去年要求先交竞赛获奖证明、申报表和汇总表，最好提前找辅导员确认附件模板是不是最新版本。',
  'approved',
  7.80,
  3,
  '2026-03-27 09:30:00',
  '2026-03-27 09:30:00'
),
(
  'reply_demo_pending_01',
  'post_demo_life_01',
  '赵同学',
  'student',
  '我之前是先在线报修，过两天没反馈就给宿管阿姨登记，再联系后勤老师跟进。',
  'pending',
  6.20,
  0,
  '2026-03-27 11:10:00',
  '2026-03-27 11:10:00'
);

INSERT INTO `community_knowledge` (
  `id`,
  `post_id`,
  `title`,
  `summary`,
  `content`,
  `category`,
  `keywords`,
  `confidence`,
  `status`,
  `source_type`,
  `review_note`,
  `created_at`,
  `updated_at`
) VALUES
(
  'ck_demo_pending_01',
  'post_demo_scholarship_01',
  '学生社区经验总结：竞赛奖学金材料准备',
  '根据学生社区讨论，竞赛奖学金通常需要提前准备获奖证明、申报表和学院汇总材料，正式模板和提交节点仍应以学院或学校最新通知为准。',
  '主题：竞赛奖学金材料准备\n\n主帖内容：我准备申报竞赛奖学金，想先确认材料清单、学院提交流程和常见遗漏项。\n\n已审核回复整理：学院去年要求先交竞赛获奖证明、申报表和汇总表，建议提前找辅导员确认模板是否为最新版本。\n\n提示：以上内容来自学生社区经验整理，仅供参考，请以学校官方通知为准。',
  'scholarship',
  JSON_ARRAY('竞赛奖学金', '材料准备', '获奖证明', '申报表'),
  0.45,
  'pending',
  'community_summary',
  '等待管理员确认后再进入 RAG',
  '2026-03-27 11:20:00',
  '2026-03-27 11:20:00'
),
(
  'ck_demo_approved_01',
  'post_demo_teaching_01',
  '学生社区经验总结：转专业后课程补退选与成绩认定',
  '根据学生社区讨论，转专业后的补退选通常需要先查看教务处通知，再联系学院确认课程安排，同时尽早准备成绩认定和课程对应材料。',
  '主题：转专业后课程补退选和成绩认定\n\n主帖内容：我已经转到软件工程专业，想确认这学期课程补退选、成绩认定和学分转换应该先做哪一步。\n\n已审核回复整理：1. 先看教务通知确认补退选时间；2. 联系学院教务员核对课程；3. 一起准备成绩认定表和原专业成绩单。\n\n提示：以上内容来自学生社区经验整理，仅供参考，请以学校官方通知为准。',
  'teaching',
  JSON_ARRAY('转专业', '补退选', '成绩认定', '课程认定'),
  0.45,
  'approved',
  'community_summary',
  '已确认可作为辅助知识来源',
  '2026-03-27 11:25:00',
  '2026-03-27 11:25:00'
);

INSERT INTO `community_review_logs` (
  `target_type`,
  `target_id`,
  `action`,
  `reviewer`,
  `note`,
  `created_at`
) VALUES
('post', 'post_demo_teaching_01', 'approve', 'admin', '演示数据：帖子审核通过', '2026-03-27 09:20:00'),
('reply', 'reply_demo_teaching_01', 'approve', 'admin', '演示数据：回复审核通过', '2026-03-27 09:55:00'),
('reply', 'reply_demo_teaching_02', 'approve', 'admin', '演示数据：回复审核通过', '2026-03-27 10:25:00'),
('knowledge', 'ck_demo_approved_01', 'approve', 'admin', '演示数据：社区知识审核通过', '2026-03-27 11:26:00'),
('knowledge', 'ck_demo_pending_01', 'generate_knowledge', 'admin', '演示数据：已生成待审核社区知识', '2026-03-27 11:21:00');
