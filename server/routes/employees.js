import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query('SELECT * FROM employees ORDER BY name');
  res.json({ employees: rows.map(mapEmployee) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ employee: mapEmployee(rows[0]) });
});

router.post('/', requireAuth, async (req, res) => {
  const e = req.body || {};
  const result = await query(
    `INSERT INTO employees (name, email, phone, department, position, status, join_date, salary, location, country, avatar, manager, skills)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.name, e.email, e.phone ?? null, e.department, e.position, e.status ?? 'Active', e.joinDate ?? e.join_date, e.salary ?? 0, e.location, e.country, e.avatar ?? null, e.manager ?? null, JSON.stringify(e.skills ?? [])],
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', requireAuth, async (req, res) => {
  const e = req.body || {};
  await query(
    `UPDATE employees SET name=?, email=?, department=?, position=?, status=?, salary=?, location=?, country=? WHERE id=?`,
    [e.name, e.email, e.department, e.position, e.status, e.salary, e.location, e.country, req.params.id],
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM employees WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

function mapEmployee(row) {
  let skills = row.skills;
  if (typeof skills === 'string') {
    try { skills = JSON.parse(skills); } catch { skills = []; }
  }
  return {
    ...row,
    joinDate: row.join_date,
    join_date: row.join_date,
    skills,
  };
}

export default router;