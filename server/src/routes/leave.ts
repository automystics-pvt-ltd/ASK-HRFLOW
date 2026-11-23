import { Router } from 'express';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { writeAudit } from '../lib/audit.js';
import { isoDate } from '../lib/dates.js';
import {
  calculateLeaveDays,
  getLeavePolicySettings,
  parseTypePolicy,
  upsertLeavePolicySettings,
} from '../lib/leave-policy.js';
import { getEmployeeManagerUserId, isManagerOf, teamUserIds } from '../lib/team.js';
import { createApprovalRequest } from './approvals.js';
import { runLeaveAutoApprove } from '../lib/leave-auto-approve.js';

const router = Router();

async function canManageLeaveTypes(userId: string, role: string) {
  return (
    (await userCan(userId, role, 'settings', 'update')) ||
    (await userCan(userId, role, 'attendance', 'update'))
  );
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

async function notifyLeaveDecision(userId: string, leaveId: number | string, status: string, comment: string) {
  const { createNotice } = await import('../lib/notices-helper.js');
  await createNotice({
    userId,
    title: `Leave ${status}`,
    body: `Your leave request #${leaveId} was ${status}. Reason: ${comment}`,
    kind: 'leave',
    id: `n-lvdec-${leaveId}-${status}`.slice(0, 32),
  });
}

router.get('/policy-settings', requireAuth, async (_req, res) => {
  const settings = await getLeavePolicySettings();
  res.json({ settings });
});

router.put('/policy-settings', requireAuth, async (req, res) => {
  if (!(await canManageLeaveTypes(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const b = req.body || {};
  const settings = await upsertLeavePolicySettings({
    autoApproveEnabled: b.autoApproveEnabled,
    autoApproveDays: b.autoApproveDays != null ? Number(b.autoApproveDays) : undefined,
    countWeekends: b.countWeekends,
    countHolidays: b.countHolidays,
    requireApprovalComment: b.requireApprovalComment,
  });
  const u = await ensureAppUser(req);
  if (u) await writeAudit(u.id, u.name, 'Leave policy', 'Updated leave policy settings');
  res.json({ settings });
});

router.post('/calculate-days', requireAuth, async (req, res) => {
  const { startDate, endDate, halfDay } = req.body || {};
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
  if (endDate < startDate) return res.status(400).json({ error: 'End date must be after start date' });
  const days = await calculateLeaveDays(startDate, endDate, { halfDay: Boolean(halfDay) });
  res.json({ days });
});

router.post('/run-auto-approve', requireAuth, async (req, res) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const result = await runLeaveAutoApprove();
  res.json(result);
});

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
      policy: parseTypePolicy(r.policy_json),
    })),
  });
});

