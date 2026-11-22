import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
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

export const recruitmentRouter = crudRouter('job_openings', 'recruitment');
recruitmentRouter.get('/candidates', requireAuth, requirePermission('recruitment', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM candidates WHERE tenant_id = $1', [DEFAULT_TENANT]);
  res.json({ candidates: rows });
});

export const performanceRouter = Router();
performanceRouter.get('/reviews', requireAuth, requirePermission('performance', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM performance_reviews WHERE tenant_id = $1', [DEFAULT_TENANT]);
  res.json({ reviews: rows });
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
  const rows = await query('SELECT key, value FROM organization_settings WHERE tenant_id = $1', [DEFAULT_TENANT]);
  const settings: Record<string, unknown> = {};
  for (const r of rows) settings[String(r.key)] = r.value;
  res.json({ settings });
});
settingsRouter.put('/:key', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  await query(
    `INSERT INTO organization_settings (tenant_id, key, value) VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [DEFAULT_TENANT, req.params.key, JSON.stringify(req.body.value ?? req.body)],
  );
  res.json({ ok: true });
});

export const reportsRouter = Router();
reportsRouter.get('/summary', requireAuth, requirePermission('reports', 'read'), async (_req, res) => {
  const [emps] = await query<{ c: string }>('SELECT COUNT(*)::text c FROM employees WHERE tenant_id = $1', [DEFAULT_TENANT]);
  const [jobs] = await query<{ c: string }>('SELECT COUNT(*)::text c FROM job_openings WHERE tenant_id = $1 AND status = $2', [
    DEFAULT_TENANT,
    'open',
  ]);
  res.json({ report: { headcount: Number(emps?.c), openJobs: Number(jobs?.c) } });
});

export const shiftsRouter = Router();
shiftsRouter.get('/', requireAuth, requirePermission('attendance', 'read'), async (_req, res) => {
  const rows = await query('SELECT * FROM shifts WHERE tenant_id = $1 AND active', [DEFAULT_TENANT]);
  res.json({ shifts: rows });
});
shiftsRouter.post('/', requireAuth, requirePermission('attendance', 'update'), async (req, res) => {
  const { name, startTime, endTime, graceMinutes } = req.body || {};
  const rows = await query<{ id: number }>(
    `INSERT INTO shifts (tenant_id, name, start_time, end_time, grace_minutes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [DEFAULT_TENANT, name, startTime, endTime, graceMinutes ?? 15],
  );
  res.status(201).json({ id: rows[0].id });
});