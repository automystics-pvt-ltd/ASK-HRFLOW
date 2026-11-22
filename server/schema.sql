-- ASK HRFlow MySQL schema (multi-tenant ready)

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tenants (id, name, slug)
VALUES ('t-default', 'Automystics', 'automystics')
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','hr','employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  department_access JSON NOT NULL,
  last_login DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY idx_users_tenant (tenant_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  role ENUM('admin','hr','employee') NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  actions JSON NOT NULL,
  UNIQUE KEY uq_role_perms (tenant_id, role, module_id),
  CONSTRAINT fk_role_perms_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  actions JSON NOT NULL,
  UNIQUE KEY uq_user_perms (tenant_id, user_id, module_id),
  KEY idx_user_permissions_user (user_id),
  CONSTRAINT fk_user_perms_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user_perms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  name VARCHAR(64) NOT NULL,
  head_name VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_dept (tenant_id, name),
  CONSTRAINT fk_dept_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  department VARCHAR(64) NOT NULL,
  position VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  join_date DATE NOT NULL,
  salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  location VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  avatar TEXT NULL,
  manager VARCHAR(120) NULL,
  skills JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employees_tenant_email (tenant_id, email),
  KEY idx_employees_tenant (tenant_id),
  KEY idx_employees_department (department),
  KEY idx_employees_status (status),
  CONSTRAINT fk_employees_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  name VARCHAR(120) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INT NOT NULL DEFAULT 15,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_shifts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  work_date DATE NOT NULL,
  event_type ENUM('check_in','check_out') NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  accuracy DOUBLE NULL,
  location_label VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attendance_user_date (user_id, work_date),
  KEY idx_attendance_tenant (tenant_id),
  CONSTRAINT fk_att_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_att_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_days (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  work_date DATE NOT NULL,
  check_in DATETIME NULL,
  check_out DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Present',
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  location VARCHAR(120) NULL,
  UNIQUE KEY uq_attendance_day (tenant_id, user_id, work_date),
  CONSTRAINT fk_att_days_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_att_days_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  code VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  default_days INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_leave_types (tenant_id, code),
  CONSTRAINT fk_leave_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  leave_type_id INT NOT NULL,
  year INT NOT NULL,
  allocated DECIMAL(6,2) NOT NULL DEFAULT 0,
  used DECIMAL(6,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_leave_balances (tenant_id, user_id, leave_type_id, year),
  CONSTRAINT fk_leave_bal_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_leave_bal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_bal_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  employee_name VARCHAR(120) NOT NULL,
  leave_type_id INT NULL,
  type VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(6,2) NOT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  reason TEXT,
  comment TEXT NULL,
  decided_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_leave_user (user_id),
  KEY idx_leave_status (status),
  CONSTRAINT fk_leave_req_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_leave_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_req_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
);

CREATE TABLE IF NOT EXISTS timesheets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  week_start DATE NOT NULL,
  status ENUM('draft','submitted','approved','rejected','locked') NOT NULL DEFAULT 'draft',
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  reviewed_by VARCHAR(32) NULL,
  reviewed_at DATETIME NULL,
  review_comment TEXT NULL,
  UNIQUE KEY uq_timesheets (tenant_id, user_id, week_start),
  CONSTRAINT fk_timesheets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_timesheets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  timesheet_id INT NOT NULL,
  work_date DATE NOT NULL,
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  UNIQUE KEY uq_timesheet_entries (timesheet_id, work_date),
  CONSTRAINT fk_ts_entries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ts_entries_sheet FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  period_label VARCHAR(64) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payroll_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  employee_id INT NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  components JSON NOT NULL,
  CONSTRAINT fk_salary_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_salary_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payslips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  payroll_run_id INT NOT NULL,
  employee_id INT NOT NULL,
  net_pay DECIMAL(12,2) NOT NULL,
  breakdown JSON NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payslips_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_payslips_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_payslips_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_openings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  title VARCHAR(200) NOT NULL,
  department VARCHAR(64) NOT NULL,
  location VARCHAR(120) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  job_opening_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  stage VARCHAR(64) NOT NULL DEFAULT 'applied',
  resume_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_candidates_job FOREIGN KEY (job_opening_id) REFERENCES job_openings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  employee_id INT NOT NULL,
  reviewer_id VARCHAR(32) NULL,
  period_label VARCHAR(64) NOT NULL,
  rating DECIMAL(4,2) NULL,
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  employee_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE NULL,
  progress INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  CONSTRAINT fk_goals_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_goals_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  file_path TEXT NOT NULL,
  mime_type VARCHAR(128) NULL,
  uploaded_by VARCHAR(32) NULL,
  employee_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_documents_user FOREIGN KEY (uploaded_by) REFERENCES users(id),
  CONSTRAINT fk_documents_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  read_by JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user (user_id),
  CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  actor_id VARCHAR(32) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  event VARCHAR(120) NOT NULL,
  detail TEXT,
  target_id VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS organization_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  `key` VARCHAR(64) NOT NULL,
  value JSON NOT NULL,
  UNIQUE KEY uq_org_settings (tenant_id, `key`),
  CONSTRAINT fk_org_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS currency_overrides (
  employee_id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  currency_code VARCHAR(8) NOT NULL,
  CONSTRAINT fk_currency_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
