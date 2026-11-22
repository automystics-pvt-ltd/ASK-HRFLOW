import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM leave_requests ORDER BY created_at DESC');
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      employee: r.employee_name,
      type: r.type,
      startDate: r.start_date,
      endDate: r.end_date,
      days: r.days,
      status: r.status,
      reason: r.reason,
      comment: r.comment,
      decidedBy: r.decided_by,
    })),
  });
});

router.post('/', requireAuth, async (req, res) => {
  const { type, startDate, endDate, days, reason } = req.body || {};
  const rows = await query('SELECT name FROM users WHERE id = ?', [req.user.sub]);
  const name = rows[0]?.name || 'Employee';
  const result = await query(
    `INSERT INTO leave_requests (user_id, employee_name, type, start_date, end_date, days, status, reason)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    [req.user.sub, name, type, startDate, endDate, days ?? 1, reason ?? ''],
  );
  res.status(201).json({ id: result.insertId });
});

router.post('/:id/approve', requireAuth, async (req, res) => {
  const { approve, comment } = req.body || {};
  const rows = await query('SELECT * FROM users WHERE id = ?', [req.user.sub]);
  const decider = rows[0]?.name || 'Reviewer';
  await query(
    `UPDATE leave_requests SET status = ?, comment = ?, decided_by = ? WHERE id = ?`,
    [approve ? 'Approved' : 'Rejected', comment ?? null, decider, req.params.id],
  );
  res.json({ ok: true });
});

export default router;