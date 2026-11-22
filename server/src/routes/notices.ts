import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

function parseReadBy(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapNotice(row: Record<string, unknown>, userId: string) {
  const readBy = parseReadBy(row.read_by);
  return {
    id: row.id,
    ts: new Date(String(row.created_at)).toISOString(),
    userId: row.user_id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    read: readBy,
    isRead: readBy.includes(userId),
  };
}

router.get('/', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT * FROM notices WHERE tenant_id = $1 AND (user_id = 'all' OR user_id = $2) ORDER BY created_at DESC`,
    [DEFAULT_TENANT, req.user!.sub],
  );
  res.json({ notices: rows.map((r) => mapNotice(r, req.user!.sub)) });
});

router.post('/', requireAuth, requirePermission('engagement', 'create'), async (req, res) => {
  const { title, body, kind, userId } = req.body || {};
  const id = 'n-' + uuid().slice(0, 8);
  await query(
    `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, DEFAULT_TENANT, userId || 'all', title, body, kind || 'announcement', JSON.stringify([])],
  );
  res.status(201).json({ id });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  const row = await queryOne<{ read_by: unknown }>(
    'SELECT read_by FROM notices WHERE id = $1 AND tenant_id = $2',
    [req.params.id, DEFAULT_TENANT],
  );
  if (!row) return res.status(404).json({ error: 'Not found' });

  const readBy = parseReadBy(row.read_by);
  if (!readBy.includes(req.user!.sub)) {
    readBy.push(req.user!.sub);
    await query('UPDATE notices SET read_by = $1 WHERE id = $2 AND tenant_id = $3', [
      JSON.stringify(readBy),
      req.params.id,
      DEFAULT_TENANT,
    ]);
  }
  res.json({ ok: true });
});

export default router;
