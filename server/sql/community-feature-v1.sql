-- 学生社区功能 V1 MySQL 建表脚本
-- 适用版本：MySQL 8.0+
-- 设计目标：
-- 1. 支撑学生社区的帖子、回复、审核、知识沉淀四类核心能力
-- 2. 与现有官方知识库分层，社区知识作为低可信度辅助来源参与 RAG
-- 3. 第一版暂不依赖完整登录体系，因此先保留 author_name / author_role
-- 4. 主键采用 varchar，便于后端后续用 UUID / ULID / 自定义字符串 ID

CREATE DATABASE IF NOT EXISTS `ai_campus_agent`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `ai_campus_agent`;

-- 为了方便重复执行脚本，按依赖顺序先删除旧表
DROP TABLE IF EXISTS `community_review_logs`;
DROP TABLE IF EXISTS `community_knowledge`;
DROP TABLE IF EXISTS `community_replies`;
DROP TABLE IF EXISTS `community_posts`;

-- 帖子主表：
-- 存储学生社区中的主帖内容，是社区互动的核心实体。
CREATE TABLE `community_posts` (
  `id` VARCHAR(32) NOT NULL COMMENT '帖子业务 ID，建议后端生成 ULID/UUID',
  `author_name` VARCHAR(50) NOT NULL COMMENT '发帖人展示昵称；当前阶段不接登录体系，先直接存名称',
  `author_role` ENUM('student', 'teacher') NOT NULL DEFAULT 'student' COMMENT '作者角色，第一版主要是学生，保留教师扩展位',
  `title` VARCHAR(150) NOT NULL COMMENT '帖子标题',
  `content` TEXT NOT NULL COMMENT '帖子正文',
  `category` VARCHAR(32) NOT NULL COMMENT '帖子分类，如 scholarship / teaching / exam / life / general',
  `tags` JSON NULL COMMENT '标签数组，便于前端筛选与后续关键词沉淀，如 [\"转专业\",\"补退选\"]',
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' COMMENT '审核状态：待审核/已通过/已拒绝',
  `knowledge_status` ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none' COMMENT '该帖子是否已转为社区知识条目',
  `quality_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '内容质量评分，后续可由点赞数、回复质量、人工审核综合生成',
  `reply_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已通过回复数缓存，便于列表展示',
  `like_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数缓存，第一版可先不实现点赞行为，但字段提前保留',
  `view_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浏览量缓存',
  `last_replied_at` DATETIME NULL COMMENT '最后一次有效回复时间，便于后续做排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_posts_status_created` (`status`, `created_at` DESC),
  KEY `idx_posts_category_status_created` (`category`, `status`, `created_at` DESC),
  KEY `idx_posts_knowledge_status` (`knowledge_status`),
  FULLTEXT KEY `ft_posts_title_content` (`title`, `content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学生社区帖子表';

-- 回复表：
-- 存储对帖子的一层回复。第一版先做单层回复，不做楼中楼。
CREATE TABLE `community_replies` (
  `id` VARCHAR(32) NOT NULL COMMENT '回复业务 ID',
  `post_id` VARCHAR(32) NOT NULL COMMENT '所属帖子 ID',
  `author_name` VARCHAR(50) NOT NULL COMMENT '回复人展示昵称',
  `author_role` ENUM('student', 'teacher') NOT NULL DEFAULT 'student' COMMENT '回复人角色',
  `content` TEXT NOT NULL COMMENT '回复正文',
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' COMMENT '审核状态',
  `quality_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '回复质量评分，用于后续挑选优质经验回复',
  `like_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数缓存',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_replies_post_status_created` (`post_id`, `status`, `created_at` ASC),
  KEY `idx_replies_status_created` (`status`, `created_at` DESC),
  CONSTRAINT `fk_replies_post_id`
    FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学生社区回复表';

-- 社区知识条目表：
-- 这是“社区互动层”到“知识沉淀层”的桥梁。
-- 只有经过筛选或审核的社区内容，才会形成这里的结构化条目，用于后续 RAG 检索。
CREATE TABLE `community_knowledge` (
  `id` VARCHAR(32) NOT NULL COMMENT '社区知识条目业务 ID',
  `post_id` VARCHAR(32) NOT NULL COMMENT '来源主帖 ID；一条知识条目通常对应一个主帖主题',
  `title` VARCHAR(150) NOT NULL COMMENT '社区知识标题，通常比原帖标题更适合检索展示',
  `summary` TEXT NOT NULL COMMENT '面向 RAG 的社区经验摘要',
  `content` MEDIUMTEXT NOT NULL COMMENT '整理后的完整知识正文，可包含主帖与优质回复融合结果',
  `category` VARCHAR(32) NOT NULL COMMENT '知识分类，与主知识库分类体系保持一致',
  `keywords` JSON NULL COMMENT '关键词数组，便于规则检索和后续权重增强',
  `confidence` DECIMAL(4,2) NOT NULL DEFAULT 0.45 COMMENT '可信度，社区来源默认低于官方来源',
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' COMMENT '知识条目审核状态',
  `source_type` ENUM('community_post', 'community_summary') NOT NULL DEFAULT 'community_summary' COMMENT '来源类型，便于前端 sources 展示',
  `review_note` VARCHAR(255) NULL COMMENT '审核备注，用于解释通过或拒绝原因',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_post_id` (`post_id`),
  KEY `idx_knowledge_status_category` (`status`, `category`),
  KEY `idx_knowledge_confidence` (`confidence`),
  FULLTEXT KEY `ft_knowledge_title_summary_content` (`title`, `summary`, `content`),
  CONSTRAINT `fk_knowledge_post_id`
    FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区知识沉淀表';

-- 审核日志表：
-- 记录帖子、回复、知识条目的审核轨迹，后续便于追溯。
CREATE TABLE `community_review_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '审核日志自增主键',
  `target_type` ENUM('post', 'reply', 'knowledge') NOT NULL COMMENT '审核目标类型',
  `target_id` VARCHAR(32) NOT NULL COMMENT '目标业务 ID',
  `action` ENUM('approve', 'reject', 'generate_knowledge') NOT NULL COMMENT '审核动作或知识生成动作',
  `reviewer` VARCHAR(50) NOT NULL COMMENT '审核人标识；第一版先用昵称或固定管理员名',
  `note` VARCHAR(255) NULL COMMENT '审核备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审核时间',
  PRIMARY KEY (`id`),
  KEY `idx_review_target` (`target_type`, `target_id`, `created_at` DESC),
  KEY `idx_review_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区审核日志表';

-- 可选初始化说明：
-- 第一版建议前端分类选项与这里保持一致：
-- scholarship / teaching / exam / life / general
--
-- 示例：
-- INSERT INTO community_posts (
--   id, author_name, author_role, title, content, category, tags, status
-- ) VALUES (
--   'post_01',
--   '张同学',
--   'student',
--   '转专业后课程补退选怎么操作？',
--   '我想问一下转专业之后课程补退选具体流程是什么？',
--   'teaching',
--   JSON_ARRAY('转专业', '补退选'),
--   'approved'
-- );
