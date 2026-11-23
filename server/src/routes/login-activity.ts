import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getCompanyTimezone } from '../lib/org-settings.js';
import { teamUserIds } from '../lib/team.js';

const router = Router();

function mapRow(r: Record<string, unknown>, timezone: string) {
  const created = new Date(String(r.created_at));
  const lat = r.latitude != null ? Number(r.latitude) : null;
  const lng = r.longitude != null ? Number(r.longitude) : null;
  const accuracy = r.accuracy != null ? Number(r.accuracy) : null;
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    event: r.event,
    ip: r.ip ?? null,
    userAgent: r.user_agent ?? null,
    latitude: Number.isFinite(lat as number) ? lat : null,
    longitude: Number.isFinite(lng as number) ? lng : null,
    accuracy: Number.isFinite(accuracy as number) ? accuracy : null,
    locationLabel: r.location_label ?? null,
    locationAddress: r.location_address ?? null,
    locationStatus: r.location_status ?? 'not_requested',
    ts: created.toISOString(),
    displayTime: created.toLocaleString('en-IN', { timeZone: timezone }),
    timezone,
  };
}

router.get('/', requireAuth, requirePermission('login-activity', 'read'), async (req, res) => {
  const role = req.user!.role;
  if (!['admin', 'hr', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q || '').trim();
  const event = String(req.query.event || '').trim().toLowerCase();
  const userId = String(req.query.userId || req.query.employeeId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  const filters: string[] = ['tenant_id = $1'];
  const params: unknown[] = [DEFAULT_TENANT];
  let idx = 2;

  if (role === 'manager') {
    const team = await teamUserIds(req.user!.sub);
    if (!team.length) {
      const timezone = await getCompanyTimezone();
      return res.json({ activity: [], total: 0, timezone, limit, offset });
    }
    const placeholders = team.map((_, i) => `$${idx + i}`).join(',');
    filters.push(`user_id IN (${placeholders})`);
    params.push(...team);
    idx += team.length;
  }

  if (q) {
    filters.push(
      `(user_name LIKE $${idx} OR COALESCE(ip,'') LIKE $${idx} OR COALESCE(location_label,'') LIKE $${idx} OR COALESCE(location_address,'') LIKE $${idx})`,
    );
    params.push(`%${q}%`);
    idx++;
  }
  if (event === 'login' || event === 'logout') {
    filters.push(`event = $${idx++}`);
    params.push(event);
  }
  if (userId) {
    filters.push(`user_id = $${idx++}`);
    params.push(userId);
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
    `SELECT * FROM login_activity WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  const [countRow] = await query<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM login_activity WHERE ${where}`,
    params,
  );

  res.json({
    activity: rows.map((r) => mapRow(r as Record<string, unknown>, timezone)),
    total: Number(countRow?.c ?? 0),
    timezone,
    limit,
    offset,
  });
});

router.get('/facets', requireAuth, requirePermission('login-activity', 'read'), async (req, res) => {
  const role = req.user!.role;
  if (!['admin', 'hr', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let scopeSql = 'tenant_id = $1';
  const params: unknown[] = [DEFAULT_TENANT];
  if (role === 'manager') {
    const team = await teamUserIds(req.user!.sub);
    if (!team.length) return res.json({ users: [], events: [] });
    const placeholders = team.map((_, i) => `$${i + 2}`).join(',');
    scopeSql += ` AND user_id IN (${placeholders})`;
    params.push(...team);
  }

  const users = await query<{ user_id: string; user_name: string; c: number | string }>(
    `SELECT user_id, user_name, COUNT(*) AS c FROM login_activity
     WHERE ${scopeSql}
     GROUP BY user_id, user_name ORDER BY user_name LIMIT 200`,
    params,
  );
  const events = await query<{ event: string; c: number | string }>(
    `SELECT event, COUNT(*) AS c FROM login_activity WHERE ${scopeSql} GROUP BY event`,
    params,
  );

  res.json({
    users: users.map((u) => ({ id: u.user_id, name: u.user_name, count: Number(u.c) })),
    events: events.map((e) => ({ key: e.event, count: Number(e.c) })),
  });
});

export default router;
