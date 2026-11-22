import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = req.query.userId || req.user.sub;
  const rows = await query('SELECT * FROM attendance WHERE user_id = ? ORDER BY work_date DESC LIMIT 60', [userId]);
  res.json({ attendance: rows });
});

router.post('/', requireAuth, async (req, res) => {
  const { workDate, checkIn, checkOut, status, hours, location } = req.body || {};
  await query(
    `INSERT INTO attendance (user_id, work_date, check_in, check_out, status, hours, location)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.sub, workDate, checkIn, checkOut, status ?? 'Present', hours ?? 0, location],
  );
  res.status(201).json({ ok: true });
});

export default router;