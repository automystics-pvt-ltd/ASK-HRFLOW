import { Router } from 'express';
import { DEFAULT_TENANT, query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireAuth, requirePermission('audit', 'read'), async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const rows = await query(
    `SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [DEFAULT_TENANT, limit],
  );
  res.json({
    audit: rows.map((r) => ({
      id: r.id,
      ts: new Date(String(r.created_at)).toISOString(),
      actorId: r.actor_id,
      actorName: r.actor_name,
      event: r.event,
      detail: r.detail,
      targetId: r.target_id,
    })),
  });
});

export default router;