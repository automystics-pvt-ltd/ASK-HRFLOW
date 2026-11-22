import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth, attachUser } from '../middleware/auth.js';
import { ensureAppUser } from '../middleware/rbac.js';

const router = Router();

export type UserPrefs = {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  leaveUpdates: boolean;
  approvalReminders: boolean;
  payrollAlerts: boolean;
  weeklyDigest: boolean;
  quietHours: boolean;
};

const DEFAULTS: UserPrefs = {
  emailNotifications: true,
  inAppNotifications: true,
  leaveUpdates: true,
  approvalReminders: true,
  payrollAlerts: true,
  weeklyDigest: false,
  quietHours: false,
};

function mergePrefs(raw: unknown): UserPrefs {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    emailNotifications: obj.emailNotifications !== false,
    inAppNotifications: obj.inAppNotifications !== false,
    leaveUpdates: obj.leaveUpdates !== false,
    approvalReminders: obj.approvalReminders !== false,
    payrollAlerts: obj.payrollAlerts !== false,
    weeklyDigest: Boolean(obj.weeklyDigest),
    quietHours: Boolean(obj.quietHours),
  };
}

router.get('/', requireAuth, attachUser, async (req, res) => {
  const me = await ensureAppUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const row = await queryOne<{ prefs: unknown }>(
    'SELECT prefs FROM user_preferences WHERE tenant_id = $1 AND user_id = $2',
    [DEFAULT_TENANT, me.id],
  );
  let parsed: unknown = row?.prefs;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  res.json({ preferences: mergePrefs(parsed) });
});

router.put('/', requireAuth, attachUser, async (req, res) => {
  const me = await ensureAppUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const existing = await queryOne<{ prefs: unknown }>(
    'SELECT prefs FROM user_preferences WHERE tenant_id = $1 AND user_id = $2',
    [DEFAULT_TENANT, me.id],
  );
  let prevRaw: unknown = existing?.prefs;
  if (typeof prevRaw === 'string') {
    try {
      prevRaw = JSON.parse(prevRaw);
    } catch {
      prevRaw = {};
    }
  }
  const prev = mergePrefs(prevRaw);
  const incoming = (req.body?.preferences ?? req.body ?? {}) as Partial<UserPrefs>;
  const next = mergePrefs({ ...prev, ...incoming });
  // Employees cannot enable approval reminders (manager/HR/Admin only).
  if (me.role === 'employee') {
    next.approvalReminders = false;
  }
  await query(
    `INSERT INTO user_preferences (tenant_id, user_id, prefs)
     VALUES ($1,$2,$3)
     ON DUPLICATE KEY UPDATE prefs = VALUES(prefs)`,
    [DEFAULT_TENANT, me.id, JSON.stringify(next)],
  );
  res.json({ ok: true, preferences: next });
});

export default router;
