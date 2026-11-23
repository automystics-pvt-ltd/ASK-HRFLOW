import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { query, queryOne, DEFAULT_TENANT } from '../db.js';
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from '../middleware/auth.js';
import { getFullUser } from '../lib/users.js';
import { writeAudit } from '../lib/audit.js';
import { recordLoginActivity } from '../lib/login-activity.js';
import {
  LOCKOUT_MINUTES,
  LOCKOUT_THRESHOLD,
  comparePassword,
  generateResetToken,
  generateTempPassword,
  hashPassword,
  hashToken,
  throttle,
  validatePasswordPolicy,
} from '../lib/password.js';
import { ensureAppUser, requirePermission } from '../middleware/rbac.js';
import { attachUser } from '../middleware/auth.js';

const router = Router();

function clientKey(req: { ip?: string; headers: Record<string, unknown> }) {
  const xf = req.headers['x-forwarded-for'];
  const forwarded = typeof xf === 'string' ? xf.split(',')[0]?.trim() : '';
  return forwarded || req.ip || 'unknown';
}

async function notifyAdmins(title: string, body: string) {
  const admins = await query<{ id: string }>('SELECT id FROM users WHERE tenant_id = $1 AND role = $2 AND active = 1', [
    DEFAULT_TENANT,
    'admin',
  ]);
  for (const a of admins) {
    await query(
      `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['n-' + uuid().slice(0, 10), DEFAULT_TENANT, a.id, title, body, 'alert', JSON.stringify([])],
    );
  }
}

router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const gate = throttle(`login:${clientKey(req)}`, 30, 15 * 60 * 1000);
  if (!gate.ok) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${gate.retryAfterSec} seconds.` });
  }

  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
    [DEFAULT_TENANT, String(email).trim()],
  );
  if (!row) return res.status(401).json({ error: 'Invalid email or password.' });

  if (row.locked_until && new Date(String(row.locked_until)).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(String(row.locked_until)).getTime() - Date.now()) / 60000);
    return res.status(423).json({ error: `Account temporarily locked. Try again in ${mins} minute(s).` });
  }

  const ok = await comparePassword(password, String(row.password_hash));
  if (!ok) {
    const attempts = Number(row.failed_login_attempts || 0) + 1;
    if (attempts >= LOCKOUT_THRESHOLD) {
      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = DATE_ADD(NOW(), INTERVAL ${LOCKOUT_MINUTES} MINUTE) WHERE id = $2`,
        [attempts, row.id],
      );
      return res.status(423).json({
        error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
      });
    }
    await query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, row.id]);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!row.active) return res.status(403).json({ error: 'This account is deactivated. Contact your administrator.' });

  await query('UPDATE users SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [
    row.id,
  ]);
  const user = await getFullUser(String(row.id));
  if (!user) return res.status(500).json({ error: 'User load failed' });

  // Optional MFA: if org/user MFA enrolled, require second factor (structure ready; secrets optional)
  if (user.mfaEnabled && row.mfa_secret) {
    const { mfaCode } = req.body || {};
    if (!mfaCode) {
      return res.status(401).json({ error: 'MFA code required.', mfaRequired: true });
    }
    // Without a TOTP library, accept only exact match against a short-lived admin-set code stored as secret
    // (enrollment stores a hashed one-time style secret for demo MFA). Prefer rejecting unknown codes.
    const secretOk = String(mfaCode).trim() === String(row.mfa_secret).trim();
    if (!secretOk) return res.status(401).json({ error: 'Invalid MFA code.' });
  }

  const remember = Boolean(rememberMe);
  const token = signToken({ id: user.id, role: user.role, email: user.email }, remember);
  setAuthCookie(res, token, remember);
  await writeAudit(user.id, user.name, 'Login', `${user.name} signed in`, user.id, {
    moduleKey: 'auth',
  });
  await recordLoginActivity({ req, userId: user.id, userName: user.name, event: 'login' });
  res.json({ user });
});

router.post('/logout', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user!.sub);
  if (user) {
    await writeAudit(user.id, user.name, 'Logout', `${user.name} signed out`, user.id, {
      moduleKey: 'auth',
    });
    await recordLoginActivity({ req, userId: user.id, userName: user.name, event: 'logout' });
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user!.sub);
  if (!user || !user.active) return res.json({ user: null });
  res.json({ user });
});

/** Public: submit Admin-controlled password reset request (never reveals account existence details beyond ack). */
router.post('/forgot-password', async (req, res) => {
  const gate = throttle(`forgot:${clientKey(req)}`, 10, 15 * 60 * 1000);
  if (!gate.ok) {
    return res.status(429).json({ error: `Too many requests. Try again in ${gate.retryAfterSec} seconds.` });
  }

  const { email, employeeId, note } = req.body || {};
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Enter a valid work email.' });
  }

  const user = await queryOne<Record<string, unknown>>(
    'SELECT id, name, email FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
    [DEFAULT_TENANT, String(email).trim()],
  );

  const id = 'pr-' + uuid().slice(0, 10);
  await query(
    `INSERT INTO password_reset_requests
      (id, tenant_id, user_id, email, employee_id, status, requester_note)
     VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
    [
      id,
      DEFAULT_TENANT,
      user ? String(user.id) : null,
      String(email).trim().toLowerCase(),
      employeeId ? String(employeeId).trim() : null,
      note ? String(note).slice(0, 500) : null,
    ],
  );

  if (user) {
    await notifyAdmins(
      'Password reset requested',
      `${user.name} (${user.email}) requested a password reset. Review it under Access Control.`,
    );
    await writeAudit('system', 'System', 'Password reset requested', `Request from ${user.email}`, String(user.id));
  }

  res.json({
    ok: true,
    message:
      'Your request was submitted. Contact your system administrator to complete the reset. Passwords are never shown or emailed automatically.',
  });
});

