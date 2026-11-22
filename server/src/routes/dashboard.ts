import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.get('/stats', requireAuth, requirePermission('dashboard', 'read'), async (_req, res) => {
  const [emp] = await query<{ total: string; active: string; on_leave: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'Active')::text AS active,
            COUNT(*) FILTER (WHERE status = 'On Leave')::text AS on_leave
     FROM employees WHERE tenant_id = $1`,
    [DEFAULT_TENANT],
  );

  const [leave] = await query<{ pending: string }>(
    `SELECT COUNT(*)::text AS pending FROM leave_requests WHERE tenant_id = $1 AND status = 'Pending'`,
    [DEFAULT_TENANT],
  );

  const [ts] = await query<{ pending: string }>(
    `SELECT COUNT(*)::text AS pending FROM timesheets WHERE tenant_id = $1 AND status = 'submitted'`,
    [DEFAULT_TENANT],
  );

  const [att] = await query<{ rate: string }>(
    `SELECT CASE WHEN COUNT(*) = 0 THEN '0'
            ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('Present','In Progress')) / COUNT(*), 1)::text END AS rate
     FROM attendance_days
     WHERE tenant_id = $1 AND work_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [DEFAULT_TENANT],
  );

  const [payroll] = await query<{ monthly: string }>(
    `SELECT COALESCE(SUM(salary) FILTER (WHERE status = 'Active'), 0)::text AS monthly FROM employees WHERE tenant_id = $1`,
    [DEFAULT_TENANT],
  );

  const [newHires] = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM employees WHERE tenant_id = $1 AND join_date >= CURRENT_DATE - INTERVAL '30 days'`,
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