router.post('/types', requireAuth, async (req, res) => {
  if (!(await canManageLeaveTypes(req.user!.sub, req.user!.role))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { code, name, defaultDays, carryForward, allowHalfDay, eligibilityNote, active, policy } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  const id = await insert(
    `INSERT INTO leave_types (tenant_id, code, name, default_days, active, carry_forward, allow_half_day, eligibility_note, policy_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      DEFAULT_TENANT,
      String(code).toLowerCase().replace(/\s+/g, '_'),
      name,
      Number(defaultDays) || 0,
      active === false ? 0 : 1,
      carryForward ? 1 : 0,
      allowHalfDay === false ? 0 : 1,
      eligibilityNote ?? null,
      policy ? JSON.stringify(policy) : null,
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
       eligibility_note = COALESCE($6, eligibility_note),
       policy_json = COALESCE($7, policy_json)
     WHERE id = $8`,
    [
      b.name ?? null,
      b.defaultDays !== undefined ? Number(b.defaultDays) : null,
      b.active === undefined ? null : b.active ? 1 : 0,
      b.carryForward === undefined ? null : b.carryForward ? 1 : 0,
      b.allowHalfDay === undefined ? null : b.allowHalfDay ? 1 : 0,
      b.eligibilityNote ?? null,
      b.policy !== undefined ? JSON.stringify(b.policy) : null,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

router.get('/summary', requireAuth, async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : req.user!.sub;
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  const isSelf = userId === req.user!.sub;
  const isMgr = req.user!.role === 'manager' && (await isManagerOf(req.user!.sub, userId));
  if (!isSelf && !canAll && !isMgr) return res.status(403).json({ error: 'Forbidden' });

  const year = Number(req.query.year) || new Date().getFullYear();
  const types = await query<{ id: number; code: string; name: string; default_days: string | number }>(
    'SELECT id, code, name, default_days FROM leave_types WHERE tenant_id = $1 AND active = 1',
    [DEFAULT_TENANT],
  );
  const balances = await query<{ leave_type_id: number; allocated: string | number; used: string | number }>(
    'SELECT leave_type_id, allocated, used FROM leave_balances WHERE tenant_id = $1 AND user_id = $2 AND year = $3',
    [DEFAULT_TENANT, userId, year],
  );
  const balMap = new Map(balances.map((b) => [Number(b.leave_type_id), b]));
  const requests = await query<{
    leave_type_id: number | null;
    type: string;
    days: string | number;
    status: string;
    start_date: Date | string;
  }>(
    `SELECT leave_type_id, type, days, status, start_date FROM leave_requests
     WHERE tenant_id = $1 AND user_id = $2 AND YEAR(start_date) = $3`,
    [DEFAULT_TENANT, userId, year],
  );

  const byType = types.map((t) => {
    const bal = balMap.get(t.id);
    const entitlement = Number(bal?.allocated ?? t.default_days);
    const taken = Number(bal?.used ?? 0);
    const typed = requests.filter(
      (r) => Number(r.leave_type_id) === t.id || String(r.type).toLowerCase() === t.name.toLowerCase(),
    );
    const approved = typed.filter((r) => r.status === 'Approved').reduce((s, r) => s + Number(r.days), 0);
    const pending = typed.filter((r) => r.status === 'Pending').reduce((s, r) => s + Number(r.days), 0);
    const rejected = typed.filter((r) => r.status === 'Rejected').reduce((s, r) => s + Number(r.days), 0);
    return {
      code: t.code,
      name: t.name,
      entitlement,
      taken,
      approved,
      pending,
      rejected,
      remaining: Math.max(0, entitlement - taken - pending),
    };
  });

  const monthly: Record<string, number> = {};
  const quarterly: Record<string, number> = {};
  for (const r of requests.filter((x) => x.status === 'Approved')) {
    const d = new Date(String(r.start_date));
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const q = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    monthly[m] = (monthly[m] || 0) + Number(r.days);
    quarterly[q] = (quarterly[q] || 0) + Number(r.days);
  }
  const annual = Object.values(monthly).reduce((s, n) => s + n, 0);
  res.json({ userId, year, byType, rollups: { monthly, quarterly, annual } });
});

router.get('/balances', requireAuth, async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : req.user!.sub;
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  const isSelf = userId === req.user!.sub;
  const isMgr = req.user!.role === 'manager' && (await isManagerOf(req.user!.sub, userId));
  if (!isSelf && !canAll && !isMgr) return res.status(403).json({ error: 'Forbidden' });

  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await query(
    `SELECT lb.*, lt.code, lt.name FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.tenant_id = $1 AND lb.user_id = $2 AND lb.year = $3`,
    [DEFAULT_TENANT, userId, year],
  );
  const balances: Record<string, { used: number; total: number; remaining: number }> = {};
  for (const r of rows) {
    const used = Number(r.used);
    const total = Number(r.allocated);
    balances[String(r.code)] = { used, total, remaining: total - used };
  }
  res.json({ balances, year });
});

router.get('/', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const canAll = await userCan(req.user!.sub, req.user!.role, 'attendance', 'approve');
  let rows;
  if (canAll && req.user!.role !== 'manager') {
    rows = await query('SELECT * FROM leave_requests WHERE tenant_id = $1 ORDER BY created_at DESC', [DEFAULT_TENANT]);
  } else if (req.user!.role === 'manager') {
    const team = await teamUserIds(req.user!.sub);
    if (team.length === 0) {
      rows = await query(
        'SELECT * FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC',
        [DEFAULT_TENANT, req.user!.sub],
      );
    } else {
      const placeholders = team.map((_, i) => `$${i + 3}`).join(',');
      rows = await query(
        `SELECT * FROM leave_requests WHERE tenant_id = $1 AND (user_id = $2 OR user_id IN (${placeholders}))
         ORDER BY created_at DESC`,
        [DEFAULT_TENANT, req.user!.sub, ...team],
      );
    }
  } else {
    rows = await query('SELECT * FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC', [
      DEFAULT_TENANT,
      req.user!.sub,
    ]);
  }

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
      halfDay: Boolean(Number(r.half_day ?? 0)),
      autoApproved: Boolean(Number(r.auto_approved ?? 0)),
    })),
  });
});