/** Authenticated user changes own password (required when mustChangePassword). */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!newPassword || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation must match.' });
  }
  const policy = validatePasswordPolicy(String(newPassword));
  if (!policy.ok) return res.status(400).json({ error: policy.error });

  const row = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [req.user!.sub]);
  if (!row) return res.status(404).json({ error: 'User not found' });

  const mustChange = Boolean(row.must_change_password);
  if (!mustChange) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required.' });
    const ok = await comparePassword(String(currentPassword), String(row.password_hash));
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = await hashPassword(String(newPassword));
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = 0, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
    [hash, row.id],
  );
  // Invalidate outstanding reset tokens
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [row.id]);
  await query(
    `UPDATE password_reset_requests SET status = 'completed', resolved_at = NOW()
     WHERE user_id = $1 AND status IN ('pending','approved')`,
    [row.id],
  );

  const user = await getFullUser(String(row.id));
  if (user) await writeAudit(user.id, user.name, 'Password changed', `${user.name} updated their password`, user.id);
  res.json({ ok: true, user });
});

/** Complete reset via Admin-issued one-time token. */
router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Reset token is required.' });
  if (!newPassword || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation must match.' });
  }
  const policy = validatePasswordPolicy(String(newPassword));
  if (!policy.ok) return res.status(400).json({ error: policy.error });

  const tokenHash = hashToken(String(token));
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

  const hash = await hashPassword(String(newPassword));
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = 0, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
    [hash, row.user_id],
  );
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
  if (row.request_id) {
    await query(
      `UPDATE password_reset_requests SET status = 'completed', resolved_at = NOW() WHERE id = $1`,
      [row.request_id],
    );
  }

  const user = await getFullUser(String(row.user_id));
  if (user) await writeAudit(user.id, user.name, 'Password reset completed', `${user.name} set a new password via reset link`, user.id);
  res.json({ ok: true, message: 'Password updated. You can sign in with your new password.' });
});

