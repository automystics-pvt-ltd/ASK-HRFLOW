import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

function crudRouter(table: string, module: string, map?: (r: Record<string, unknown>) => unknown) {
  const router = Router();
  router.get('/', requireAuth, requirePermission(module, 'read'), async (_req, res) => {
    const rows = await query(`SELECT * FROM ${table} WHERE tenant_id = $1 ORDER BY id DESC`, [DEFAULT_TENANT]);
    res.json({ items: map ? rows.map(map) : rows });
  });
  router.post('/', requireAuth, requirePermission(module, 'create'), async (req, res) => {
    res.status(501).json({ error: `Stub create for ${table}`, body: req.body });
  });
  return router;
}

export const payrollRouter = Router();
payrollRouter.get('/runs', requireAuth, requirePermission('payroll', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM payroll_runs WHERE tenant_id = $1 ORDER BY period_start DESC', [DEFAULT_TENANT]);
  res.json({ runs: rows });
});
payrollRouter.get('/payslips', requireAuth, requirePermission('payroll', 'read'), async (req, res) => {
  const emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
    DEFAULT_TENANT,
    req.user!.sub,
  ]);
  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  const rows = canAll
    ? await query(
        `SELECT p.*, e.name AS employee_name FROM payslips p
         JOIN employees e ON e.id = p.employee_id
         WHERE p.tenant_id = $1 ORDER BY p.issued_at DESC`,
        [DEFAULT_TENANT],
      )
    : emp
      ? await query('SELECT * FROM payslips WHERE tenant_id = $1 AND employee_id = $2 ORDER BY issued_at DESC', [
          DEFAULT_TENANT,
          emp.id,
        ])
      : [];
  res.json({ payslips: rows });
});
payrollRouter.post('/runs', requireAuth, requirePermission('payroll', 'update'), async (req, res) => {
  const { periodLabel, periodStart, periodEnd } = req.body || {};
  if (!periodLabel || !periodStart || !periodEnd) return res.status(400).json({ error: 'Missing period fields' });
  const emps = await query<{ id: number; salary: string | number }>(
    `SELECT id, salary FROM employees WHERE tenant_id = $1 AND status = 'Active'`,
    [DEFAULT_TENANT],
  );
  const total = emps.reduce((s, e) => s + Number(e.salary || 0) / 12, 0);
  const runId = await insert(
    `INSERT INTO payroll_runs (tenant_id, period_label, period_start, period_end, status, total_amount)
     VALUES ($1,$2,$3,$4,'processed',$5)`,
    [DEFAULT_TENANT, periodLabel, periodStart, periodEnd, total],
  );
  for (const e of emps) {
    const gross = Number(e.salary || 0) / 12;
    const net = Math.round(gross * 0.8 * 100) / 100;
    await query(
      `INSERT INTO payslips (tenant_id, payroll_run_id, employee_id, net_pay, breakdown)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        DEFAULT_TENANT,
        runId,
        e.id,
        net,
        JSON.stringify({ gross: Math.round(gross * 100) / 100, deductions: Math.round((gross - net) * 100) / 100 }),
      ],
    );
  }
  res.status(201).json({ id: runId, total, employeesProcessed: emps.length });
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
performanceRouter.get('/reviews', requireAuth, requirePermission('performance', 'read'), async (_req, res) => {
  const rows = await query(
    `SELECT pr.*, e.name AS employee_name, e.position, e.department
     FROM performance_reviews pr
     LEFT JOIN employees e ON e.id = pr.employee_id
     WHERE pr.tenant_id = $1
     ORDER BY pr.created_at DESC`,
    [DEFAULT_TENANT],
  );
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
performanceRouter.get('/goals', requireAuth, requirePermission('performance', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM goals WHERE tenant_id = $1', [DEFAULT_TENANT]);
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
