import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

function mapNotice(row: Record<string, unknown>, userId: string) {
  const readBy = Array.isArray(row.read_by) ? (row.read_by as string[]) : JSON.parse(String(row.read_by || '[]'));
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
    `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by) VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb)`,
    [id, DEFAULT_TENANT, userId || 'all', title, body, kind || 'announcement'],
  );
  res.status(201).json({ id });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  await query(
    `UPDATE notices SET read_by = read_by || $1::jsonb
     WHERE id = $2 AND tenant_id = $3 AND NOT read_by @> $1::jsonb`,
    [JSON.stringify([req.user!.sub]), req.params.id, DEFAULT_TENANT],
  );
  res.json({ ok: true });
});

export default router;