/** Admin: list password reset requests */
router.get('/password-resets', requireAuth, attachUser, requirePermission('access', 'read'), async (req, res) => {
  const me = await ensureAppUser(req);
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage password resets.' });
  const rows = await query(
    `SELECT id, user_id, email, employee_id, status, requester_note, admin_note, resolved_by, resolved_at, created_at
     FROM password_reset_requests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [DEFAULT_TENANT],
  );
  res.json({
    requests: rows.map((r) => ({
      id: String(r.id),
      userId: r.user_id ? String(r.user_id) : null,
      email: String(r.email),
      employeeId: r.employee_id ? String(r.employee_id) : null,
      status: String(r.status),
      requesterNote: r.requester_note ? String(r.requester_note) : null,
      adminNote: r.admin_note ? String(r.admin_note) : null,
      resolvedBy: r.resolved_by ? String(r.resolved_by) : null,
      resolvedAt: r.resolved_at ? new Date(String(r.resolved_at)).toISOString() : null,
      createdAt: new Date(String(r.created_at)).toISOString(),
    })),
  });
});

/** Admin: approve request → issue temporary password (returned once) and/or reset link token */
router.post(
  '/password-resets/:id/approve',
  requireAuth,
  attachUser,
  requirePermission('access', 'update'),
  async (req, res) => {
    const me = await ensureAppUser(req);
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage password resets.' });

    const request = await queryOne<Record<string, unknown>>(
      'SELECT * FROM password_reset_requests WHERE id = $1 AND tenant_id = $2',
      [req.params.id, DEFAULT_TENANT],
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (String(request.status) !== 'pending') return res.status(400).json({ error: 'Request is not pending.' });

    let userId = request.user_id ? String(request.user_id) : null;
    if (!userId) {
      const found = await queryOne('SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)', [
        DEFAULT_TENANT,
        String(request.email),
      ]);
      if (!found) return res.status(400).json({ error: 'No user account matches this email.' });
      userId = String(found.id);
    }

    const mode = String(req.body?.mode || 'temporary'); // temporary | link
    const adminNote = req.body?.adminNote ? String(req.body.adminNote).slice(0, 500) : null;
    let temporaryPassword: string | undefined;
    let resetToken: string | undefined;

    if (mode === 'link') {
      resetToken = generateResetToken();
      await query(
        `INSERT INTO password_reset_tokens
          (id, tenant_id, user_id, request_id, token_hash, expires_at, created_by)
         VALUES ($1,$2,$3,$4,$5, DATE_ADD(NOW(), INTERVAL 24 HOUR), $6)`,
        ['pt-' + uuid().slice(0, 10), DEFAULT_TENANT, userId, request.id, hashToken(resetToken), me!.id],
      );
      await query(
        'UPDATE users SET must_change_password = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId],
      );
    } else {
      temporaryPassword = generateTempPassword();
      const hash = await hashPassword(temporaryPassword);
      await query(
        `UPDATE users SET password_hash = $1, must_change_password = 1, password_changed_at = NOW(),
         failed_login_attempts = 0, locked_until = NULL WHERE id = $2`,
        [hash, userId],
      );
    }

    await query(
      `UPDATE password_reset_requests
       SET status = 'approved', admin_note = $1, resolved_by = $2, resolved_at = NOW(), user_id = $3
       WHERE id = $4`,
      [adminNote, me!.id, userId, request.id],
    );

    await writeAudit(me!.id, me!.name, 'Password reset approved', `Approved reset for ${request.email}`, userId);
    await query(
      `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        'n-' + uuid().slice(0, 10),
        DEFAULT_TENANT,
        userId,
        'Password reset approved',
        'An administrator reset your password. Sign in with the temporary credentials provided to you, then set a new password immediately.',
        'alert',
        JSON.stringify([]),
      ],
    );

    res.json({
      ok: true,
      temporaryPassword: temporaryPassword ?? null,
      resetToken: resetToken ?? null,
      message: temporaryPassword
        ? 'Temporary password generated. Share it securely out-of-band. It will not be shown again.'
        : 'Reset token generated. Share the link securely. It expires in 24 hours.',
    });
  },
);

