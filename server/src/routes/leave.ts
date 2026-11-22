import { Router } from 'express';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { writeAudit } from '../lib/audit.js';
import { isoDate } from '../lib/dates.js';
import { workingDaysBetween } from '../lib/working-days.js';
import { createApprovalRequest } from './approvals.js';

const router = Router();

async function canManageLeaveTypes(userId: string, role: string) {
  return (
    (await userCan(userId, role, 'settings', 'update')) ||
    (await userCan(userId, role, 'attendance', 'update'))
  );
}

function parseDays(start: string, end: string, explicit?: number) {
  if (explicit && explicit > 0) return explicit;
  return workingDaysBetween(start, end);
}

async function overlaps(userId: string, start: string, end: string, excludeId?: number) {
  const row = await queryOne(
    `SELECT id FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 AND status IN ('Pending','Approved')
     AND NOT (end_date < $3 OR start_date > $4)
     ${excludeId ? 'AND id <> $5' : ''} LIMIT 1`,
    excludeId ? [DEFAULT_TENANT, userId, start, end, excludeId] : [DEFAULT_TENANT, userId, start, end],
  );
  return Boolean(row);
}

router.get('/types', requireAuth, async (req, res) => {
  const admin = await canManageLeaveTypes(req.user!.sub, req.user!.role);
  const rows = admin
    ? await query('SELECT * FROM leave_types WHERE tenant_id = $1 ORDER BY name', [DEFAULT_TENANT])
    : await query('SELECT * FROM leave_types WHERE tenant_id = $1 AND active = 1 ORDER BY name', [DEFAULT_TENANT]);
  res.json({
    types: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      defaultDays: Number(r.default_days),
      active: Boolean(Number(r.active)),
      carryForward: Boolean(Number(r.carry_forward ?? 0)),
      allowHalfDay: Boolean(Number(r.allow_half_day ?? 1)),
      eligibilityNote: r.eligibility_note ?? null,
    })),
  });
});

