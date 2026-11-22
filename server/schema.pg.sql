-- ASK HRFlow PostgreSQL schema (multi-tenant ready)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'hr', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM ('Pending', 'Approved', 'Rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE timesheet_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (id, name, slug) VALUES ('t-default', 'Automystics', 'automystics')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  department VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  department_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_login TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  role user_role NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (tenant_id, role, module_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (tenant_id, user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  name VARCHAR(64) NOT NULL,
  head_name VARCHAR(120) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NULL REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  department VARCHAR(64) NOT NULL,
  position VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  join_date DATE NOT NULL,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  location VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  avatar TEXT NULL,
  manager VARCHAR(120) NULL,
  skills JSONB NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  name VARCHAR(120) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INT NOT NULL DEFAULT 15,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  accuracy DOUBLE PRECISION NULL,
  location_label VARCHAR(120) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_events(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_events(tenant_id);

CREATE TABLE IF NOT EXISTS attendance_days (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ NULL,
  check_out TIMESTAMPTZ NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Present',
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  location VARCHAR(120) NULL,
  UNIQUE (tenant_id, user_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  default_days INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INT NOT NULL,
  allocated NUMERIC(6,2) NOT NULL DEFAULT 0,
  used NUMERIC(6,2) NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, user_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_name VARCHAR(120) NOT NULL,
  leave_type_id INT NULL REFERENCES leave_types(id),
  type VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(6,2) NOT NULL,
  status leave_status NOT NULL DEFAULT 'Pending',
  reason TEXT,
  comment TEXT NULL,
  decided_by VARCHAR(120) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);

CREATE TABLE IF NOT EXISTS timesheets (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  status timesheet_status NOT NULL DEFAULT 'draft',
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NULL,
  reviewed_by VARCHAR(32) NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_comment TEXT NULL,
  UNIQUE (tenant_id, user_id, week_start)
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  timesheet_id INT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  UNIQUE (timesheet_id, work_date)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  period_label VARCHAR(64) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS payslips (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  payroll_run_id INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  net_pay NUMERIC(12,2) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_openings (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  title VARCHAR(200) NOT NULL,
  department VARCHAR(64) NOT NULL,
  location VARCHAR(120) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  job_opening_id INT NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  stage VARCHAR(64) NOT NULL DEFAULT 'applied',
  resume_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id VARCHAR(32) NULL REFERENCES users(id),
  period_label VARCHAR(64) NOT NULL,
  rating NUMERIC(4,2) NULL,
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE NULL,
  progress INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  file_path TEXT NOT NULL,
  mime_type VARCHAR(128) NULL,
  uploaded_by VARCHAR(32) NULL REFERENCES users(id),
  employee_id INT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  actor_id VARCHAR(32) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  event VARCHAR(120) NOT NULL,
  detail TEXT,
  target_id VARCHAR(32) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_settings (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  key VARCHAR(64) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS currency_overrides (
  employee_id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default' REFERENCES tenants(id),
  currency_code VARCHAR(8) NOT NULL
);