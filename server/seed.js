import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool, { query } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
  }
}

const allDepts = JSON.stringify(['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance']);
const hrDepts = JSON.stringify(['Engineering', 'Product', 'Design', 'Sales', 'HR']);

async function seed() {
  await runSchema();
  const hash = await bcrypt.hash('demo123', 10);

  const users = [
    ['u-admin', 'Alvi', 'alvi@automystics.com', hash, 'admin', 'Executive', 1, allDepts],
    ['u-hr', 'Priya Nair', 'priya.nair@automystics.com', hash, 'hr', 'HR', 1, hrDepts],
    ['u-emp', 'Rahul Verma', 'rahul.verma@automystics.com', hash, 'employee', 'Engineering', 1, '[]'],
    ['u-emp2', 'Sarah Johnson', 'sarah.johnson@automystics.com', hash, 'employee', 'Engineering', 1, '[]'],
    ['u-emp3', 'Lisa Brown', 'lisa.brown@automystics.com', hash, 'employee', 'Design', 0, '[]'],
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, department, active, department_access)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role), active=VALUES(active)`,
      u,
    );
  }

  const employees = [
    ['Sarah Johnson', 'sarah.johnson@company.com', '+1 (555) 123-4567', 'Engineering', 'Senior Developer', 'Active', '2022-03-15', 95000, 'New York', 'United States', 'John Smith', '["React","Node.js","TypeScript"]'],
    ['Mike Chen', 'mike.chen@company.com', '+1 (555) 234-5678', 'Product', 'Product Manager', 'Active', '2021-08-22', 110000, 'San Francisco', 'United States', 'Jane Doe', '["Product Strategy","Analytics"]'],
    ['Lisa Brown', 'lisa.brown@company.com', '+1 (555) 345-6789', 'Design', 'UX Designer', 'On Leave', '2023-01-10', 85000, 'London', 'United Kingdom', 'Alex Wilson', '["Figma","User Research"]'],
    ['David Wilson', 'david.wilson@company.com', '+1 (555) 456-7890', 'Sales', 'Sales Executive', 'Active', '2020-11-05', 75000, 'Dubai', 'United Arab Emirates', 'Sarah Miller', '["CRM","Negotiation"]'],
  ];

  await query('DELETE FROM employees');
  for (const e of employees) {
    await query(
      `INSERT INTO employees (name, email, phone, department, position, status, join_date, salary, location, country, manager, skills)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e,
    );
  }

  await query('DELETE FROM leave_requests');
  await query(
    `INSERT INTO leave_requests (user_id, employee_name, type, start_date, end_date, days, status, reason)
     VALUES ('u-emp2', 'Sarah Johnson', 'Vacation', '2026-12-15', '2026-12-21', 5, 'Pending', 'Family vacation to Hawaii')`,
  );

  await query('DELETE FROM attendance');
  const attendance = [
    ['u-emp', '2024-01-15', '09:00', '17:30', 'Present', 8.5, 'Office'],
    ['u-emp', '2024-01-14', '09:15', '17:45', 'Present', 8.5, 'Office'],
  ];
  for (const a of attendance) {
    await query(
      `INSERT INTO attendance (user_id, work_date, check_in, check_out, status, hours, location) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      a,
    );
  }

  await query('DELETE FROM notices');
  await query(
    `INSERT INTO notices (id, user_id, title, body, kind, read_by) VALUES
     ('n1', 'all', 'Company holiday', 'Offices are closed on the upcoming public holiday.', 'announcement', '[]'),
     ('n2', 'u-hr', 'Leave request pending', 'Sarah Johnson requested 3 days of annual leave.', 'approval', '[]')`,
  );

  console.log('Database seeded successfully.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});