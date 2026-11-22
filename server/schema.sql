CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','hr','employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  department_access JSON,
  permissions JSON,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  employee_name VARCHAR(120) NOT NULL,
  type VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  reason TEXT,
  comment TEXT NULL,
  decided_by VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  work_date DATE NOT NULL,
  check_in VARCHAR(16) NULL,
  check_out VARCHAR(16) NULL,
  status VARCHAR(32) NOT NULL,
  hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  location VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  read_by JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  actor_id VARCHAR(32) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  event VARCHAR(120) NOT NULL,
  detail TEXT,
  target_id VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin','hr','employee') NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  actions JSON NOT NULL,
  UNIQUE KEY uniq_role_module (role, module_id)
);

CREATE TABLE IF NOT EXISTS currency_overrides (
  employee_id VARCHAR(32) PRIMARY KEY,
  currency_code VARCHAR(8) NOT NULL
);