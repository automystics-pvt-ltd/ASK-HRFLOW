import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isoDate } from '../lib/dates.js';
import { canViewEmployeeActivity } from '../lib/team.js';

const router = Router();

router.get('/employee/:userId', requireAuth, async (req, res) => {
  const targetUserId = String(req.params.userId);
  const allowed = await canViewEmployeeActivity(req.user!.sub, req.user!.role, targetUserId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const year = Number(req.query.year) || new Date().getFullYear();
  const user = await queryOne<{ id: string; name: string; email: string; department: string }>(
    'SELECT id, name, email, department FROM users WHERE id = $1',
    [targetUserId],
  );

  const [attendance, leave, timesheets, claims, approvals, balanceRows] = await Promise.all([
    query(
      `SELECT work_date, check_in, check_out, status, hours, location, location_address
       FROM attendance_days WHERE tenant_id = $1 AND user_id = $2 ORDER BY work_date DESC LIMIT 90`,
      [DEFAULT_TENANT, targetUserId],
    ),
    query(
      `SELECT id, type, start_date, end_date, days, status, reason, comment
       FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50`,
      [DEFAULT_TENANT, targetUserId],
    ),
    query(
      `SELECT id, week_start, status, total_hours FROM timesheets
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY week_start DESC LIMIT 26`,
      [DEFAULT_TENANT, targetUserId],
    ),
    query(
      `SELECT c.id, c.amount, c.expense_date, c.status, c.description, cat.name AS category_name
       FROM expense_claims c
       LEFT JOIN expense_categories cat ON cat.id = c.category_id
       WHERE c.tenant_id = $1 AND c.user_id = $2 ORDER BY c.created_at DESC LIMIT 50`,
      [DEFAULT_TENANT, targetUserId],
    ),
    query(
      `SELECT ar.id, ar.module_key, ar.entity_type, ar.entity_id, ar.status, ar.created_at
       FROM approval_requests ar
       WHERE ar.tenant_id = $1 AND ar.requester_id = $2 ORDER BY ar.created_at DESC LIMIT 50`,
      [DEFAULT_TENANT, targetUserId],
    ),
    query(
      `SELECT lb.allocated, lb.used, lt.code, lt.name
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.tenant_id = $1 AND lb.user_id = $2 AND lb.year = $3`,
      [DEFAULT_TENANT, targetUserId, year],
    ),
  ]);

  const balances = balanceRows.map((b) => ({
    code: b.code,
    type: b.name,
    allocated: Number(b.allocated),
    used: Number(b.used),
    remaining: Number(b.allocated) - Number(b.used),
  }));

  const yearLeave = leave.filter((r) => new Date(String(r.start_date)).getFullYear() === year);
  const entitlement = balances.reduce((s, b) => s + b.allocated, 0);
  const used = balances.reduce((s, b) => s + b.used, 0);
  const pending = yearLeave
    .filter((r) => r.status === 'Pending')
    .reduce((s, r) => s + Number(r.days), 0);

  res.json({
    userId: targetUserId,
    user,
    year,
    leaveStats: {
      entitlement,
      used,
      remaining: Math.max(0, entitlement - used),
      pending,
    },
    balances,
    attendance: attendance.map((r) => ({
      date: isoDate(r.work_date as Date | string),
      checkIn: r.check_in,
      checkOut: r.check_out,
      status: r.status,
      hours: r.hours != null ? Number(r.hours) : null,
      location: r.location,
      locationAddress: r.location_address,
    })),
    leave: leave.map((r) => ({
      id: r.id,
      type: r.type,
      startDate: isoDate(r.start_date as Date | string),
      endDate: isoDate(r.end_date as Date | string),
      days: Number(r.days),
      status: r.status,
      reason: r.reason,
      comment: r.comment,
    })),
    timesheets: timesheets.map((r) => ({
      id: r.id,
      weekStart: isoDate(r.week_start as Date | string),
      status: r.status,
      totalHours: r.total_hours != null ? Number(r.total_hours) : null,
    })),
    claims: claims.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      expenseDate: isoDate(r.expense_date as Date | string),
      status: r.status,
      description: r.description,
      categoryName: r.category_name,
    })),
    approvals: approvals.map((r) => ({
      id: r.id,
      moduleKey: r.module_key,
      entityType: r.entity_type,
      entityId: r.entity_id,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
});

router.get('/report', requireAuth, async (req, res) => {
  const role = req.user!.role;
  if (!['admin', 'hr', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const department = req.query.department ? String(req.query.department) : null;
  const managerId = req.query.manager
    ? String(req.query.manager)
    : req.query.managerId
      ? String(req.query.managerId)
      : null;
  const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? String(req.query.dateTo) : null;
  const year = new Date().getFullYear();

  let empFilter = 'WHERE e.tenant_id = $1';
  const params: unknown[] = [DEFAULT_TENANT];
  let i = 2;

  if (role === 'manager') {
    empFilter += ` AND e.manager_user_id = $${i++}`;
    params.push(req.user!.sub);
  } else if (managerId) {
    empFilter += ` AND e.manager_user_id = $${i++}`;
    params.push(managerId);
  }
  if (department) {
    empFilter += ` AND e.department = $${i++}`;
    params.push(department);
  }

  const employees = await query(
    `SELECT e.id, e.user_id, e.name, e.department, e.position, e.manager_user_id, e.status
     FROM employees e ${empFilter} ORDER BY e.name`,
    params,
  );

  const report = [];
  for (const e of employees) {
    if (!e.user_id) {
      report.push({
        employeeId: e.id,
        userId: null,
        name: e.name,
        department: e.department,
        position: e.position,
        status: e.status,
        leaveAllocated: 0,
        leaveUsed: 0,
        leaveRemaining: 0,
        pendingLeave: 0,
        attendanceDays: 0,
        claimsCount: 0,
        claimsAmount: 0,
      });
      continue;
    }
    const uid = String(e.user_id);
    const bal = await queryOne<{ allocated: string | number; used: string | number }>(
      `SELECT COALESCE(SUM(allocated),0) AS allocated, COALESCE(SUM(used),0) AS used
       FROM leave_balances WHERE tenant_id = $1 AND user_id = $2 AND year = $3`,
      [DEFAULT_TENANT, uid, year],
    );
    let leaveSql = `SELECT COALESCE(SUM(days),0) AS s FROM leave_requests
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'Pending'`;
    const leaveParams: unknown[] = [DEFAULT_TENANT, uid];
    if (dateFrom) {
      leaveSql += ` AND start_date >= $${leaveParams.length + 1}`;
      leaveParams.push(dateFrom);
    }
    if (dateTo) {
      leaveSql += ` AND end_date <= $${leaveParams.length + 1}`;
      leaveParams.push(dateTo);
    }
    const pending = await queryOne<{ s: string | number }>(leaveSql, leaveParams);

    let attSql = `SELECT COUNT(*) AS c FROM attendance_days WHERE tenant_id = $1 AND user_id = $2`;
    const attParams: unknown[] = [DEFAULT_TENANT, uid];
    if (dateFrom) {
      attSql += ` AND work_date >= $${attParams.length + 1}`;
      attParams.push(dateFrom);
    }
    if (dateTo) {
      attSql += ` AND work_date <= $${attParams.length + 1}`;
      attParams.push(dateTo);
    }
    const att = await queryOne<{ c: string | number }>(attSql, attParams);

    let claimSql = `SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS amt FROM expense_claims
      WHERE tenant_id = $1 AND user_id = $2`;
    const claimParams: unknown[] = [DEFAULT_TENANT, uid];
    if (dateFrom) {
      claimSql += ` AND expense_date >= $${claimParams.length + 1}`;
      claimParams.push(dateFrom);
    }
    if (dateTo) {
      claimSql += ` AND expense_date <= $${claimParams.length + 1}`;
      claimParams.push(dateTo);
    }
    const claims = await queryOne<{ c: string | number; amt: string | number }>(claimSql, claimParams);

    const allocated = Number(bal?.allocated || 0);
    const used = Number(bal?.used || 0);
    report.push({
      employeeId: e.id,
      userId: uid,
      name: e.name,
      department: e.department,
      position: e.position,
      status: e.status,
      managerUserId: e.manager_user_id,
      leaveAllocated: allocated,
      leaveUsed: used,
      leaveRemaining: Math.max(0, allocated - used),
      pendingLeave: Number(pending?.s || 0),
      attendanceDays: Number(att?.c || 0),
      claimsCount: Number(claims?.c || 0),
      claimsAmount: Number(claims?.amt || 0),
    });
  }

  res.json({
    filters: { department, manager: managerId, dateFrom, dateTo },
    report,
    employees: employees.map((e) => ({
      id: e.id,
      userId: e.user_id,
      name: e.name,
      department: e.department,
      position: e.position,
      managerUserId: e.manager_user_id,
      status: e.status,
    })),
  });
});

export default router;
