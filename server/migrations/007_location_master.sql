-- Central location master: Country → State → District → City
-- Supports India expansion; Tamil Nadu seeded with all 38 districts via migrate seed.

CREATE TABLE IF NOT EXISTS geo_countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  code VARCHAR(8) NOT NULL,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_geo_countries (tenant_id, code),
  KEY idx_geo_countries_name (tenant_id, name),
  CONSTRAINT fk_geo_countries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS geo_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  country_id INT NOT NULL,
  code VARCHAR(16) NOT NULL,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_geo_states (tenant_id, country_id, code),
  UNIQUE KEY uq_geo_states_name (tenant_id, country_id, name),
  KEY idx_geo_states_country (country_id),
  CONSTRAINT fk_geo_states_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_geo_states_country FOREIGN KEY (country_id) REFERENCES geo_countries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS geo_districts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  state_id INT NOT NULL,
  code VARCHAR(32) NULL,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_geo_districts (tenant_id, state_id, name),
  KEY idx_geo_districts_state (state_id),
  CONSTRAINT fk_geo_districts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_geo_districts_state FOREIGN KEY (state_id) REFERENCES geo_states(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS geo_cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL DEFAULT 't-default',
  state_id INT NOT NULL,
  district_id INT NULL,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_geo_cities (tenant_id, state_id, district_id, name),
  KEY idx_geo_cities_state (state_id),
  KEY idx_geo_cities_district (district_id),
  CONSTRAINT fk_geo_cities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_geo_cities_state FOREIGN KEY (state_id) REFERENCES geo_states(id) ON DELETE CASCADE,
  CONSTRAINT fk_geo_cities_district FOREIGN KEY (district_id) REFERENCES geo_districts(id) ON DELETE SET NULL
);

-- employees.district is added idempotently in migrate.ts (ensureEmployeeLocationColumns).
