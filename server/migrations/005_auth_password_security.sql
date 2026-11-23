-- Auth hardening tables. User columns are ensured in migrate.ts (ensureAuthColumns).

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NULL,
  email VARCHAR(255) NOT NULL,
  employee_id VARCHAR(64) NULL,
  status ENUM('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
  requester_note TEXT NULL,
  admin_note TEXT NULL,
  resolved_by VARCHAR(32) NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prr_tenant_status (tenant_id, status),
  INDEX idx_prr_email (email)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  request_id VARCHAR(32) NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_by VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prt_user (user_id),
  INDEX idx_prt_hash (token_hash)
);
