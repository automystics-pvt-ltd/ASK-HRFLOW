-- Per-user preference store (notifications, account UX). Safe additive migration.
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  prefs JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_prefs (tenant_id, user_id),
  CONSTRAINT fk_user_prefs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user_prefs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
