import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';

const router = Router();

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

router.get('/', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  const rows = canAll
    ? await query('SELECT * FROM timesheets WHERE tenant_id = $1 ORDER BY week_start DESC', [DEFAULT_TENANT])
    : await query('SELECT * FROM timesheets WHERE tenant_id = $1 AND user_id = $2 ORDER BY week_start DESC', [
        DEFAULT_TENANT,
        req.user!.sub,
      ]);
  res.json({ timesheets: rows });
});

router.get('/:id', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const sheet = await queryOne('SELECT * FROM timesheets WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  if (!sheet) return res.status(404).json({ error: 'Not found' });
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  if (sheet.user_id !== req.user!.sub && !canAll) return res.status(403).json({ error: 'Forbidden' });
  const entries = await query('SELECT * FROM timesheet_entries WHERE timesheet_id = $1 ORDER BY work_date', [req.params.id]);
  res.json({ timesheet: sheet, entries });
});

router.post('/', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const ws = req.body.weekStart || weekStart();
  const rows = await query<{ id: number }>(
    `INSERT INTO timesheets (tenant_id, user_id, week_start, status)
     VALUES ($1,$2,$3,'draft')
     ON CONFLICT (tenant_id, user_id, week_start) DO UPDATE SET status = timesheets.status
     RETURNING id`,
    [DEFAULT_TENANT, req.user!.sub, ws],
  );
  res.status(201).json({ id: rows[0].id });
});

router.post('/:id/entries', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const sheet = await queryOne('SELECT * FROM timesheets WHERE id = $1', [req.params.id]);
  if (!sheet || sheet.user_id !== req.user!.sub) return res.status(404).json({ error: 'Not found' });
  if (['submitted', 'approved', 'locked'].includes(sheet.status)) return res.status(400).json({ error: 'Timesheet is locked' });

  const { workDate, hours, notes } = req.body || {};
  await query(
    `INSERT INTO timesheet_entries (tenant_id, timesheet_id, work_date, hours, notes)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (timesheet_id, work_date) DO UPDATE SET hours = EXCLUDED.hours, notes = EXCLUDED.notes`,
    [DEFAULT_TENANT, req.params.id, workDate, hours ?? 0, notes ?? null],
  );
  const [{ total }] = await query<{ total: string }>(
    'SELECT COALESCE(SUM(hours),0)::text AS total FROM timesheet_entries WHERE timesheet_id = $1',
    [req.params.id],
  );
  await query('UPDATE timesheets SET total_hours = $1 WHERE id = $2', [total, req.params.id]);
  res.json({ ok: true, totalHours: Number(total) });
});

router.post('/:id/submit', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const sheet = await queryOne('SELECT * FROM timesheets WHERE id = $1', [req.params.id]);
  if (!sheet || sheet.user_id !== req.user!.sub) return res.status(404).json({ error: 'Not found' });
  await query(`UPDATE timesheets SET status = 'submitted', submitted_at = NOW() WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/approve', requireAuth, requirePermission('attendance', 'approve'), async (req, res) => {
  const { approve, comment } = req.body || {};
  await query(
    `UPDATE timesheets SET status = $1::timesheet_status, reviewed_by = $2, reviewed_at = NOW(), review_comment = $3 WHERE id = $4`,
    [approve ? 'approved' : 'rejected', req.user!.sub, comment ?? null, req.params.id],
  );
  res.json({ ok: true });
});

router.post('/:id/lock', requireAuth, requirePermission('attendance', 'approve'), async (req, res) => {
  await query(`UPDATE timesheets SET status = 'locked' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;