router.post('/types', requireAuth, async (req, res) => {
  if (!(await canManageLeaveTypes(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { code, name, defaultDays, carryForward, allowHalfDay, eligibilityNote, active } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  const id = await insert(
    `INSERT INTO leave_types (tenant_id, code, name, default_days, active, carry_forward, allow_half_day, eligibility_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      DEFAULT_TENANT,
      String(code).toLowerCase().replace(/\s+/g, '_'),
      name,
      Number(defaultDays) || 0,
      active === false ? 0 : 1,
      carryForward ? 1 : 0,
      allowHalfDay === false ? 0 : 1,
      eligibilityNote ?? null,
    ],
  );
  res.status(201).json({ id });
});

router.put('/types/:id', requireAuth, async (req, res) => {
  if (!(await canManageLeaveTypes(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const row = await queryOne('SELECT id FROM leave_types WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await query(
    `UPDATE leave_types SET
       name = COALESCE($1, name),
       default_days = COALESCE($2, default_days),
       active = COALESCE($3, active),
       carry_forward = COALESCE($4, carry_forward),
       allow_half_day = COALESCE($5, allow_half_day),
       eligibility_note = COALESCE($6, eligibility_note)
     WHERE id = $7`,
    [
      b.name ?? null,
      b.defaultDays !== undefined ? Number(b.defaultDays) : null,
      b.active === undefined ? null : b.active ? 1 : 0,
      b.carryForward === undefined ? null : b.carryForward ? 1 : 0,
      b.allowHalfDay === undefined ? null : b.allowHalfDay ? 1 : 0,
      b.eligibilityNote ?? null,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

router.get('/balances', requireAuth, async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : req.user!.sub;
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  if (userId !== req.user!.sub && !canAll) return res.status(403).json({ error: 'Forbidden' });

  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await query(
    `SELECT lb.*, lt.code, lt.name FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.tenant_id = $1 AND lb.user_id = $2 AND lb.year = $3`,
    [DEFAULT_TENANT, userId, year],
  );
  const balances: Record<string, { used: number; total: number }> = {};
  for (const r of rows) {
    balances[String(r.code)] = { used: Number(r.used), total: Number(r.allocated) };
  }
  res.json({ balances, year });
});

router.get('/', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  const rows = canAll
    ? await query('SELECT * FROM leave_requests WHERE tenant_id = $1 ORDER BY created_at DESC', [DEFAULT_TENANT])
    : await query('SELECT * FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC', [
        DEFAULT_TENANT,
        req.user!.sub,
      ]);

  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      employee: r.employee_name,
      type: r.type,
      startDate: isoDate(r.start_date),
      endDate: isoDate(r.end_date),
      days: Number(r.days),
      status: r.status,
      reason: r.reason,
      comment: r.comment,
      decidedBy: r.decided_by,
    })),
  });
});

router.post('/', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const { type, startDate, endDate, days, reason, leaveTypeCode } = req.body || {};
  if (!type || !startDate || !endDate) return res.status(400).json({ error: 'Missing fields' });
  if (endDate < startDate) return res.status(400).json({ error: 'End date must be after start date' });

  const dayCount = parseDays(startDate, endDate, days);
  if (await overlaps(req.user!.sub, startDate, endDate)) {
    return res.status(409).json({ error: 'Leave dates overlap an existing request' });
  }

  const user = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
  const code = leaveTypeCode || String(type).toLowerCase().replace(/\s+/g, '_');
  const lt = await queryOne<{ id: number }>('SELECT id FROM leave_types WHERE tenant_id = $1 AND code = $2', [
    DEFAULT_TENANT,
    code,
  ]);

  if (lt) {
    const year = new Date(startDate).getFullYear();
    const bal = await queryOne<{ allocated: string | number; used: string | number }>(
      'SELECT allocated, used FROM leave_balances WHERE tenant_id = $1 AND user_id = $2 AND leave_type_id = $3 AND year = $4',
      [DEFAULT_TENANT, req.user!.sub, lt.id, year],
    );
    if (bal && Number(bal.used) + dayCount > Number(bal.allocated)) {
      return res.status(400).json({ error: 'Insufficient leave balance' });
    }
  }

  const id = await insert(
    `INSERT INTO leave_requests (tenant_id, user_id, employee_name, leave_type_id, type, start_date, end_date, days, status, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',$9)`,
    [DEFAULT_TENANT, req.user!.sub, user?.name, lt?.id ?? null, type, startDate, endDate, dayCount, reason ?? ''],
  );

  let approvalRequestId: number | null = null;
  try {
    approvalRequestId = await createApprovalRequest({
      moduleKey: 'leave',
      entityType: 'leave_request',
      entityId: id,
      requesterId: req.user!.sub,
      payload: { type, startDate, endDate, days: dayCount, reason: reason ?? '' },
    });
  } catch {
    // Approval tables may not be migrated yet — leave request still succeeds
  }

  res.status(201).json({ id, approvalRequestId });
});

router.post('/:id/approve', requireAuth, requirePermission('attendance', 'approve'), async (req, res) => {
  const { approve, comment } = req.body || {};
  const row = await queryOne('SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'Pending') return res.status(400).json({ error: 'Request already decided' });

  const reviewer = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
  const status = approve ? 'Approved' : 'Rejected';
  await query(`UPDATE leave_requests SET status = $1, comment = $2, decided_by = $3 WHERE id = $4`, [
    status,
    comment ?? null,
    reviewer?.name,
    req.params.id,
  ]);

  if (approve && row.leave_type_id) {
    const year = new Date(String(row.start_date)).getFullYear();
    await query(
      `UPDATE leave_balances SET used = used + $1
       WHERE tenant_id = $2 AND user_id = $3 AND leave_type_id = $4 AND year = $5`,
      [row.days, DEFAULT_TENANT, row.user_id, row.leave_type_id, year],
    );
  }

  // Keep approval workflow inbox in sync when leave is decided from Attendance UI
  await query(
    `UPDATE approval_requests
     SET status = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND module_key = 'leave' AND entity_type = 'leave_request'
       AND entity_id = $3 AND status = 'pending'`,
    [approve ? 'approved' : 'rejected', DEFAULT_TENANT, String(req.params.id)],
  );

  const u = await ensureAppUser(req);
  if (u) await writeAudit(u.id, u.name, 'Leave decision', `${status} leave #${req.params.id}`, String(req.params.id));
  res.json({ ok: true });
});

export default router;
