/**
 * Safe demo-data purge for production readiness.
 *
 * Preserves: admin users, role_permissions, organization_settings, departments,
 * leave_types, holidays, document templates, approval workflows, location master.
 *
 * Removes: demo employees + transactional data (attendance, leave requests, payroll,
 * claims, timesheets, performance reviews, demo notifications tied to demo users).
 *
 * Usage:
 *   DRY_RUN=1 npm run db:purge-demo
 *   CONFIRM=PURGE_DEMO npm run db:purge-demo
 *   CONFIRM=PURGE_DEMO BACKUP_DIR=./backups npm run db:purge-demo
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { pool, query, queryOne, DEFAULT_TENANT } from './db.js';
import { writeAudit } from './lib/audit.js';

dotenv.config();

const DEMO_EMAILS = [
  'priya.nair@automystics.com',
  'ananya.manager@automystics.com',
  'rahul.verma@automystics.com',
  'sarah.johnson@automystics.com',
  'lisa.brown@automystics.com',
  'sarah.johnson@company.com',
  'mike.chen@company.com',
  'lisa.brown@company.com',
  'david.wilson@company.com',
];

const ADMIN_EMAILS = new Set(['alvi@automystics.com']);

function envFlag(name: string) {
  const v = String(process.env[name] || '').trim();
  return v === '1' || v.toLowerCase() === 'true' || v === 'yes';
}

async function tableExists(name: string) {
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = $1 LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function backupIfRequested() {
  const dir = process.env.BACKUP_DIR?.trim();
  if (!dir) {
    console.log('No BACKUP_DIR set — skipping mysqldump (set BACKUP_DIR to write a dump first).');
    return null;
  }
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(dir, `hrflow-pre-purge-${stamp}.sql`);
  let host = process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1';
  let port = process.env.MYSQL_PORT || process.env.DB_PORT || '3306';
  let user = process.env.MYSQL_USER || process.env.DB_USER || 'root';
  let password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
  let database = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'hrflow';
  const url = process.env.DATABASE_URL;
  if (url?.startsWith('mysql://')) {
    try {
      const u = new URL(url);
      host = u.hostname || host;
      port = u.port || port;
      user = decodeURIComponent(u.username || user);
      password = decodeURIComponent(u.password || password);
      database = (u.pathname || '/hrflow').replace(/^\//, '') || database;
    } catch {
      /* keep env vars */
    }
  }
  const args = ['-h', host, '-P', String(port), '-u', user, database, `--result-file=${out}`];
  const env = { ...process.env, MYSQL_PWD: password };
  console.log(`Creating backup → ${out}`);
  const r = spawnSync('mysqldump', args, { env, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`mysqldump failed: ${r.stderr || r.stdout || 'unknown error'}`);
  }
  console.log(`Backup OK (${fs.statSync(out).size} bytes)`);
  return out;
}

