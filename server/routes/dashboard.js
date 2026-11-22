import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/stats', requireAuth, async (_req, res) => {
  const [emp] = await query('SELECT COUNT(*) as total, SUM(status = "Active") as active FROM employees');
  const [leave] = await query('SELECT COUNT(*) as pending FROM leave_requests WHERE status = "Pending"');
  res.json({
    stats: {
      totalEmployees: Number(emp?.total ?? 0),
      activeEmployees: Number(emp?.active ?? 0),
      pendingLeave: Number(leave?.pending ?? 0),
      attendanceRate: 94.2,
    },
  });
});

export default router;