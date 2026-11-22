import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, query, DEFAULT_TENANT } from './db.js';
import { defaultRolePermissions, type Role } from './lib/permissions.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

const allDepts = ['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance'];
const hrDepts = ['Engineering', 'Product', 'Design', 'Sales', 'HR'];

async function seedRolePermissions() {
  await query('DELETE FROM role_permissions WHERE tenant_id = $1', [DEFAULT_TENANT]);
  for (const role of ['admin', 'hr', 'employee'] as Role[]) {
    const perms = { ...defaultRolePermissions[role] };
    if (role === 'hr') {
      perms.access = ['read', 'create', 'update'];
    }
    for (const [moduleId, actions] of Object.entries(perms)) {
      await query(
        `INSERT INTO role_permissions (tenant_id, role, module_id, actions)
         VALUES ($1, $2, $3, $4)
         ON DUPLICATE KEY UPDATE actions = VALUES(actions)`,
        [DEFAULT_TENANT, role, moduleId, JSON.stringify(actions)],
      );
    }
  }
}

async function seed() {
  await runSchema();
  await seedRolePermissions();

  const hash = await bcrypt.hash('demo123', 10);
  const users: [string, string, string, string, Role, string, number, string][] = [
    ['u-admin', 'Alvi', 'alvi@automystics.com', hash, 'admin', 'Executive', 1, JSON.stringify(allDepts)],
    ['u-hr', 'Priya Nair', 'priya.nair@automystics.com', hash, 'hr', 'HR', 1, JSON.stringify(hrDepts)],
    ['u-emp', 'Rahul Verma', 'rahul.verma@automystics.com', hash, 'employee', 'Engineering', 1, '[]'],
    ['u-emp2', 'Sarah Johnson', 'sarah.johnson@automystics.com', hash, 'employee', 'Engineering', 1, '[]'],
    ['u-emp3', 'Lisa Brown', 'lisa.brown@automystics.com', hash, 'employee', 'Design', 0, '[]'],
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, department, active, department_access)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role), active=VALUES(active)`,
      [u[0], DEFAULT_TENANT, u[1], u[2], u[3], u[4], u[5], u[6], u[7]],
    );
  }

  for (const d of allDepts) {
    await query(`INSERT IGNORE INTO departments (tenant_id, name) VALUES ($1,$2)`, [DEFAULT_TENANT, d]);
  }

  const leaveTypes = [
    ['vacation', 'Vacation', 25],
    ['sick', 'Sick Leave', 10],
    ['personal', 'Personal', 5],
    ['maternity', 'Maternity', 90],
  ];
  for (const [code, name, days] of leaveTypes) {
    await query(
      `INSERT INTO leave_types (tenant_id, code, name, default_days) VALUES ($1,$2,$3,$4)
       ON DUPLICATE KEY UPDATE default_days = VALUES(default_days)`,
      [DEFAULT_TENANT, code, name, days],
    );
  }

  const employees = [
    ['u-emp2', 'Sarah Johnson', 'sarah.johnson@company.com', '+1 (555) 123-4567', 'Engineering', 'Senior Developer', 'Active', '2022-03-15', 95000, 'New York', 'United States', 'John Smith', '["React","Node.js","TypeScript"]'],
    [null, 'Mike Chen', 'mike.chen@company.com', '+1 (555) 234-5678', 'Product', 'Product Manager', 'Active', '2021-08-22', 110000, 'San Francisco', 'United States', 'Jane Doe', '["Product Strategy","Analytics"]'],
    ['u-emp3', 'Lisa Brown', 'lisa.brown@company.com', '+1 (555) 345-6789', 'Design', 'UX Designer', 'On Leave', '2023-01-10', 85000, 'London', 'United Kingdom', 'Alex Wilson', '["Figma","User Research"]'],
    [null, 'David Wilson', 'david.wilson@company.com', '+1 (555) 456-7890', 'Sales', 'Sales Executive', 'Active', '2020-11-05', 75000, 'Dubai', 'United Arab Emirates', 'Sarah Miller', '["CRM","Negotiation"]'],
    ['u-emp', 'Rahul Verma', 'rahul.verma@automystics.com', null, 'Engineering', 'Software Engineer', 'Active', '2023-06-01', 72000, 'Bangalore', 'India', 'John Smith', '["TypeScript","MySQL"]'],
  ];

  await query('DELETE FROM employees WHERE tenant_id = $1', [DEFAULT_TENANT]);
  for (const e of employees) {
    await query(
      `INSERT INTO employees (tenant_id, user_id, name, email, phone, department, position, status, join_date, salary, location, country, manager, skills)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [DEFAULT_TENANT, e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], e[11], e[12]],
    );
  }

  const year = new Date().getFullYear();
  const types = await query<{ id: number; code: string; default_days: string | number }>(
    'SELECT id, code, default_days FROM leave_types WHERE tenant_id = $1',
    [DEFAULT_TENANT],
  );
  for (const uid of ['u-emp', 'u-emp2', 'u-hr']) {
    for (const lt of types) {
      await query(
        `INSERT INTO leave_balances (tenant_id, user_id, leave_type_id, year, allocated, used)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON DUPLICATE KEY UPDATE allocated = VALUES(allocated)`,
        [
          DEFAULT_TENANT,
          uid,
          lt.id,
          year,
          lt.default_days,
          lt.code === 'vacation' && uid === 'u-emp2' ? 8 : lt.code === 'sick' ? 3 : lt.code === 'personal' ? 2 : 0,
        ],
      );
    }
  }

  await query('DELETE FROM leave_requests WHERE tenant_id = $1', [DEFAULT_TENANT]);
  const vac = types.find((t) => t.code === 'vacation');
  await query(
    `INSERT INTO leave_requests (tenant_id, user_id, employee_name, leave_type_id, type, start_date, end_date, days, status, reason)
     VALUES ($1,'u-emp2','Sarah Johnson',$2,'Vacation','2026-12-15','2026-12-21',5,'Pending','Family vacation to Hawaii')`,
    [DEFAULT_TENANT, vac?.id],
  );

  await query('DELETE FROM attendance_days WHERE tenant_id = $1', [DEFAULT_TENANT]);
  await query('DELETE FROM attendance_events WHERE tenant_id = $1', [DEFAULT_TENANT]);

  const attDays = [
    ['u-emp', '2024-01-15', '09:00', '17:30', 'Present', 8.5],
    ['u-emp', '2024-01-14', '09:15', '17:45', 'Present', 8.5],
  ];
  for (const [userId, d, inT, outT, status, hours] of attDays) {
    await query(
      `INSERT INTO attendance_days (tenant_id, user_id, work_date, check_in, check_out, status, hours, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Office')`,
      [DEFAULT_TENANT, userId, d, `${d} ${inT}:00`, `${d} ${outT}:00`, status, hours],
    );
  }

  await query('DELETE FROM notices WHERE tenant_id = $1', [DEFAULT_TENANT]);
  await query(
    `INSERT IGNORE INTO notices (id, tenant_id, user_id, title, body, kind, read_by) VALUES
     ('n1', $1, 'all', 'Company holiday', 'Offices are closed on the upcoming public holiday.', 'announcement', '[]'),
     ('n2', $1, 'u-hr', 'Leave request pending', 'Sarah Johnson requested 3 days of annual leave.', 'approval', '[]')`,
    [DEFAULT_TENANT],
  );

  await query(
    `INSERT INTO organization_settings (tenant_id, \`key\`, value) VALUES ($1,'company', $2)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [DEFAULT_TENANT, JSON.stringify({ name: 'Automystics', timezone: 'Asia/Kolkata', currency: 'USD' })],
  );

  const existingShift = await query('SELECT id FROM shifts WHERE tenant_id = $1 LIMIT 1', [DEFAULT_TENANT]);
  if (existingShift.length === 0) {
    await query(`INSERT INTO shifts (tenant_id, name, start_time, end_time) VALUES ($1,'General', '09:00', '18:00')`, [
      DEFAULT_TENANT,
    ]);
  }

  await query(
    `INSERT INTO job_openings (tenant_id, title, department, location, status, description)
     VALUES ($1,'Senior Frontend Engineer','Engineering','Remote','open','React + TypeScript')`,
    [DEFAULT_TENANT],
  );

  console.log('MySQL database seeded successfully.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