router.post('/', requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
  const { type, startDate, endDate, days, reason, leaveTypeCode, halfDay } = req.body || {};
  if (!type || !startDate || !endDate) return res.status(400).json({ error: 'Missing fields' });
  if (endDate < startDate) return res.status(400).json({ error: 'End date must be after start date' });

  // Always calculate server-side; ignore client days unless half-day
  const dayCount = await calculateLeaveDays(startDate, endDate, { halfDay: Boolean(halfDay) });
  void days; // client-supplied days intentionally ignored

  if (dayCount <= 0) return res.status(400).json({ error: 'No leave days in the selected range (check weekends/holidays)' });

  if (await overlaps(req.user!.sub, startDate, endDate)) {
    return res.status(409).json({ error: 'Leave dates overlap an existing request' });
  }

  const user = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
  const emp = await queryOne(
    'SELECT * FROM employees WHERE tenant_id = $1 AND user_id = $2 LIMIT 1',
    [DEFAULT_TENANT, req.user!.sub],
  );
  const code = leaveTypeCode || String(type).toLowerCase().replace(/\s+/g, '_');
  const lt = await queryOne('SELECT * FROM leave_types WHERE tenant_id = $1 AND code = $2', [DEFAULT_TENANT, code]);
  const policy = parseTypePolicy(lt?.policy_json);

  if (policy.maxConsecutiveDays != null && dayCount > Number(policy.maxConsecutiveDays)) {
    return res.status(400).json({ error: `Maximum consecutive leave is ${policy.maxConsecutiveDays} days` });
  }
  if (policy.minConsecutiveDays != null && dayCount < Number(policy.minConsecutiveDays) && !halfDay) {
    return res.status(400).json({ error: `Minimum leave duration is ${policy.minConsecutiveDays} days` });
  }
  if (policy.advanceNoticeDays != null && policy.advanceNoticeDays > 0) {
    const minStart = new Date();
    minStart.setDate(minStart.getDate() + Number(policy.advanceNoticeDays));
    if (new Date(startDate + 'T00:00') < minStart) {
      return res.status(400).json({ error: `Advance notice of ${policy.advanceNoticeDays} day(s) required` });
    }
  }
  if (policy.probationMonths != null && emp?.join_date) {
    const join = new Date(isoDate(emp.join_date as Date | string) + 'T00:00');
    const eligible = new Date(join);
    eligible.setMonth(eligible.getMonth() + Number(policy.probationMonths));
    if (new Date() < eligible) {
      return res.status(400).json({ error: 'Leave not available during probation period' });
    }
  }
  if (policy.departments?.length && emp && !policy.departments.includes(String(emp.department))) {
    return res.status(400).json({ error: 'This leave type is not available for your department' });
  }
  if (policy.designations?.length && emp) {
    const des = String(emp.designation || emp.position || '');
    if (!policy.designations.includes(des)) {
      return res.status(400).json({ error: 'This leave type is not available for your designation' });
    }
  }
  if (halfDay && lt && !Number(lt.allow_half_day ?? 1)) {
    return res.status(400).json({ error: 'Half-day leave is not allowed for this type' });
  }

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
    `INSERT INTO leave_requests (tenant_id, user_id, employee_name, leave_type_id, type, start_date, end_date, days, status, reason, half_day)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',$9,$10)`,
    [
      DEFAULT_TENANT,
      req.user!.sub,
      user?.name,
      lt?.id ?? null,
      type,
      startDate,
      endDate,
      dayCount,
      reason ?? '',
      halfDay ? 1 : 0,
    ],
  );

  let approvalRequestId: number | null = null;
  try {
    const managerId = await getEmployeeManagerUserId(req.user!.sub);
    approvalRequestId = await createApprovalRequest({
      moduleKey: 'leave',
      entityType: 'leave_request',
      entityId: id,
      requesterId: req.user!.sub,
      preferredApproverUserId: managerId || undefined,
      preferredApproverRole: managerId ? 'manager' : 'hr',
      payload: { type, startDate, endDate, days: dayCount, reason: reason ?? '', managerId },
    });
  } catch {
    // Approval tables may not be migrated yet — leave request still succeeds
  }

  // Notify reporting manager (preferred), else HR; always CC admins for tracking (deduped).
  const { notifyUserIds, activeUsersByRoles } = await import('../lib/notices-helper.js');
  const mgr = await getEmployeeManagerUserId(req.user!.sub);
  const recipients: string[] = [];
  if (mgr) recipients.push(mgr);
  else {
    const hrs = await activeUsersByRoles(['hr']);
    recipients.push(...hrs.map((u) => u.id));
  }
  const admins = await activeUsersByRoles(['admin']);
  recipients.push(...admins.map((u) => u.id));
  await notifyUserIds(
    recipients,
    'Leave request pending',
    `${user?.name ?? 'Employee'} requested ${dayCount} day(s) of ${type} (${startDate} → ${endDate}). Reason: ${reason || '—'}`,
    'leave',
    `n-lvreq-${id}`,
  );

  res.status(201).json({ id, days: dayCount, approvalRequestId });
});