async function main() {
  const dryRun = envFlag('DRY_RUN');
  const confirm = String(process.env.CONFIRM || '').trim();

  const adminCount = await queryOne<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM users WHERE tenant_id = $1 AND role = 'admin' AND active = 1`,
    [DEFAULT_TENANT],
  );
  if (Number(adminCount?.c ?? 0) < 1) {
    throw new Error('Abort: no active admin user found. Refusing to purge.');
  }

  const demoUsers = await query<{ id: string; email: string; role: string; is_demo: number }>(
    `SELECT id, email, role, COALESCE(is_demo, 0) AS is_demo FROM users
     WHERE tenant_id = $1
       AND role <> 'admin'
       AND (
         COALESCE(is_demo, 0) = 1
         OR LOWER(email) IN (${DEMO_EMAILS.map((_, i) => `$${i + 2}`).join(',')})
       )`,
    [DEFAULT_TENANT, ...DEMO_EMAILS.map((e) => e.toLowerCase())],
  );

  const demoUserIds = demoUsers.map((u) => u.id);
  const empParams: unknown[] = [DEFAULT_TENANT];
  const empClauses: string[] = [];
  if (demoUserIds.length) {
    empClauses.push(
      `user_id IN (${demoUserIds.map((_, i) => `$${i + 2}`).join(',')})`,
    );
    empParams.push(...demoUserIds);
  }
  const emailStart = empParams.length + 1;
  empClauses.push(
    `LOWER(email) IN (${DEMO_EMAILS.map((_, i) => `$${emailStart + i}`).join(',')})`,
  );
  empParams.push(...DEMO_EMAILS.map((e) => e.toLowerCase()));
  const demoEmployees = await query<{ id: number; email: string; user_id: string | null }>(
    `SELECT id, email, user_id FROM employees WHERE tenant_id = $1 AND (${empClauses.join(' OR ')})`,
    empParams,
  );
  const empIds = demoEmployees.map((e) => e.id);

  const counts = {
    demoUsers: demoUsers.length,
    demoEmployees: empIds.length,
    leaveRequests: 0,
    attendanceDays: 0,
    attendanceEvents: 0,
    claims: 0,
    payslips: 0,
    payrollRuns: 0,
    timesheets: 0,
    performance: 0,
  };

  if (demoUserIds.length) {
    const placeholders = demoUserIds.map((_, i) => `$${i + 2}`).join(',');
    const [lr] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM leave_requests WHERE tenant_id = $1 AND user_id IN (${placeholders})`,
      [DEFAULT_TENANT, ...demoUserIds],
    );
    counts.leaveRequests = Number(lr?.c ?? 0);
    const [ad] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM attendance_days WHERE tenant_id = $1 AND user_id IN (${placeholders})`,
      [DEFAULT_TENANT, ...demoUserIds],
    );
    counts.attendanceDays = Number(ad?.c ?? 0);
    const [ae] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM attendance_events WHERE tenant_id = $1 AND user_id IN (${placeholders})`,
      [DEFAULT_TENANT, ...demoUserIds],
    );
    counts.attendanceEvents = Number(ae?.c ?? 0);
    if (await tableExists('expense_claims')) {
      const [cl] = await query<{ c: number | string }>(
        `SELECT COUNT(*) AS c FROM expense_claims WHERE tenant_id = $1 AND user_id IN (${placeholders})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      counts.claims = Number(cl?.c ?? 0);
    }
    if (await tableExists('timesheets')) {
      const [ts] = await query<{ c: number | string }>(
        `SELECT COUNT(*) AS c FROM timesheets WHERE tenant_id = $1 AND user_id IN (${placeholders})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      counts.timesheets = Number(ts?.c ?? 0);
    }
  }
  if (empIds.length && (await tableExists('payslips'))) {
    const ph = empIds.map((_, i) => `$${i + 2}`).join(',');
    const [ps] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM payslips WHERE tenant_id = $1 AND employee_id IN (${ph})`,
      [DEFAULT_TENANT, ...empIds],
    );
    counts.payslips = Number(ps?.c ?? 0);
  }
  if (await tableExists('payroll_runs')) {
    const [pr] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM payroll_runs WHERE tenant_id = $1`,
      [DEFAULT_TENANT],
    );
    counts.payrollRuns = Number(pr?.c ?? 0);
  }
  if (empIds.length && (await tableExists('performance_reviews'))) {
    const ph = empIds.map((_, i) => `$${i + 2}`).join(',');
    const [pf] = await query<{ c: number | string }>(
      `SELECT COUNT(*) AS c FROM performance_reviews WHERE tenant_id = $1 AND employee_id IN (${ph})`,
      [DEFAULT_TENANT, ...empIds],
    );
    counts.performance = Number(pf?.c ?? 0);
  }

  console.log('Purge plan (demo only; admin + masters preserved):');
  console.log(JSON.stringify({ dryRun, counts, demoUserEmails: demoUsers.map((u) => u.email) }, null, 2));

  // Guard: never touch admin emails
  for (const u of demoUsers) {
    if (ADMIN_EMAILS.has(u.email.toLowerCase()) || u.role === 'admin') {
      throw new Error(`Abort: refuse to purge admin account ${u.email}`);
    }
  }

  if (dryRun) {
    console.log('DRY_RUN complete — no changes written.');
    await pool.end();
    return;
  }

  if (confirm !== 'PURGE_DEMO') {
    console.error('Refusing to purge. Set CONFIRM=PURGE_DEMO (and ideally BACKUP_DIR=...) to proceed.');
    process.exit(2);
  }

  await backupIfRequested();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const run = async (sql: string, params: unknown[] = []) => {
      // db helper uses $1 style; convert for mysql2 raw connection
      let i = 0;
      const converted = sql.replace(/\$(\d+)/g, () => '?');
      // Ensure placeholders match order — our helpers already use sequential $n
      void i;
      await conn.query(converted, params);
    };

    if (demoUserIds.length) {
      const ph = demoUserIds.map(() => '?').join(',');
      await run(
        `DELETE FROM leave_requests WHERE tenant_id = ? AND user_id IN (${ph})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      await run(
        `DELETE FROM leave_balances WHERE tenant_id = ? AND user_id IN (${ph})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      await run(
        `DELETE FROM attendance_days WHERE tenant_id = ? AND user_id IN (${ph})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      await run(
        `DELETE FROM attendance_events WHERE tenant_id = ? AND user_id IN (${ph})`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
      if (await tableExists('expense_claims')) {
        await run(
          `DELETE FROM expense_claims WHERE tenant_id = ? AND user_id IN (${ph})`,
          [DEFAULT_TENANT, ...demoUserIds],
        );
      }
      if (await tableExists('timesheets')) {
        await run(
          `DELETE FROM timesheets WHERE tenant_id = ? AND user_id IN (${ph})`,
          [DEFAULT_TENANT, ...demoUserIds],
        );
      }
      if (await tableExists('notifications')) {
        await run(
          `DELETE FROM notifications WHERE tenant_id = ? AND user_id IN (${ph})`,
          [DEFAULT_TENANT, ...demoUserIds],
        );
      }
    }

    if (empIds.length) {
      const ph = empIds.map(() => '?').join(',');
      if (await tableExists('payslips')) {
        await run(`DELETE FROM payslips WHERE tenant_id = ? AND employee_id IN (${ph})`, [
          DEFAULT_TENANT,
          ...empIds,
        ]);
      }
      if (await tableExists('employee_salary_structures')) {
        await run(
          `DELETE FROM employee_salary_structures WHERE tenant_id = ? AND employee_id IN (${ph})`,
          [DEFAULT_TENANT, ...empIds],
        );
      }
      if (await tableExists('performance_reviews')) {
        await run(
          `DELETE FROM performance_reviews WHERE tenant_id = ? AND employee_id IN (${ph})`,
          [DEFAULT_TENANT, ...empIds],
        );
      }
      if (await tableExists('generated_documents')) {
        await run(
          `DELETE FROM generated_documents WHERE tenant_id = ? AND employee_id IN (${ph})`,
          [DEFAULT_TENANT, ...empIds],
        );
      }
      await run(`DELETE FROM employees WHERE tenant_id = ? AND id IN (${ph})`, [DEFAULT_TENANT, ...empIds]);
    }

    // Clear orphan payroll runs with no payslips
    if (await tableExists('payroll_runs')) {
      await run(
        `DELETE pr FROM payroll_runs pr
         LEFT JOIN payslips p ON p.payroll_run_id = pr.id
         WHERE pr.tenant_id = ? AND p.id IS NULL`,
        [DEFAULT_TENANT],
      );
    }

    // Mark remaining demo logins; optionally deactivate (production hardening)
    if (demoUserIds.length) {
      const ph = demoUserIds.map(() => '?').join(',');
      const deactivate = String(process.env.DEACTIVATE_DEMO_USERS || '').trim() === '1';
      await run(
        `UPDATE users SET is_demo = 1${deactivate ? ', active = 0' : ', active = 1'}
         WHERE tenant_id = ? AND id IN (${ph}) AND role <> 'admin'`,
        [DEFAULT_TENANT, ...demoUserIds],
      );
    }

    // Ensure primary admin is not flagged demo and stays active
    await run(
      `UPDATE users SET active = 1, is_demo = 0
       WHERE tenant_id = ? AND role = 'admin' AND LOWER(email) IN ('alvi@automystics.com')`,
      [DEFAULT_TENANT],
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await writeAudit(
    'system',
    'System',
    'Demo data purged',
    `Removed demo employees=${empIds.length}, users_deactivated=${demoUserIds.length}`,
    undefined,
    {
      moduleKey: 'system',
      after: counts,
    },
  );

  console.log('Purge complete. Admin, roles, permissions, and master data preserved.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
