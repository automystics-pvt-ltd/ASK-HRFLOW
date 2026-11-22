import { Router } from 'express';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission, requireSelfOrPermission } from '../middleware/rbac.js';
import { hasAction } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';
import { isoDate } from '../lib/dates.js';

const router = Router();

function mapEmployee(row: Record<string, unknown>, hideSalary: boolean) {
  const skills = row.skills;
  let parsed: string[] = [];
  if (Array.isArray(skills)) parsed = skills.map(String);
  else if (skills) parsed = JSON.parse(String(skills));
  const join = isoDate(row.join_date);
  const base = {
    id: Number(row.id),
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    position: row.position,
    designation: row.designation ?? row.position,
    employmentType: row.employment_type ?? 'full_time',
    status: row.status,
    joinDate: join,
    join_date: join,
    location: row.location,
    country: row.country,
    avatar: row.avatar,
    manager: row.manager,
    managerUserId: row.manager_user_id ?? null,
    skills: parsed,
  };
  if (hideSalary) return { ...base, salary: null };
  return { ...base, salary: Number(row.salary) };
}

router.get('/', requireAuth, attachUser, requirePermission('employees', 'read'), async (req, res) => {
  const u = await ensureAppUser(req);
  const q = String(req.query.q || '').trim();
  const department = String(req.query.department || '').trim();
  const status = String(req.query.status || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const filters: string[] = ['tenant_id = $1'];
  const params: unknown[] = [DEFAULT_TENANT];
  let idx = 2;
  // Managers only see their direct reports
  if (req.user!.role === 'manager') {
    filters.push(`manager_user_id = $${idx++}`);
    params.push(req.user!.sub);
  }
  if (q) {
    filters.push(`(name LIKE $${idx} OR email LIKE $${idx} OR department LIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (department && department !== 'All') {
    filters.push(`department = $${idx++}`);
    params.push(department);
  }
  if (status && status !== 'All') {
    filters.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = filters.join(' AND ');
  const rows = await query(`SELECT * FROM employees WHERE ${where} ORDER BY name LIMIT $${idx} OFFSET $${idx + 1}`, [
    ...params,
    limit,
    offset,
  ]);
  const [countRow] = await query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM employees WHERE ${where}`,
    params,
  );

  const canSeeAllSalary = u && hasAction(u.permissions ?? {}, 'employees', 'update');
  const hideOthersSalary = !canSeeAllSalary;

  res.json({
    employees: rows.map((r) => mapEmployee(r, hideOthersSalary && r.user_id !== req.user!.sub)),
    page,
    total: Number(countRow?.count ?? 0),
  });
});

router.get('/:id', requireAuth, attachUser, requireSelfOrPermission('employees', 'read'), async (req, res) => {
  const row = await queryOne('SELECT * FROM employees WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const u = await ensureAppUser(req);
  const hideSalary = row.user_id !== req.user!.sub && !hasAction(u?.permissions ?? {}, 'employees', 'update');
  res.json({ employee: mapEmployee(row, hideSalary) });
});

router.post('/', requireAuth, attachUser, requirePermission('employees', 'create'), async (req, res) => {
  const e = req.body || {};
  const email = String(e.email || '').trim().toLowerCase();
  const dup = await queryOne('SELECT id FROM employees WHERE tenant_id = $1 AND LOWER(email) = $2', [DEFAULT_TENANT, email]);
  if (dup) return res.status(409).json({ error: 'Employee with this email already exists' });

  const id = await insert(
    `INSERT INTO employees (tenant_id, user_id, name, email, phone, department, position, status, join_date, salary, location, country, avatar, manager, skills, manager_user_id, designation, employment_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      DEFAULT_TENANT,
      e.userId ?? null,
      e.name,
      email,
      e.phone ?? null,
      e.department,
      e.position,
      e.status ?? 'Active',
      e.joinDate ?? e.join_date ?? new Date().toISOString().slice(0, 10),
      e.salary ?? 0,
      e.location ?? null,
      e.country ?? null,
      e.avatar ?? null,
      e.manager ?? null,
      JSON.stringify(e.skills ?? []),
      e.managerUserId ?? e.manager_user_id ?? null,
      e.designation ?? e.position ?? null,
      e.employmentType ?? e.employment_type ?? 'full_time',
    ],
  );
  const u = await ensureAppUser(req);
  if (u) await writeAudit(u.id, u.name, 'Employee created', `Created employee ${e.name}`, String(id));
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, attachUser, requirePermission('employees', 'update'), async (req, res) => {
  const e = req.body || {};
  const email = String(e.email || '').trim().toLowerCase();
  const dup = await queryOne('SELECT id FROM employees WHERE tenant_id = $1 AND LOWER(email) = $2 AND id <> $3', [
    DEFAULT_TENANT,
    email,
    req.params.id,
  ]);
  if (dup) return res.status(409).json({ error: 'Employee with this email already exists' });

  await query(
    `UPDATE employees SET name=$1, email=$2, phone=$3, department=$4, position=$5, status=$6, salary=$7, location=$8, country=$9, manager=$10,
       manager_user_id=COALESCE($11, manager_user_id), designation=COALESCE($12, designation), employment_type=COALESCE($13, employment_type)
     WHERE id=$14 AND tenant_id=$15`,
    [
      e.name,
      email,
      e.phone,
      e.department,
      e.position,
      e.status,
      e.salary,
      e.location,
      e.country,
      e.manager,
      e.managerUserId ?? e.manager_user_id ?? null,
      e.designation ?? null,
      e.employmentType ?? e.employment_type ?? null,
      req.params.id,
      DEFAULT_TENANT,
    ],
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requirePermission('employees', 'delete'), async (req, res) => {
  await query('DELETE FROM employees WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  res.json({ ok: true });
});

export default router;
