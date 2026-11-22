-- Branding, HR document templates, holidays, approval workflows
-- Column adds for leave_types / attendance_* are applied by migrate.ts
-- via information_schema checks (MySQL 8 has no ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  name VARCHAR(160) NOT NULL,
  holiday_date DATE NOT NULL,
  kind ENUM('public','optional','company','weekly_off') NOT NULL DEFAULT 'public',
  location VARCHAR(120) NULL,
  employee_group VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_holiday (tenant_id, holiday_date, name),
  KEY idx_holidays_date (tenant_id, holiday_date),
  CONSTRAINT fk_holidays_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS document_templates (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  doc_type VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  body_html MEDIUMTEXT NOT NULL,
  placeholders JSON NOT NULL,
  mandatory_fields JSON NOT NULL,
  header_html TEXT NULL,
  footer_html TEXT NULL,
  signatory_name VARCHAR(120) NULL,
  signatory_title VARCHAR(120) NULL,
  version INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_doc_templates_type (tenant_id, doc_type, active),
  CONSTRAINT fk_doc_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS generated_documents (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  template_id VARCHAR(32) NOT NULL,
  template_version INT NOT NULL,
  doc_type VARCHAR(64) NOT NULL,
  employee_id INT NOT NULL,
  employee_user_id VARCHAR(32) NULL,
  title VARCHAR(255) NOT NULL,
  field_values JSON NOT NULL,
  html_content MEDIUMTEXT NOT NULL,
  file_path TEXT NULL,
  mime_type VARCHAR(128) NULL DEFAULT 'text/html',
  generated_by VARCHAR(32) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gen_docs_emp (tenant_id, employee_id),
  KEY idx_gen_docs_user (tenant_id, employee_user_id),
  CONSTRAINT fk_gen_docs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_gen_docs_template FOREIGN KEY (template_id) REFERENCES document_templates(id),
  CONSTRAINT fk_gen_docs_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approval_workflows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  module_key VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  escalation_hours INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workflow_module (tenant_id, module_key),
  CONSTRAINT fk_workflows_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  step_order INT NOT NULL,
  approver_role ENUM('admin','hr','employee','manager') NOT NULL DEFAULT 'hr',
  approver_user_id VARCHAR(32) NULL,
  label VARCHAR(120) NULL,
  UNIQUE KEY uq_step (workflow_id, step_order),
  CONSTRAINT fk_steps_workflow FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  workflow_id INT NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  requester_id VARCHAR(32) NOT NULL,
  status ENUM('pending','approved','rejected','changes_requested') NOT NULL DEFAULT 'pending',
  current_step INT NOT NULL DEFAULT 1,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_approval_status (tenant_id, status, module_key),
  CONSTRAINT fk_approval_req_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_approval_req_workflow FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id)
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  step_order INT NOT NULL,
  actor_id VARCHAR(32) NOT NULL,
  action ENUM('approve','reject','request_changes','escalate') NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_approval_actions_req FOREIGN KEY (request_id) REFERENCES approval_requests(id) ON DELETE CASCADE
);