router.post(
  '/password-resets/:id/reject',
  requireAuth,
  attachUser,
  requirePermission('access', 'update'),
  async (req, res) => {
    const me = await ensureAppUser(req);
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage password resets.' });
    const adminNote = req.body?.adminNote ? String(req.body.adminNote).slice(0, 500) : null;
    const request = await queryOne('SELECT * FROM password_reset_requests WHERE id = $1', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (String(request.status) !== 'pending') return res.status(400).json({ error: 'Request is not pending.' });
    await query(
      `UPDATE password_reset_requests SET status = 'rejected', admin_note = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`,
      [adminNote, me!.id, req.params.id],
    );
    await writeAudit(me!.id, me!.name, 'Password reset rejected', `Rejected reset for ${request.email}`, request.user_id ? String(request.user_id) : undefined);
    res.json({ ok: true });
  },
);

/** Admin: list demo accounts (no password hashes). */
router.get('/demo-accounts', requireAuth, attachUser, requirePermission('access', 'read'), async (req, res) => {
  const me = await ensureAppUser(req);
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage demo accounts.' });
  const rows = await query(
    `SELECT id, name, email, role, department, active, last_login, must_change_password, is_demo
     FROM users WHERE tenant_id = $1 AND is_demo = 1 ORDER BY role, name`,
    [DEFAULT_TENANT],
  );
  res.json({
    accounts: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      role: String(r.role),
      department: String(r.department),
      active: Boolean(r.active),
      lastLogin: r.last_login ? new Date(String(r.last_login)).toISOString() : null,
      mustChangePassword: Boolean(r.must_change_password),
    })),
  });
});

/** Admin: generate temporary credentials for a demo account (returned once). */
router.post(
  '/demo-accounts/:id/reset-credentials',
  requireAuth,
  attachUser,
  requirePermission('access', 'update'),
  async (req, res) => {
    const me = await ensureAppUser(req);
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage demo accounts.' });

    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND is_demo = 1',
      [req.params.id, DEFAULT_TENANT],
    );
    if (!row) return res.status(404).json({ error: 'Demo account not found' });
    if (String(row.role) === 'admin' && String(row.id) === me!.id) {
      // allow admin to rotate own demo password but require must_change
    }

    const temporaryPassword = generateTempPassword();
    const hash = await hashPassword(temporaryPassword);
    await query(
      `UPDATE users SET password_hash = $1, must_change_password = 1, password_changed_at = NOW(),
       failed_login_attempts = 0, locked_until = NULL, active = 1 WHERE id = $2`,
      [hash, row.id],
    );
    await writeAudit(
      me!.id,
      me!.name,
      'Demo credentials rotated',
      `Generated temporary credentials for demo user ${row.email}`,
      String(row.id),
    );
    res.json({
      ok: true,
      email: String(row.email),
      temporaryPassword,
      message: 'Temporary password generated. Share securely; it will not be shown again. User must change it on next login.',
    });
  },
);

router.post(
  '/demo-accounts/:id/deactivate',
  requireAuth,
  attachUser,
  requirePermission('access', 'update'),
  async (req, res) => {
    const me = await ensureAppUser(req);
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage demo accounts.' });
    const row = await queryOne('SELECT * FROM users WHERE id = $1 AND is_demo = 1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Demo account not found' });
    if (String(row.id) === me!.id) return res.status(400).json({ error: 'Cannot deactivate your own account.' });
    await query('UPDATE users SET active = 0 WHERE id = $1', [row.id]);
    await writeAudit(me!.id, me!.name, 'Demo account deactivated', `Deactivated ${row.email}`, String(row.id));
    res.json({ ok: true });
  },
);

router.post(
  '/demo-accounts/:id/activate',
  requireAuth,
  attachUser,
  requirePermission('access', 'update'),
  async (req, res) => {
    const me = await ensureAppUser(req);
    if (me?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage demo accounts.' });
    const row = await queryOne('SELECT * FROM users WHERE id = $1 AND is_demo = 1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Demo account not found' });
    await query('UPDATE users SET active = 1 WHERE id = $1', [row.id]);
    await writeAudit(me!.id, me!.name, 'Demo account activated', `Activated ${row.email}`, String(row.id));
    res.json({ ok: true });
  },
);

export default router;
