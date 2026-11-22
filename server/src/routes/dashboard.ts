import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.get('/stats', requireAuth, requirePermission('dashboard', 'read'), async (_req, res) => {
  const [emp] = await query<{ total: number | string; active: number | string; on_leave: number | string }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) AS on_leave
     FROM employees WHERE tenant_id = $1`,
    [DEFAULT_TENANT],
  );

  const [leave] = await query<{ pending: number | string }>(
    `SELECT COUNT(*) AS pending FROM leave_requests WHERE tenant_id = $1 AND status = 'Pending'`,
    [DEFAULT_TENANT],
  );

  const [ts] = await query<{ pending: number | string }>(
    `SELECT COUNT(*) AS pending FROM timesheets WHERE tenant_id = $1 AND status = 'submitted'`,
    [DEFAULT_TENANT],
  );

  const [att] = await query<{ rate: number | string }>(
    `SELECT CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(100.0 * SUM(CASE WHEN status IN ('Present','In Progress') THEN 1 ELSE 0 END) / COUNT(*), 1) END AS rate
     FROM attendance_days
     WHERE tenant_id = $1 AND work_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [DEFAULT_TENANT],
  );

  const [payroll] = await query<{ monthly: number | string }>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN salary ELSE 0 END), 0) AS monthly FROM employees WHERE tenant_id = $1`,
    [DEFAULT_TENANT],
  );

  const [newHires] = await query<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM employees WHERE tenant_id = $1 AND join_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [DEFAULT_TENANT],
  );

  res.json({
    stats: {
      totalEmployees: Number(emp?.total ?? 0),
      activeEmployees: Number(emp?.active ?? 0),
      onLeave: Number(emp?.on_leave ?? 0),
      pendingLeave: Number(leave?.pending ?? 0),
      pendingTimesheets: Number(ts?.pending ?? 0),
      attendanceRate: Number(att?.rate ?? 0),
      monthlyPayroll: Number(payroll?.monthly ?? 0),
      newHires: Number(newHires?.c ?? 0),
    },
  });
});

export default router;
