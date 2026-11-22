import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, requireAuth, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { toAppUser } from '../lib/users.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [String(email).trim().toLowerCase()]);
  const row = rows[0];
  if (!row) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  if (!row.active) return res.status(403).json({ error: 'This account is deactivated. Contact your administrator.' });
  await query('UPDATE users SET last_login = NOW() WHERE id = ?', [row.id]);
  const user = toAppUser(row);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
  const row = rows[0];
  if (!row || !row.active) return res.json({ user: null });
  res.json({ user: toAppUser(row) });
});

export default router;