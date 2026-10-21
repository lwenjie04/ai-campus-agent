-- Create-only schema for the disposable ai_campus_agent_ci MySQL service.
-- This file intentionally has no DROP, TRUNCATE, or database-selection statements.
CREATE TABLE IF NOT EXISTS community_posts (
  id VARCHAR(32) NOT NULL,
  author_name VARCHAR(50) NOT NULL,
  author_role ENUM('student', 'teacher') NOT NULL DEFAULT 'student',
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  tags JSON NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  knowledge_status ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none',
  quality_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  reply_count INT UNSIGNED NOT NULL DEFAULT 0,
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_replied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_posts_status_created (status, created_at DESC),
  KEY idx_posts_knowledge_status (knowledge_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_replies (
  id VARCHAR(32) NOT NULL,
  post_id VARCHAR(32) NOT NULL,
  author_name VARCHAR(50) NOT NULL,
  author_role ENUM('student', 'teacher') NOT NULL DEFAULT 'student',
  content TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  quality_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_replies_post_status_created (post_id, status, created_at ASC),
  CONSTRAINT fk_ci_replies_post_id FOREIGN KEY (post_id)
    REFERENCES community_posts (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_knowledge (
  id VARCHAR(32) NOT NULL,
  post_id VARCHAR(32) NOT NULL,
  title VARCHAR(150) NOT NULL,
  summary TEXT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  keywords JSON NULL,
  confidence DECIMAL(4,2) NOT NULL DEFAULT 0.45,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  source_type ENUM('community_post', 'community_summary') NOT NULL DEFAULT 'community_summary',
  review_note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_knowledge_post_id (post_id),
  CONSTRAINT fk_ci_knowledge_post_id FOREIGN KEY (post_id)
    REFERENCES community_posts (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_review_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_type ENUM('post', 'reply', 'knowledge') NOT NULL,
  target_id VARCHAR(32) NOT NULL,
  action ENUM('approve', 'reject', 'generate_knowledge') NOT NULL,
  reviewer VARCHAR(50) NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ci_review_target (target_type, target_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
