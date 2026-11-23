import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth, attachUser } from '../middleware/auth.js';
import { ensureAppUser } from '../middleware/rbac.js';
import { hasAction } from '../lib/permissions.js';
import { teamUserIds } from '../lib/team.js';

const router = Router();

export type SearchHit = {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  module: string;
  navigateTo: string;
  meta?: Record<string, string>;
};

router.get('/', requireAuth, attachUser, async (req, res) => {
  const me = await ensureAppUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json({ q, results: [] as SearchHit[], groups: {} });
  if (q.length > 100) return res.status(400).json({ error: 'Query too long.' });

  const like = `%${q.replace(/[%_]/g, '')}%`;
  const perms = me.permissions ?? {};
  const results: SearchHit[] = [];

  try {
    if (hasAction(perms, 'employees', 'read')) {
      let empSql = `SELECT id, user_id, name, email, department, position, designation, location, state, district, country
                    FROM employees WHERE tenant_id = $1
                      AND (name LIKE $2 OR email LIKE $2 OR CAST(id AS CHAR) LIKE $2
                           OR department LIKE $2 OR position LIKE $2 OR COALESCE(designation,'') LIKE $2
                           OR COALESCE(location,'') LIKE $2 OR COALESCE(state,'') LIKE $2
                           OR COALESCE(district,'') LIKE $2)
                    ORDER BY name LIMIT 12`;
      const empParams: unknown[] = [DEFAULT_TENANT, like];
      if (me.role === 'manager') {
        const team = await teamUserIds(me.id);
        if (team.length) {
          const ph = team.map((_, i) => `$${i + 3}`).join(',');
          empSql = `SELECT id, user_id, name, email, department, position, designation, location, state, district, country
                    FROM employees WHERE tenant_id = $1 AND user_id IN (${ph})
                      AND (name LIKE $2 OR email LIKE $2 OR CAST(id AS CHAR) LIKE $2
                           OR department LIKE $2 OR position LIKE $2 OR COALESCE(designation,'') LIKE $2)
                    ORDER BY name LIMIT 12`;
          empParams.push(...team);
        } else {
          empSql = `SELECT id, user_id, name, email, department, position, designation, location, state, district, country
                    FROM employees WHERE tenant_id = $1 AND 1=0`;
        }
      }
      const employees = await query(empSql, empParams);
      for (const e of employees) {
        results.push({
          id: `emp-${e.id}`,
          category: 'Employees',
          title: String(e.name),
          subtitle: [e.designation || e.position, e.department, e.email].filter(Boolean).join(' · '),
          module: 'employees',
          navigateTo: 'employees',
          meta: { employeeId: String(e.id) },
        });
      }

      const depts = await query<{ department: string; c: number }>(
        `SELECT department, COUNT(*) AS c FROM employees
         WHERE tenant_id = $1 AND department LIKE $2
         GROUP BY department ORDER BY department LIMIT 6`,
        [DEFAULT_TENANT, like],
      );
      for (const d of depts) {
        results.push({
          id: `dept-${d.department}`,
          category: 'Departments',
          title: String(d.department),
          subtitle: `${Number(d.c)} employee(s)`,
          module: 'employees',
          navigateTo: 'employees',
          meta: { department: String(d.department) },
        });
      }

      const titles = await query<{ position: string; c: number }>(
        `SELECT position, COUNT(*) AS c FROM employees
         WHERE tenant_id = $1 AND (position LIKE $2 OR COALESCE(designation,'') LIKE $2)
         GROUP BY position ORDER BY position LIMIT 6`,
        [DEFAULT_TENANT, like],
      );
      for (const t of titles) {
        results.push({
          id: `desig-${t.position}`,
          category: 'Designations',
          title: String(t.position),
          subtitle: `${Number(t.c)} employee(s)`,
          module: 'employees',
          navigateTo: 'employees',
          meta: { position: String(t.position) },
        });
      }
    }

    if (hasAction(perms, 'attendance', 'read')) {
      let leaveSql = `SELECT id, employee_name, type, status, start_date, end_date, user_id
                      FROM leave_requests WHERE tenant_id = $1
                        AND (employee_name LIKE $2 OR type LIKE $2 OR status LIKE $2 OR CAST(id AS CHAR) LIKE $2)
                      ORDER BY created_at DESC LIMIT 8`;
      const leaveParams: unknown[] = [DEFAULT_TENANT, like];
      if (me.role === 'employee') {
        leaveSql = `SELECT id, employee_name, type, status, start_date, end_date, user_id
                    FROM leave_requests WHERE tenant_id = $1 AND user_id = $3
                      AND (type LIKE $2 OR status LIKE $2 OR CAST(id AS CHAR) LIKE $2)
                    ORDER BY created_at DESC LIMIT 8`;
        leaveParams.push(me.id);
      } else if (me.role === 'manager') {
        const team = await teamUserIds(me.id);
        const ids = team.length ? team : [me.id];
        const ph = ids.map((_, i) => `$${i + 3}`).join(',');
        leaveSql = `SELECT id, employee_name, type, status, start_date, end_date, user_id
                    FROM leave_requests WHERE tenant_id = $1 AND user_id IN (${ph})
                      AND (employee_name LIKE $2 OR type LIKE $2 OR status LIKE $2 OR CAST(id AS CHAR) LIKE $2)
                    ORDER BY created_at DESC LIMIT 8`;
        leaveParams.push(...ids);
      }
      const leaves = await query(leaveSql, leaveParams);
      for (const l of leaves) {
        results.push({
          id: `leave-${l.id}`,
          category: 'Leave',
          title: `${l.employee_name} · ${l.type}`,
          subtitle: `${l.status} · ${l.start_date} → ${l.end_date}`,
          module: 'attendance',
          navigateTo: 'attendance',
        });
      }

      const holidays = await query(
        `SELECT id, name, holiday_date FROM holidays
         WHERE tenant_id = $1 AND active = 1 AND name LIKE $2
         ORDER BY holiday_date LIMIT 6`,
        [DEFAULT_TENANT, like],
      );
      for (const h of holidays) {
        results.push({
          id: `hol-${h.id}`,
          category: 'Holidays',
          title: String(h.name),
          subtitle: String(h.holiday_date),
          module: 'attendance',
          navigateTo: 'attendance',
        });
      }
    }

    if (hasAction(perms, 'employees', 'read') || hasAction(perms, 'settings', 'read')) {
      try {
        const docs = await query(
          `SELECT id, title, category FROM documents
           WHERE tenant_id = $1 AND (title LIKE $2 OR COALESCE(category,'') LIKE $2)
           ORDER BY created_at DESC LIMIT 6`,
          [DEFAULT_TENANT, like],
        );
        for (const d of docs) {
          results.push({
            id: `doc-${d.id}`,
            category: 'Documents',
            title: String(d.title),
            subtitle: String(d.category || 'document'),
            module: 'settings',
            navigateTo: 'settings',
          });
        }
      } catch {
        /* documents table may vary */
      }
    }

    // Module / navigation hints (always available to authenticated users with module read)
    const navHints: { label: string; module: string; keywords: string[] }[] = [
      { label: 'Dashboard', module: 'dashboard', keywords: ['dashboard', 'home', 'overview'] },
      { label: 'Employees', module: 'employees', keywords: ['employee', 'directory', 'staff'] },
      { label: 'Attendance & Leave', module: 'attendance', keywords: ['attendance', 'leave', 'timesheet', 'check-in'] },
      { label: 'Payroll', module: 'payroll', keywords: ['payroll', 'payslip', 'salary'] },
      { label: 'Settings', module: 'settings', keywords: ['settings', 'company', 'branding', 'holiday'] },
      { label: 'Notifications', module: 'notifications', keywords: ['notification', 'alert', 'approval'] },
    ];
    const ql = q.toLowerCase();
    for (const n of navHints) {
      if (!hasAction(perms, n.module, 'read')) continue;
      if (n.keywords.some((k) => k.includes(ql) || ql.includes(k))) {
        results.push({
          id: `nav-${n.module}`,
          category: 'Navigate',
          title: n.label,
          subtitle: `Open ${n.label}`,
          module: n.module,
          navigateTo: n.module,
        });
      }
    }
  } catch (e) {
    console.error('[search]', e);
    return res.status(500).json({ error: 'Search failed. Please try again.' });
  }

  const groups: Record<string, SearchHit[]> = {};
  for (const r of results) {
    (groups[r.category] ??= []).push(r);
  }

  res.json({ q, results, groups });
});

export default router;
