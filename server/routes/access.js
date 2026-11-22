import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toAppUser } from '../lib/users.js';

const router = Router();

router.get('/users', requireAuth, async (_req, res) => {
  const rows = await query('SELECT id, name, email, role, department, active, department_access, permissions, last_login FROM users ORDER BY name');
  res.json({ users: rows.map(toAppUser) });
});

router.get('/permissions', requireAuth, async (_req, res) => {
  const rows = await query('SELECT role, module_id, actions FROM role_permissions');
  const roleTemplates = { admin: {}, hr: {}, employee: {} };
  for (const r of rows) {
    const actions = typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions;
    roleTemplates[r.role][r.module_id] = actions;
  }
  res.json({ roleTemplates });
});

export default router;