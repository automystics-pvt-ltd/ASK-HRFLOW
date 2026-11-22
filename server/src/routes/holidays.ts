import { Router } from 'express';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { isoDate } from '../lib/dates.js';

const router = Router();

async function canManageHolidays(userId: string, role: string) {
  return (
    (await userCan(userId, role, 'settings', 'update')) ||
    (await userCan(userId, role, 'attendance', 'update'))
  );
}

function mapHoliday(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    holidayDate: isoDate(r.holiday_date as Date | string),
    kind: r.kind,
    location: r.location,
    employeeGroup: r.employee_group,
    active: Boolean(Number(r.active)),
    createdAt: r.created_at,
  };
}

router.get('/', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  let rows;
  if (year && Number.isFinite(year)) {
    rows = await query(
      `SELECT * FROM holidays WHERE tenant_id = $1 AND YEAR(holiday_date) = $2 ORDER BY holiday_date`,
      [DEFAULT_TENANT, year],
    );
  } else {
    rows = await query(`SELECT * FROM holidays WHERE tenant_id = $1 ORDER BY holiday_date`, [DEFAULT_TENANT]);
  }
  res.json({ holidays: rows.map((r) => mapHoliday(r as Record<string, unknown>)) });
});

router.post('/', requireAuth, async (req, res) => {
  if (!(await canManageHolidays(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, holidayDate, kind, location, employeeGroup, active } = req.body || {};
  if (!name || !holidayDate) return res.status(400).json({ error: 'name and holidayDate required' });
  const id = await insert(
    `INSERT INTO holidays (tenant_id, name, holiday_date, kind, location, employee_group, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      DEFAULT_TENANT,
      name,
      holidayDate,
      kind || 'public',
      location ?? null,
      employeeGroup ?? null,
      active === false ? 0 : 1,
    ],
  );
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, async (req, res) => {
  if (!(await canManageHolidays(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const row = await queryOne('SELECT id FROM holidays WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await query(
    `UPDATE holidays SET
       name = COALESCE($1, name),
       holiday_date = COALESCE($2, holiday_date),
       kind = COALESCE($3, kind),
       location = COALESCE($4, location),
       employee_group = COALESCE($5, employee_group),
       active = COALESCE($6, active)
     WHERE id = $7`,
    [
      b.name ?? null,
      b.holidayDate ?? null,
      b.kind ?? null,
      b.location ?? null,
      b.employeeGroup ?? null,
      b.active === undefined ? null : b.active ? 1 : 0,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!(await canManageHolidays(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await query('DELETE FROM holidays WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  res.json({ ok: true });
});

export default router;