router.post('/:id/approve', requireAuth, requirePermission('attendance', 'approve'), async (req, res) => {
  const { approve, comment } = req.body || {};
  // Comments are always mandatory for leave decisions (manager + admin override)
  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ error: 'Approval/rejection reason is mandatory' });
  }

  const row = await queryOne('SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'Pending') return res.status(400).json({ error: 'Request already decided' });
  if (row.user_id === req.user!.sub) return res.status(403).json({ error: 'Cannot approve your own leave' });

  // Managers: own team only. Admin/HR: org-wide override when managers fail to act.
  if (req.user!.role === 'manager') {
    const ok = await isManagerOf(req.user!.sub, String(row.user_id));
    if (!ok) return res.status(403).json({ error: 'Not your team member' });
  } else if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const reviewer = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
  const status = approve ? 'Approved' : 'Rejected';
  const reasonText = String(comment || '').trim();
  await query(`UPDATE leave_requests SET status = $1, comment = $2, decided_by = $3 WHERE id = $4`, [
    status,
    reasonText || null,
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

  const ar = await queryOne<{ id: number; current_step: number }>(
    `SELECT id, current_step FROM approval_requests
     WHERE tenant_id = $1 AND module_key = 'leave' AND entity_type = 'leave_request'
       AND entity_id = $2 AND status = 'pending' LIMIT 1`,
    [DEFAULT_TENANT, String(req.params.id)],
  );
  if (ar) {
    await query(
      `INSERT INTO approval_actions (request_id, step_order, actor_id, action, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [ar.id, ar.current_step, req.user!.sub, approve ? 'approve' : 'reject', reasonText],
    );
    await query(`UPDATE approval_requests SET status = $1, updated_at = NOW() WHERE id = $2`, [
      approve ? 'approved' : 'rejected',
      ar.id,
    ]);
  }

  await notifyLeaveDecision(String(row.user_id), req.params.id, status, reasonText || status);

  const u = await ensureAppUser(req);
  if (u) await writeAudit(u.id, u.name, 'Leave decision', `${status} leave #${req.params.id}: ${reasonText}`, String(req.params.id));
  res.json({ ok: true });
});

export default router;
