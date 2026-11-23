import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { calculateEmployeePayroll } from '../lib/payroll-calc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

export const payrollRouter = Router();
payrollRouter.get('/runs', requireAuth, requirePermission('payroll', 'read'), async (req, res) => {
  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  // Company-wide payroll run totals are confidential — employees/managers only see runs
  // that produced their own payslip (period labels without aggregate totals).
  if (!canAll) {
    const emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
      DEFAULT_TENANT,
      req.user!.sub,
    ]);
    if (!emp) return res.json({ runs: [] });
    const rows = await query(
      `SELECT pr.id, pr.period_label, pr.period_start, pr.period_end, pr.status, NULL AS total_amount
       FROM payroll_runs pr
       JOIN payslips p ON p.payroll_run_id = pr.id AND p.employee_id = $2
       WHERE pr.tenant_id = $1
       ORDER BY pr.period_start DESC`,
      [DEFAULT_TENANT, emp.id],
    );
    return res.json({ runs: rows });
  }
  const rows = await query('SELECT * FROM payroll_runs WHERE tenant_id = $1 ORDER BY period_start DESC', [DEFAULT_TENANT]);
  res.json({ runs: rows });
});
payrollRouter.get('/payslips', requireAuth, requirePermission('payroll', 'read'), async (req, res) => {
  const emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
    DEFAULT_TENANT,
    req.user!.sub,
  ]);
  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  // Managers must not see other employees' salary/payslip data
  if (req.user!.role === 'manager' || !canAll) {
    const rows = emp
      ? await query('SELECT * FROM payslips WHERE tenant_id = $1 AND employee_id = $2 ORDER BY issued_at DESC', [
          DEFAULT_TENANT,
          emp.id,
        ])
      : [];
    return res.json({ payslips: rows });
  }
  const rows = await query(
    `SELECT p.*, e.name AS employee_name FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     WHERE p.tenant_id = $1 ORDER BY p.issued_at DESC`,
    [DEFAULT_TENANT],
  );
  res.json({ payslips: rows });
});

payrollRouter.get('/salary-structure/:employeeId', requireAuth, requirePermission('payroll', 'read'), async (req, res) => {
  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  if (!canAll) {
    const self = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
      DEFAULT_TENANT,
      req.user!.sub,
    ]);
    if (!self || String(self.id) !== String(req.params.employeeId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const rows = await query(
    `SELECT * FROM employee_salary_structures
     WHERE tenant_id = $1 AND employee_id = $2 ORDER BY effective_from DESC`,
    [DEFAULT_TENANT, req.params.employeeId],
  );
  res.json({
    structures: rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      effectiveFrom: r.effective_from,
      basic: Number(r.basic),
      components:
        typeof r.components_json === 'string' ? JSON.parse(r.components_json) : r.components_json,
      notes: r.notes,
      createdAt: r.created_at,
    })),
  });
});

