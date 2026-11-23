import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getReportingCurrency } from '../lib/org-settings.js';

const router = Router();

router.get('/stats', requireAuth, requirePermission('dashboard', 'read'), async (req, res) => {
  const role = req.user!.role;
  const userId = req.user!.sub;

  const empFilters = ['tenant_id = $1'];
  const empParams: unknown[] = [DEFAULT_TENANT];
  if (role === 'manager') {
    empFilters.push('manager_user_id = $2');
    empParams.push(userId);
  } else if (role === 'employee') {
    empFilters.push('user_id = $2');
    empParams.push(userId);
  }
  const empWhere = empFilters.join(' AND ');

  const [emp] = await query<{ total: number | string; active: number | string; on_leave: number | string }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) AS on_leave
     FROM employees WHERE ${empWhere}`,
    empParams,
  );

  let leaveSql = `SELECT COUNT(*) AS pending FROM leave_requests WHERE tenant_id = $1 AND status = 'Pending'`;
  const leaveParams: unknown[] = [DEFAULT_TENANT];
  if (role === 'employee') {
    leaveSql += ` AND user_id = $2`;
    leaveParams.push(userId);
  } else if (role === 'manager') {
    leaveSql = `SELECT COUNT(*) AS pending FROM leave_requests lr
      JOIN employees e ON e.user_id = lr.user_id AND e.tenant_id = lr.tenant_id
      WHERE lr.tenant_id = $1 AND lr.status = 'Pending' AND e.manager_user_id = $2`;
    leaveParams.push(userId);
  }
  const [leave] = await query<{ pending: number | string }>(leaveSql, leaveParams);

  const [ts] = await query<{ pending: number | string }>(
    `SELECT COUNT(*) AS pending FROM timesheets WHERE tenant_id = $1 AND status = 'submitted'`,
    [DEFAULT_TENANT],
  );

  // Payroll aggregates are confidential — Admin/HR see team/company totals; employees see own; managers never.
  let monthlyPayroll: number | null = null;
  if (role === 'admin' || role === 'hr' || role === 'employee') {
    const [payroll] = await query<{ monthly: number | string }>(
      `SELECT COALESCE(SUM(CASE WHEN status = 'Active' THEN salary / 12 ELSE 0 END), 0) AS monthly
       FROM employees WHERE ${empWhere}`,
      empParams,
    );
    monthlyPayroll = Math.round(Number(payroll?.monthly ?? 0));
  }

  const hireFilters = [...empFilters, 'join_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'];
  const [newHires] = await query<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM employees WHERE ${hireFilters.join(' AND ')}`,
    empParams,
  );

  // Scope attendance KPIs for managers to their reports
  let presentSql = `SELECT COUNT(*) AS c FROM attendance_days ad
    WHERE ad.tenant_id = $1 AND ad.work_date = CURDATE() AND ad.status IN ('Present','In Progress')`;
  const presentParams: unknown[] = [DEFAULT_TENANT];
  let attSql = `SELECT CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(100.0 * SUM(CASE WHEN status IN ('Present','In Progress') THEN 1 ELSE 0 END) / COUNT(*), 1) END AS rate
     FROM attendance_days
     WHERE tenant_id = $1 AND work_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
  const attParams: unknown[] = [DEFAULT_TENANT];
  if (role === 'manager') {
    presentSql = `SELECT COUNT(*) AS c FROM attendance_days ad
      JOIN employees e ON e.user_id = ad.user_id AND e.tenant_id = ad.tenant_id
      WHERE ad.tenant_id = $1 AND ad.work_date = CURDATE() AND ad.status IN ('Present','In Progress')
        AND e.manager_user_id = $2`;
    presentParams.push(userId);
    attSql = `SELECT CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(100.0 * SUM(CASE WHEN ad.status IN ('Present','In Progress') THEN 1 ELSE 0 END) / COUNT(*), 1) END AS rate
     FROM attendance_days ad
     JOIN employees e ON e.user_id = ad.user_id AND e.tenant_id = ad.tenant_id
     WHERE ad.tenant_id = $1 AND ad.work_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       AND e.manager_user_id = $2`;
    attParams.push(userId);
  } else if (role === 'employee') {
    presentSql += ` AND ad.user_id = $2`;
    presentParams.push(userId);
    attSql += ` AND user_id = $2`;
    attParams.push(userId);
  }

  const [presentToday] = await query<{ c: number | string }>(presentSql, presentParams);
  const [attScoped] = await query<{ rate: number | string }>(attSql, attParams);

  let claimsSql = `SELECT COUNT(*) AS c FROM expense_claims WHERE tenant_id = $1 AND status IN ('pending','submitted')`;
  const claimsParams: unknown[] = [DEFAULT_TENANT];
  if (role === 'manager') {
    claimsSql = `SELECT COUNT(*) AS c FROM expense_claims ec
      JOIN employees e ON e.user_id = ec.user_id AND e.tenant_id = ec.tenant_id
      WHERE ec.tenant_id = $1 AND ec.status IN ('pending','submitted') AND e.manager_user_id = $2`;
    claimsParams.push(userId);
  } else if (role === 'employee') {
    claimsSql += ` AND user_id = $2`;
    claimsParams.push(userId);
  }
  const [pendingClaims] = await query<{ c: number | string }>(claimsSql, claimsParams).catch(() => [{ c: 0 }]);

  let approvalsSql = `SELECT COUNT(*) AS c FROM approval_requests WHERE tenant_id = $1 AND status = 'pending'`;
  const approvalsParams: unknown[] = [DEFAULT_TENANT];
  if (role === 'manager') {
    approvalsSql = `SELECT COUNT(*) AS c FROM approval_requests ar
      JOIN approval_steps s ON s.workflow_id = ar.workflow_id AND s.step_order = ar.current_step
      WHERE ar.tenant_id = $1 AND ar.status = 'pending'
        AND (
          (s.approver_user_id IS NOT NULL AND s.approver_user_id = $2)
          OR (s.approver_user_id IS NULL AND s.approver_role = 'manager')
        )`;
    approvalsParams.push(userId);
  } else if (role === 'employee') {
    approvalsSql += ` AND requester_id = $2`;
    approvalsParams.push(userId);
  }
  const [pendingApprovals] = await query<{ c: number | string }>(approvalsSql, approvalsParams).catch(() => [
    { c: 0 },
  ]);

  const currency = await getReportingCurrency();

  res.json({
    stats: {
      totalEmployees: Number(emp?.total ?? 0),
      activeEmployees: Number(emp?.active ?? 0),
      onLeave: Number(emp?.on_leave ?? 0),
      pendingLeave: Number(leave?.pending ?? 0),
      pendingTimesheets: Number(ts?.pending ?? 0),
      attendanceRate: Number(attScoped?.rate ?? 0),
      monthlyPayroll,
      newHires: Number(newHires?.c ?? 0),
      presentToday: Number(presentToday?.c ?? 0),
      pendingClaims: Number(pendingClaims?.c ?? 0),
      pendingApprovals: Number(pendingApprovals?.c ?? 0),
      reportingCurrency: currency,
    },
  });
});

/** Admin/HR employee-wise activity rollup from live tables */
router.get('/employee-activity', requireAuth, requirePermission('dashboard', 'read'), async (req, res) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    return res.status(403).json({ error: 'Admin or HR only' });
  }
  const rows = await query(
    `SELECT e.id, e.name, e.department, e.status, e.user_id,
       (SELECT COUNT(*) FROM attendance_days ad
         WHERE ad.tenant_id = e.tenant_id AND ad.user_id = e.user_id
           AND ad.work_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND ad.status IN ('Present','In Progress')) AS present_days,
       (SELECT COUNT(*) FROM leave_requests lr
         WHERE lr.tenant_id = e.tenant_id AND lr.user_id = e.user_id AND lr.status = 'Pending') AS pending_leave,
       (SELECT COUNT(*) FROM expense_claims ec
         WHERE ec.tenant_id = e.tenant_id AND ec.user_id = e.user_id AND ec.status IN ('pending','submitted')) AS pending_claims,
       (SELECT COALESCE(SUM(p.net_pay),0) FROM payslips p
         WHERE p.tenant_id = e.tenant_id AND p.employee_id = e.id) AS payroll_ytd,
       e.salary, e.created_by, e.updated_by, e.updated_at, e.join_date
     FROM employees e
     WHERE e.tenant_id = $1
     ORDER BY e.name
     LIMIT 200`,
    [DEFAULT_TENANT],
  ).catch(async () =>
    // Fallback if audit columns missing
    query(
      `SELECT e.id, e.name, e.department, e.status, e.user_id, e.salary, e.join_date,
         0 AS present_days, 0 AS pending_leave, 0 AS pending_claims, 0 AS payroll_ytd,
         NULL AS created_by, NULL AS updated_by, NULL AS updated_at
       FROM employees e WHERE e.tenant_id = $1 ORDER BY e.name LIMIT 200`,
      [DEFAULT_TENANT],
    ),
  );

  const currency = await getReportingCurrency();
  res.json({
    currency,
    employees: rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      department: String(r.department ?? ''),
      status: String(r.status ?? ''),
      presentDays30: Number(r.present_days ?? 0),
      pendingLeave: Number(r.pending_leave ?? 0),
      pendingClaims: Number(r.pending_claims ?? 0),
      payrollYtd: Number(r.payroll_ytd ?? 0),
      monthlySalary: Math.round(Number(r.salary ?? 0) / 12),
      annualSalary: Number(r.salary ?? 0),
      createdBy: r.created_by ?? null,
      updatedBy: r.updated_by ?? null,
      updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : null,
      joinDate: r.join_date ? String(r.join_date).slice(0, 10) : null,
    })),
  });
});

export default router;
