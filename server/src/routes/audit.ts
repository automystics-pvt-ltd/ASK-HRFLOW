import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getCompanyTimezone } from '../lib/org-settings.js';

const router = Router();

function mapRow(r: Record<string, unknown>, timezone: string) {
  let before: unknown = null;
  let after: unknown = null;
  try {
    before = r.before_json != null
      ? typeof r.before_json === 'string'
        ? JSON.parse(String(r.before_json))
        : r.before_json
      : null;
  } catch {
    before = r.before_json;
  }
  try {
    after = r.after_json != null
      ? typeof r.after_json === 'string'
        ? JSON.parse(String(r.after_json))
        : r.after_json
      : null;
  } catch {
    after = r.after_json;
  }
  const created = new Date(String(r.created_at));
  return {
    id: r.id,
    ts: created.toISOString(),
    displayTime: created.toLocaleString('en-IN', { timeZone: timezone }),
    actorId: r.actor_id,
    actorName: r.actor_name,
    event: r.event,
    detail: r.detail,
    targetId: r.target_id,
    moduleKey: r.module_key ?? null,
    before,
    after,
    timezone,
  };
}

router.get('/', requireAuth, requirePermission('audit', 'read'), async (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q || '').trim();
  const moduleKey = String(req.query.module || req.query.moduleKey || '').trim();
  const actorId = String(req.query.actorId || '').trim();
  const targetId = String(req.query.targetId || req.query.employeeId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  const filters: string[] = ['tenant_id = $1'];
  const params: unknown[] = [DEFAULT_TENANT];
  let idx = 2;

  if (q) {
    filters.push(
      `(event LIKE $${idx} OR detail LIKE $${idx} OR actor_name LIKE $${idx} OR COALESCE(module_key,'') LIKE $${idx})`,
    );
    params.push(`%${q}%`);
    idx++;
  }
  if (moduleKey && moduleKey !== 'all') {
    filters.push(`module_key = $${idx++}`);
    params.push(moduleKey);
  }
  if (actorId) {
    filters.push(`actor_id = $${idx++}`);
    params.push(actorId);
  }
  if (targetId) {
    filters.push(`target_id = $${idx++}`);
    params.push(targetId);
  }
  if (from) {
    filters.push(`created_at >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    filters.push(`created_at <= $${idx++}`);
    params.push(`${to} 23:59:59`);
  }

  const where = filters.join(' AND ');
  const timezone = await getCompanyTimezone();
  const rows = await query(
    `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  const [countRow] = await query<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM audit_logs WHERE ${where}`,
    params,
  );

  res.json({
    audit: rows.map((r) => mapRow(r, timezone)),
    total: Number(countRow?.c ?? 0),
    timezone,
  });
});

/** Module / actor facets for Admin audit filters */
router.get('/facets', requireAuth, requirePermission('audit', 'read'), async (_req, res) => {
  const modules = await query<{ module_key: string | null; c: number | string }>(
    `SELECT module_key, COUNT(*) AS c FROM audit_logs
     WHERE tenant_id = $1 AND module_key IS NOT NULL
     GROUP BY module_key ORDER BY c DESC`,
    [DEFAULT_TENANT],
  );
  const actors = await query<{ actor_id: string; actor_name: string; c: number | string }>(
    `SELECT actor_id, actor_name, COUNT(*) AS c FROM audit_logs
     WHERE tenant_id = $1
     GROUP BY actor_id, actor_name ORDER BY c DESC LIMIT 50`,
    [DEFAULT_TENANT],
  );
  res.json({
    modules: modules.map((m) => ({ key: m.module_key, count: Number(m.c) })),
    actors: actors.map((a) => ({ id: a.actor_id, name: a.actor_name, count: Number(a.c) })),
  });
});

/** Employee-wise audit history */
router.get('/employee/:id', requireAuth, requirePermission('audit', 'read'), async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const timezone = await getCompanyTimezone();
  const emp = await queryOne('SELECT id, name, user_id FROM employees WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const rows = await query(
    `SELECT * FROM audit_logs
     WHERE tenant_id = $1 AND (target_id = $2 OR target_id = $3)
     ORDER BY created_at DESC LIMIT $4`,
    [DEFAULT_TENANT, String(emp.id), emp.user_id ? String(emp.user_id) : String(emp.id), limit],
  );
  res.json({
    employee: { id: emp.id, name: emp.name },
    audit: rows.map((r) => mapRow(r, timezone)),
    timezone,
  });
});

export default router;