payrollRouter.put('/salary-structure/:employeeId', requireAuth, requirePermission('payroll', 'update'), async (req, res) => {
  const { effectiveFrom, basic, components, notes } = req.body || {};
  if (!effectiveFrom || basic == null) return res.status(400).json({ error: 'effectiveFrom and basic required' });
  const emp = await queryOne('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [
    req.params.employeeId,
    DEFAULT_TENANT,
  ]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const { getReportingCurrency } = await import('../lib/org-settings.js');
  const currencyCode = await getReportingCurrency();
  const id = await insert(
    `INSERT INTO employee_salary_structures
     (tenant_id, employee_id, effective_from, basic, components_json, notes, created_by, currency_code, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      DEFAULT_TENANT,
      req.params.employeeId,
      effectiveFrom,
      Number(basic),
      JSON.stringify(components ?? {}),
      notes ?? null,
      req.user!.sub,
      currencyCode,
      req.user!.sub,
    ],
  );
  res.json({ id, currencyCode });
});

payrollRouter.get('/components', requireAuth, requirePermission('payroll', 'read'), async (_req, res) => {
  const rows = await query(
    'SELECT * FROM salary_components WHERE tenant_id = $1 AND active = 1 ORDER BY kind, name',
    [DEFAULT_TENANT],
  );
  res.json({ components: rows });
});

payrollRouter.get('/statutory-rates', requireAuth, requirePermission('payroll', 'read'), async (_req, res) => {
  const rows = await query(
    'SELECT * FROM statutory_rates WHERE tenant_id = $1 AND active = 1 ORDER BY code, effective_from DESC',
    [DEFAULT_TENANT],
  );
  res.json({ rates: rows });
});

payrollRouter.post('/runs', requireAuth, requirePermission('payroll', 'update'), async (req, res) => {
  const { periodLabel, periodStart, periodEnd } = req.body || {};
  if (!periodLabel || !periodStart || !periodEnd) return res.status(400).json({ error: 'Missing period fields' });
  const emps = await query<{ id: number; salary: string | number; user_id: string | null }>(
    `SELECT id, salary, user_id FROM employees WHERE tenant_id = $1 AND status = 'Active'`,
    [DEFAULT_TENANT],
  );

  let total = 0;
  const computed: { empId: number; net: number; breakdown: Record<string, unknown> }[] = [];
  for (const e of emps) {
    const result = await calculateEmployeePayroll({
      employeeId: e.id,
      userId: e.user_id,
      periodStart,
      periodEnd,
      annualSalaryFallback: Number(e.salary || 0),
    });
    total += result.net;
    computed.push({ empId: e.id, net: result.net, breakdown: result as unknown as Record<string, unknown> });
  }

  const { getReportingCurrency } = await import('../lib/org-settings.js');
  const currencyCode = await getReportingCurrency();
  const runId = await insert(
    `INSERT INTO payroll_runs (tenant_id, period_label, period_start, period_end, status, total_amount, created_by, currency_code)
     VALUES ($1,$2,$3,$4,'processed',$5,$6,$7)`,
    [DEFAULT_TENANT, periodLabel, periodStart, periodEnd, total, req.user!.sub, currencyCode],
  );
  for (const c of computed) {
    await query(
      `INSERT INTO payslips (tenant_id, payroll_run_id, employee_id, net_pay, breakdown, currency_code)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [DEFAULT_TENANT, runId, c.empId, c.net, JSON.stringify(c.breakdown), currencyCode],
    );
  }
  res.status(201).json({ id: runId, total, employeesProcessed: emps.length, currencyCode });
});

