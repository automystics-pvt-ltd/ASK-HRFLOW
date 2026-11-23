-- Employee login/logout activity with optional GPS + IP/UA capture.
CREATE TABLE IF NOT EXISTS login_activity (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  event ENUM('login', 'logout') NOT NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  accuracy DOUBLE NULL,
  location_label VARCHAR(160) NULL,
  location_address VARCHAR(512) NULL,
  location_status ENUM('granted', 'denied', 'unavailable', 'unsupported', 'not_requested') NOT NULL DEFAULT 'not_requested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_activity_user_created (tenant_id, user_id, created_at),
  KEY idx_login_activity_created (tenant_id, created_at),
  KEY idx_login_activity_event (tenant_id, event, created_at)
);

-- Default role templates for the new module (idempotent).
INSERT INTO role_permissions (tenant_id, role, module_id, actions)
VALUES
  ('t-default', 'admin', 'login-activity', '["create","read","update","delete","approve","export"]'),
  ('t-default', 'hr', 'login-activity', '["read","export"]'),
  ('t-default', 'manager', 'login-activity', '["read","export"]')
ON DUPLICATE KEY UPDATE actions = VALUES(actions);
