import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT * FROM notices WHERE user_id = ? OR user_id = 'all' ORDER BY created_at DESC LIMIT 100`,
    [req.user.sub],
  );
  res.json({
    notices: rows.map((n) => ({
      id: n.id,
      ts: n.created_at,
      userId: n.user_id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      read: typeof n.read_by === 'string' ? JSON.parse(n.read_by || '[]') : n.read_by || [],
    })),
  });
});

export default router;