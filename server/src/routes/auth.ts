import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, DEFAULT_TENANT } from '../db.js';
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from '../middleware/auth.js';
import { getFullUser, toAppUser } from '../lib/users.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const row = await queryOne(
    'SELECT * FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
    [DEFAULT_TENANT, String(email).trim()],
  );
  if (!row) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, String(row.password_hash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  if (!row.active) return res.status(403).json({ error: 'This account is deactivated. Contact your administrator.' });

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [row.id]);
  const user = await getFullUser(String(row.id));
  if (!user) return res.status(500).json({ error: 'User load failed' });

  const token = signToken({ id: user.id, role: user.role, email: user.email });
  setAuthCookie(res, token);
  await writeAudit(user.id, user.name, 'Login', `${user.name} signed in`, user.id);
  res.json({ user });
});

router.post('/logout', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user!.sub);
  if (user) await writeAudit(user.id, user.name, 'Logout', `${user.name} signed out`, user.id);
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user!.sub);
  if (!user || !user.active) return res.json({ user: null });
  res.json({ user });
});

export default router;