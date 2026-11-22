-- Advanced leave policies, manager hierarchy, expense claims, salary structures, card templates
-- ENUM alterations for manager role are applied in migrate.ts (MySQL-safe).

CREATE TABLE IF NOT EXISTS leave_policy_settings (
  tenant_id VARCHAR(32) NOT NULL PRIMARY KEY,
  auto_approve_enabled TINYINT(1) NOT NULL DEFAULT 1,
  auto_approve_days INT NOT NULL DEFAULT 20,
  count_weekends TINYINT(1) NOT NULL DEFAULT 0,
  count_holidays TINYINT(1) NOT NULL DEFAULT 0,
  require_approval_comment TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_policy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  max_amount DECIMAL(12,2) NULL,
  monthly_limit DECIMAL(12,2) NULL,
  annual_limit DECIMAL(12,2) NULL,
  require_receipt TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_exp_cat (tenant_id, code),
  CONSTRAINT fk_exp_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS expense_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  user_id VARCHAR(32) NOT NULL,
  employee_id INT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  receipt_path TEXT NULL,
  status ENUM('pending','approved','rejected','clarification','paid') NOT NULL DEFAULT 'pending',
  approved_amount DECIMAL(12,2) NULL,
  payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  current_approver_id VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_claims_user (tenant_id, user_id, status),
  CONSTRAINT fk_claims_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_claims_cat FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

CREATE TABLE IF NOT EXISTS expense_claim_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claim_id INT NOT NULL,
  actor_id VARCHAR(32) NOT NULL,
  action ENUM('approve','reject','clarification','pay') NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_actions_claim FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS salary_components (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  kind ENUM('earning','deduction') NOT NULL DEFAULT 'earning',
  is_percent TINYINT(1) NOT NULL DEFAULT 0,
  default_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  taxable TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_sal_comp (tenant_id, code),
  CONSTRAINT fk_sal_comp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS employee_salary_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  employee_id INT NOT NULL,
  effective_from DATE NOT NULL,
  basic DECIMAL(12,2) NOT NULL DEFAULT 0,
  components_json JSON NOT NULL,
  notes TEXT NULL,
  created_by VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sal_emp (tenant_id, employee_id, effective_from),
  CONSTRAINT fk_sal_struct_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_sal_struct_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS statutory_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  rate_percent DECIMAL(8,4) NOT NULL DEFAULT 0,
  flat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_stat_code (tenant_id, code, effective_from),
  CONSTRAINT fk_stat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS card_templates (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  card_kind ENUM('id_card','business_card') NOT NULL,
  name VARCHAR(160) NOT NULL,
  front_html MEDIUMTEXT NOT NULL,
  back_html MEDIUMTEXT NULL,
  width_mm INT NOT NULL DEFAULT 86,
  height_mm INT NOT NULL DEFAULT 54,
  version INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_card_kind (tenant_id, card_kind, active),
  CONSTRAINT fk_card_tmpl_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS generated_cards (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  template_id VARCHAR(32) NOT NULL,
  card_kind ENUM('id_card','business_card') NOT NULL,
  employee_id INT NOT NULL,
  employee_user_id VARCHAR(32) NULL,
  title VARCHAR(255) NOT NULL,
  html_content MEDIUMTEXT NOT NULL,
  generated_by VARCHAR(32) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gen_cards_emp (tenant_id, employee_id),
  CONSTRAINT fk_gen_cards_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_gen_cards_tmpl FOREIGN KEY (template_id) REFERENCES card_templates(id),
  CONSTRAINT fk_gen_cards_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
