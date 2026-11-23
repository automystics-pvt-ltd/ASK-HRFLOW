import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, query } from './db.js';
import { seedLocationMaster } from './lib/location-seed.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applied(): Promise<Set<string>> {
  const rows = await query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

async function applyInit() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', ['001_init']);
  console.log('Applied migration 001_init (schema.sql)');
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = $1 AND COLUMN_NAME = $2
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function ensureColumn(table: string, column: string, definition: string) {
  if (await columnExists(table, column)) return;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  + ${table}.${column}`);
}

async function ensureBrandingDocsColumns() {
  await ensureColumn('leave_types', 'carry_forward', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('leave_types', 'allow_half_day', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('leave_types', 'eligibility_note', 'VARCHAR(255) NULL');
  await ensureColumn('leave_types', 'policy_json', 'JSON NULL');
  await ensureColumn('attendance_events', 'location_address', 'VARCHAR(512) NULL');
  await ensureColumn('attendance_days', 'location_address', 'VARCHAR(512) NULL');
}

async function ensureAdvancedColumns() {
  await ensureColumn('employees', 'manager_user_id', 'VARCHAR(32) NULL');
  await ensureColumn('employees', 'employment_type', "VARCHAR(64) NULL DEFAULT 'full_time'");
  await ensureColumn('employees', 'designation', 'VARCHAR(120) NULL');
  await ensureColumn('leave_requests', 'half_day', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('leave_requests', 'auto_approved', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('approval_actions', 'comment', 'TEXT NULL');
}

async function ensureManagerRoleEnums() {
  // Expand role ENUMs to include manager (idempotent via MODIFY)
  await pool.query(
    `ALTER TABLE users MODIFY COLUMN role ENUM('admin','hr','employee','manager') NOT NULL DEFAULT 'employee'`,
  );
  await pool.query(
    `ALTER TABLE role_permissions MODIFY COLUMN role ENUM('admin','hr','employee','manager') NOT NULL`,
  );
  await pool.query(
    `ALTER TABLE approval_steps MODIFY COLUMN approver_role ENUM('admin','hr','employee','manager') NOT NULL DEFAULT 'hr'`,
  );
  console.log('  ~ role ENUMs include manager');
}

async function ensureAuthColumns() {
  await ensureColumn('users', 'failed_login_attempts', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('users', 'locked_until', 'DATETIME NULL');
  await ensureColumn('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'is_demo', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'password_changed_at', 'DATETIME NULL');
  await ensureColumn('users', 'mfa_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'mfa_secret', 'VARCHAR(128) NULL');
  await pool.query(
    `UPDATE users SET is_demo = 1
     WHERE email IN (
       'alvi@automystics.com','priya.nair@automystics.com','ananya.manager@automystics.com',
       'rahul.verma@automystics.com','sarah.johnson@automystics.com','lisa.brown@automystics.com'
     )`,
  );
}

async function ensureEmployeeLocationColumns() {
  await ensureColumn('employees', 'state', 'VARCHAR(120) NULL');
  await ensureColumn('employees', 'district', 'VARCHAR(120) NULL');
}

async function ensureProdReadyColumns() {
  await ensureColumn('employees', 'created_by', 'VARCHAR(32) NULL');
  await ensureColumn('employees', 'updated_by', 'VARCHAR(32) NULL');
  await ensureColumn('employees', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('leave_requests', 'created_by', 'VARCHAR(32) NULL');
  await ensureColumn('leave_requests', 'updated_by', 'VARCHAR(32) NULL');
  await ensureColumn('leave_requests', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('expense_claims', 'created_by', 'VARCHAR(32) NULL');
  await ensureColumn('expense_claims', 'updated_by', 'VARCHAR(32) NULL');
  await ensureColumn('expense_claims', 'currency_code', 'VARCHAR(8) NULL');
  await ensureColumn('payroll_runs', 'created_by', 'VARCHAR(32) NULL');
  await ensureColumn('payroll_runs', 'currency_code', 'VARCHAR(8) NULL');
  await ensureColumn('payslips', 'currency_code', 'VARCHAR(8) NULL');
  await ensureColumn('employee_salary_structures', 'currency_code', 'VARCHAR(8) NULL');
  await ensureColumn('employee_salary_structures', 'updated_by', 'VARCHAR(32) NULL');
  await ensureColumn('employee_salary_structures', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('audit_logs', 'module_key', 'VARCHAR(64) NULL');
  await ensureColumn('audit_logs', 'before_json', 'JSON NULL');
  await ensureColumn('audit_logs', 'after_json', 'JSON NULL');
  console.log('  ~ prod-ready audit/currency columns ensured');
}

async function main() {
  await ensureMigrationsTable();
  const done = await applied();
  if (!done.has('001_init')) {
    await applyInit();
  } else {
    console.log('001_init already applied');
  }
  const migDir = path.join(__dirname, '..', 'migrations');
  if (fs.existsSync(migDir)) {
    const files = fs
      .readdirSync(migDir)
      .filter((f) => /^\d{3}_.+\.sql$/i.test(f) && f !== '001_init.sql')
      .sort();
    for (const file of files) {
      const id = file.replace(/\.sql$/i, '');
      if (done.has(id)) {
        if (id === '002_branding_docs_holidays_approvals') await ensureBrandingDocsColumns();
        if (id === '003_advanced_leave_payroll_claims') {
          await ensureAdvancedColumns();
          await ensureManagerRoleEnums();
        }
        if (id === '005_auth_password_security') await ensureAuthColumns();
        if (id === '006_employee_state') await ensureEmployeeLocationColumns();
        if (id === '009_prod_ready_audit_currency') await ensureProdReadyColumns();
        continue;
      }
      const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
      await pool.query(sql);
      if (id === '002_branding_docs_holidays_approvals') await ensureBrandingDocsColumns();
      if (id === '003_advanced_leave_payroll_claims') {
        await ensureAdvancedColumns();
        await ensureManagerRoleEnums();
      }
      if (id === '005_auth_password_security') await ensureAuthColumns();
      if (id === '006_employee_state') await ensureEmployeeLocationColumns();
      if (id === '009_prod_ready_audit_currency') await ensureProdReadyColumns();
      await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [id]);
      console.log(`Applied migration ${id}`);
    }
  }
  await ensureBrandingDocsColumns();
  await ensureAdvancedColumns();
  await ensureAuthColumns();
  await ensureEmployeeLocationColumns();
  try {
    await ensureProdReadyColumns();
  } catch (e) {
    console.warn('Prod-ready columns ensure skipped:', e instanceof Error ? e.message : e);
  }
  try {
    await ensureManagerRoleEnums();
  } catch (e) {
    console.warn('Manager ENUM ensure skipped:', e instanceof Error ? e.message : e);
  }
  if (done.has('007_location_master') || true) {
    try {
      const table = await query<{ ok: number }>(
        `SELECT 1 AS ok FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'geo_countries' LIMIT 1`,
      );
      if (table.length) {
        const seeded = await seedLocationMaster();
        console.log(
          `Location master seed: countries=${seeded.countries} TN districts=${seeded.tnDistricts} TN cities≈${seeded.tnCities}`,
        );
      }
    } catch (e) {
      console.warn('Location seed skipped:', e instanceof Error ? e.message : e);
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