payrollRouter.get('/payslips/:id/html', requireAuth, requirePermission('payroll', 'read'), async (req, res) => {
  const slip = await queryOne(
    `SELECT p.*, e.name AS employee_name, e.department, e.position, e.email, pr.period_label, pr.period_start, pr.period_end
     FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     JOIN payroll_runs pr ON pr.id = p.payroll_run_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [req.params.id, DEFAULT_TENANT],
  );
  if (!slip) return res.status(404).json({ error: 'Not found' });

  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  if (!canAll) {
    const self = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
      DEFAULT_TENANT,
      req.user!.sub,
    ]);
    if (!self || self.id !== slip.employee_id) return res.status(403).json({ error: 'Forbidden' });
  }

  let breakdownRaw: Record<string, unknown> = {};
  try {
    breakdownRaw =
      typeof slip.breakdown === 'string'
        ? (JSON.parse(slip.breakdown) as Record<string, unknown>)
        : ((slip.breakdown as Record<string, unknown>) ?? {});
  } catch {
    breakdownRaw = {};
  }

  const companyRow = await queryOne<{ value: unknown }>(
    'SELECT value FROM organization_settings WHERE tenant_id = $1 AND `key` = $2',
    [DEFAULT_TENANT, 'company'],
  );
  let companyName = 'Automystics';
  if (companyRow?.value) {
    const v = typeof companyRow.value === 'string' ? JSON.parse(String(companyRow.value)) : companyRow.value;
    companyName = String((v as { name?: string }).name || companyName);
  }

  // Prefer structured SalaryBreakdown when present; otherwise rebuild a minimal one
  const hasStructured = Array.isArray(breakdownRaw.earnings);
  const html = hasStructured
    ? payslipHtml({
        employeeName: String(slip.employee_name),
        periodLabel: String(slip.period_label),
        companyName,
        breakdown: breakdownRaw as unknown as import('../lib/payroll-calc.js').SalaryBreakdown,
      })
    : payslipHtml({
        employeeName: String(slip.employee_name),
        periodLabel: String(slip.period_label),
        companyName,
        breakdown: {
          basic: Number(breakdownRaw.basic ?? 0),
          earnings: [
            { code: 'basic', name: 'Basic', amount: Number(breakdownRaw.basic ?? 0) },
            { code: 'hra', name: 'HRA', amount: Number(breakdownRaw.hra ?? 0) },
          ],
          deductions: [
            { code: 'pf', name: 'PF', amount: Number(breakdownRaw.pf ?? 0) },
            { code: 'esi', name: 'ESI', amount: Number(breakdownRaw.esi ?? 0) },
            { code: 'pt', name: 'Professional Tax', amount: Number(breakdownRaw.pt ?? 0) },
          ],
          gross: Number(breakdownRaw.gross ?? slip.net_pay),
          totalDeductions: Number(breakdownRaw.deductions ?? 0),
          net: Number(slip.net_pay),
          daysPayable: Number(breakdownRaw.presentDays ?? 0),
          workingDays: Number(breakdownRaw.workingDays ?? 0),
          unpaidLeaveDays: 0,
        },
      });
  res.type('html').send(html);
});

export const recruitmentRouter = Router();
recruitmentRouter.get('/', requireAuth, requirePermission('recruitment', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM job_openings WHERE tenant_id = $1 ORDER BY id DESC', [DEFAULT_TENANT]);
  res.json({ items: rows });
});
recruitmentRouter.post('/', requireAuth, requirePermission('recruitment', 'create'), async (req, res) => {
  const { title, department, location, status, description } = req.body || {};
  if (!title || !department) return res.status(400).json({ error: 'title and department required' });
  const id = await insert(
    `INSERT INTO job_openings (tenant_id, title, department, location, status, description)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      DEFAULT_TENANT,
      String(title).trim(),
      String(department).trim(),
      location ? String(location).trim() : null,
      status === 'closed' ? 'closed' : 'open',
      description ? String(description) : null,
    ],
  );
  res.status(201).json({ id });
});
recruitmentRouter.put('/:id', requireAuth, requirePermission('recruitment', 'update'), async (req, res) => {
  const { title, department, location, status, description } = req.body || {};
  const row = await queryOne('SELECT id FROM job_openings WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  await query(
    `UPDATE job_openings SET
       title = COALESCE($1, title),
       department = COALESCE($2, department),
       location = COALESCE($3, location),
       status = COALESCE($4, status),
       description = COALESCE($5, description)
     WHERE id = $6`,
    [
      title != null ? String(title).trim() : null,
      department != null ? String(department).trim() : null,
      location !== undefined ? (location ? String(location).trim() : null) : null,
      status != null ? String(status) : null,
      description !== undefined ? (description ? String(description) : null) : null,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});
recruitmentRouter.get('/candidates', requireAuth, requirePermission('recruitment', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM candidates WHERE tenant_id = $1 ORDER BY id DESC', [DEFAULT_TENANT]);
  res.json({ candidates: rows });
});
recruitmentRouter.post('/candidates', requireAuth, requirePermission('recruitment', 'create'), async (req, res) => {
  const { jobOpeningId, name, email, stage } = req.body || {};
  if (!jobOpeningId || !name || !email) return res.status(400).json({ error: 'jobOpeningId, name and email required' });
  const job = await queryOne('SELECT id FROM job_openings WHERE id = $1 AND tenant_id = $2', [
    jobOpeningId,
    DEFAULT_TENANT,
  ]);
  if (!job) return res.status(404).json({ error: 'Job opening not found' });
  const id = await insert(
    `INSERT INTO candidates (tenant_id, job_opening_id, name, email, stage)
     VALUES ($1,$2,$3,$4,$5)`,
    [DEFAULT_TENANT, jobOpeningId, String(name).trim(), String(email).trim().toLowerCase(), stage || 'applied'],
  );
  res.status(201).json({ id });
});

export const performanceRouter = Router();
performanceRouter.get('/reviews', requireAuth, requirePermission('performance', 'read'), async (req, res) => {
  const role = req.user!.role;
  const canAll = role === 'admin' || role === 'hr';
  let rows;
  if (canAll) {
    rows = await query(
      `SELECT pr.*, e.name AS employee_name, e.position, e.department
       FROM performance_reviews pr
       LEFT JOIN employees e ON e.id = pr.employee_id
       WHERE pr.tenant_id = $1
       ORDER BY pr.created_at DESC`,
      [DEFAULT_TENANT],
    );
  } else if (role === 'manager') {
    rows = await query(
      `SELECT pr.*, e.name AS employee_name, e.position, e.department
       FROM performance_reviews pr
       JOIN employees e ON e.id = pr.employee_id
       WHERE pr.tenant_id = $1 AND (e.user_id = $2 OR e.manager_user_id = $2 OR pr.reviewer_id = $2)
       ORDER BY pr.created_at DESC`,
      [DEFAULT_TENANT, req.user!.sub],
    );
  } else {
    rows = await query(
      `SELECT pr.*, e.name AS employee_name, e.position, e.department
       FROM performance_reviews pr
       JOIN employees e ON e.id = pr.employee_id
       WHERE pr.tenant_id = $1 AND e.user_id = $2
       ORDER BY pr.created_at DESC`,
      [DEFAULT_TENANT, req.user!.sub],
    );
  }
  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      position: r.position,
      department: r.department,
      reviewerId: r.reviewer_id,
      periodLabel: r.period_label,
      rating: r.rating != null ? Number(r.rating) : null,
      score: r.rating != null ? Math.round(Number(r.rating) * 20) : null,
      summary: r.summary,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
});
performanceRouter.get('/goals', requireAuth, requirePermission('performance', 'read'), async (req, res) => {
  const role = req.user!.role;
  const canAll = role === 'admin' || role === 'hr';
  let rows;
  if (canAll) {
    rows = await query('SELECT * FROM goals WHERE tenant_id = $1', [DEFAULT_TENANT]);
  } else if (role === 'manager') {
    rows = await query(
      `SELECT g.* FROM goals g
       JOIN employees e ON e.id = g.employee_id
       WHERE g.tenant_id = $1 AND (e.user_id = $2 OR e.manager_user_id = $2)`,
      [DEFAULT_TENANT, req.user!.sub],
    );
  } else {
    rows = await query(
      `SELECT g.* FROM goals g
       JOIN employees e ON e.id = g.employee_id
       WHERE g.tenant_id = $1 AND e.user_id = $2`,
      [DEFAULT_TENANT, req.user!.sub],
    );
  }
  res.json({ goals: rows });
});

export const documentsRouter = Router();
documentsRouter.get('/', requireAuth, requirePermission('employees', 'read'), async (_req, res) => {
  const rows = await query('SELECT id, title, category, mime_type, created_at FROM documents WHERE tenant_id = $1', [
    DEFAULT_TENANT,
  ]);
  res.json({ documents: rows });
});
documentsRouter.post('/upload', requireAuth, requirePermission('employees', 'create'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = uuid().slice(0, 12);
  const dest = path.join(uploadsDir, id + path.extname(req.file.originalname));
  fs.renameSync(req.file.path, dest);
  await query(
    `INSERT INTO documents (id, tenant_id, title, category, file_path, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, DEFAULT_TENANT, req.body.title || req.file.originalname, req.body.category || 'general', dest, req.file.mimetype, req.user!.sub],
  );
  res.status(201).json({ id });
});

export const settingsRouter = Router();
settingsRouter.get('/', requireAuth, requirePermission('settings', 'read'), async (_req, res) => {
  const rows = await query('SELECT `key`, value FROM organization_settings WHERE tenant_id = $1', [DEFAULT_TENANT]);
  const settings: Record<string, unknown> = {};
  for (const r of rows) settings[String(r.key)] = r.value;
  res.json({ settings });
});
settingsRouter.put('/:key', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  await query(
    `INSERT INTO organization_settings (tenant_id, \`key\`, value) VALUES ($1,$2,$3)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [DEFAULT_TENANT, req.params.key, JSON.stringify(req.body.value ?? req.body)],
  );
  res.json({ ok: true });
});

export const reportsRouter = Router();
reportsRouter.get('/summary', requireAuth, requirePermission('reports', 'read'), async (_req, res) => {
  const [emps] = await query<{ c: number | string }>('SELECT COUNT(*) AS c FROM employees WHERE tenant_id = $1', [
    DEFAULT_TENANT,
  ]);
  const [jobs] = await query<{ c: number | string }>(
    'SELECT COUNT(*) AS c FROM job_openings WHERE tenant_id = $1 AND status = $2',
    [DEFAULT_TENANT, 'open'],
  );
  res.json({ report: { headcount: Number(emps?.c), openJobs: Number(jobs?.c) } });
});

export const shiftsRouter = Router();
shiftsRouter.get('/', requireAuth, requirePermission('attendance', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM shifts WHERE tenant_id = $1 AND active = 1', [DEFAULT_TENANT]);
  res.json({ shifts: rows });
});
shiftsRouter.post('/', requireAuth, requirePermission('attendance', 'update'), async (req, res) => {
  const { name, startTime, endTime, graceMinutes } = req.body || {};
  const id = await insert(
    `INSERT INTO shifts (tenant_id, name, start_time, end_time, grace_minutes) VALUES ($1,$2,$3,$4,$5)`,
    [DEFAULT_TENANT, name, startTime, endTime, graceMinutes ?? 15],
  );
  res.status(201).json({ id });
});
