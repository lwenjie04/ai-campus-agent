-- Additive V2 migration. Do not rerun legacy community initialization SQL here.
CREATE TABLE IF NOT EXISTS chat_request_receipts (
  request_id CHAR(36) NOT NULL,
  owner_type ENUM('user', 'guest') NOT NULL,
  owner_id VARCHAR(191) NOT NULL,
  status ENUM('completed') NOT NULL DEFAULT 'completed',
  source_ids JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (request_id),
  KEY idx_chat_request_receipts_owner_completed (owner_type, owner_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS chat_feedback (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  owner_type ENUM('user', 'guest') NOT NULL,
  owner_id VARCHAR(191) NOT NULL,
  value ENUM('helpful', 'none') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_feedback_owner_request (owner_type, owner_id, request_id),
  KEY idx_chat_feedback_request (request_id),
  CONSTRAINT fk_chat_feedback_request
    FOREIGN KEY (request_id) REFERENCES chat_request_receipts (request_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
