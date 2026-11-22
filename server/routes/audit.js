import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  res.json({
    audit: rows.map((a) => ({
      id: a.id,
      ts: a.created_at,
      actorId: a.actor_id,
      actorName: a.actor_name,
      event: a.event,
      detail: a.detail,
      targetId: a.target_id,
    })),
  });
});

export default router;