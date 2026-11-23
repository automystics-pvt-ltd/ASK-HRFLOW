import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission, requireSelfOrPermission } from '../middleware/rbac.js';
import { hasAction } from '../lib/permissions.js';
import { writeAudit } from '../lib/audit.js';
import { isoDate } from '../lib/dates.js';
import { canViewEmployeeActivity } from '../lib/team.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const avatarUpload = multer({
  dest: avatarsDir,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, or WebP images are allowed'));
    }
    cb(null, true);
  },
});

function parseJsonArray(val: unknown): unknown[] {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseStringList(val: unknown): string[] {
  return parseJsonArray(val)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
}

function normalizeExperience(val: unknown): { title: string; company: string; years?: string; description?: string }[] {
  return parseJsonArray(val)
    .map((item) => {
      if (typeof item === 'string') {
        const s = item.trim();
        return s ? { title: s, company: '', years: '', description: '' } : null;
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const title = String(o.title ?? o.role ?? '').trim();
        if (!title) return null;
        return {
          title,
          company: String(o.company ?? '').trim(),
          years: String(o.years ?? o.period ?? '').trim(),
          description: String(o.description ?? '').trim(),
        };
      }
      return null;
    })
    .filter((x): x is { title: string; company: string; years?: string; description?: string } => Boolean(x));
}

function normalizeQualifications(val: unknown): { name: string; institution?: string; year?: string }[] {
  return parseJsonArray(val)
    .map((item) => {
      if (typeof item === 'string') {
        const s = item.trim();
        return s ? { name: s, institution: '', year: '' } : null;
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const name = String(o.name ?? o.title ?? '').trim();
        if (!name) return null;
        return {
          name,
          institution: String(o.institution ?? '').trim(),
          year: String(o.year ?? '').trim(),
        };
      }
      return null;
    })
    .filter((x): x is { name: string; institution?: string; year?: string } => Boolean(x));
}

function resolveAvatarAbs(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  const raw = String(avatar);
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return null;
  if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
  const base = path.basename(raw.replace(/^uploads[/\\]/, '').replace(/^avatars[/\\]/, ''));
  const abs = path.join(avatarsDir, base);
  return fs.existsSync(abs) ? abs : null;
}

function mapEmployee(row: Record<string, unknown>, hideSalary: boolean) {
  const id = Number(row.id);
  const skills = parseStringList(row.skills);
  const join = isoDate(row.join_date);
  const avatarStored = row.avatar != null && String(row.avatar).trim() ? String(row.avatar) : null;
  const hasFile = Boolean(resolveAvatarAbs(avatarStored));
  const avatarUrl =
    hasFile || (avatarStored && (avatarStored.startsWith('/api/') || avatarStored.startsWith('http')))
      ? avatarStored?.startsWith('http') || avatarStored?.startsWith('/api/')
        ? avatarStored
        : `/api/employees/${id}/avatar-file`
      : avatarStored;
  const base = {
    id,
    user_id: row.user_id,
    userId: row.user_id != null ? String(row.user_id) : null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    position: row.position,
    designation: row.designation ?? row.position,
    employmentType: row.employment_type ?? 'full_time',
    status: row.status,
    joinDate: join,
    join_date: join,
    location: row.location,
    state: row.state ?? '',
    district: row.district ?? '',
    country: row.country,
    avatar: avatarUrl,
    bio: row.bio != null ? String(row.bio) : '',
    experience: normalizeExperience(row.experience),
    qualifications: normalizeQualifications(row.qualifications),
    manager: row.manager,
    managerUserId: row.manager_user_id ?? null,
    role: row.user_role != null ? String(row.user_role) : row.role != null ? String(row.role) : null,
    skills,
  };
  const audit = {
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
  if (hideSalary) return { ...base, salary: null, ...audit };
  return { ...base, salary: Number(row.salary), ...audit };
}

async function loadLinkedEmployee(userId: string) {
  return queryOne(
    `SELECT e.*, u.role AS user_role
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.tenant_id = $1 AND e.user_id = $2
     LIMIT 1`,
    [DEFAULT_TENANT, userId],
  );
}

function unlinkAvatarFile(avatar: string | null | undefined) {
  const abs = resolveAvatarAbs(avatar);
  if (!abs) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

router.get('/', requireAuth, attachUser, requirePermission('employees', 'read'), async (req, res) => {
  try {
    const { backfillEmployeeUserLinks } = await import('../lib/link-employee-user.js');
    await backfillEmployeeUserLinks();
  } catch {
    /* non-fatal */
  }
  const u = await ensureAppUser(req);
  const q = String(req.query.q || '').trim();
  const department = String(req.query.department || '').trim();
  const status = String(req.query.status || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const filters: string[] = ['e.tenant_id = $1'];
  const params: unknown[] = [DEFAULT_TENANT];
  let idx = 2;
  // Managers only see their direct reports (and themselves when linked)
  if (req.user!.role === 'manager') {
    filters.push(`(e.manager_user_id = $${idx} OR e.user_id = $${idx})`);
    params.push(req.user!.sub);
    idx++;
  }
  if (q) {
    filters.push(`(e.name LIKE $${idx} OR e.email LIKE $${idx} OR e.department LIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (department && department !== 'All') {
    filters.push(`e.department = $${idx++}`);
    params.push(department);
  }
  if (status && status !== 'All') {
    filters.push(`e.status = $${idx++}`);
    params.push(status);
  }

  const where = filters.join(' AND ');
  const rows = await query(
    `SELECT e.*, u.role AS user_role
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE ${where}
     ORDER BY e.name LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  const [countRow] = await query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM employees e WHERE ${where}`,
    params,
  );

  // Salary: Admin, or anyone explicitly granted employees:update (typically HR). Managers default to read-only → hidden.
  const canSeeAllSalary =
    req.user!.role === 'admin' || (u != null && hasAction(u.permissions ?? {}, 'employees', 'update'));
  const hideOthersSalary = !canSeeAllSalary;

  res.json({
    employees: rows.map((r) => mapEmployee(r, hideOthersSalary && r.user_id !== req.user!.sub)),
    page,
    total: Number(countRow?.count ?? 0),
  });
});

/** Current user's linked employee profile (self-service). Must be before /:id. */
router.get('/me', requireAuth, attachUser, async (req, res) => {
  try {
    const { linkEmployeeToUserByEmail } = await import('../lib/link-employee-user.js');
    const u = await ensureAppUser(req);
    if (u?.email) await linkEmployeeToUserByEmail(String(u.email), req.user!.sub);
  } catch {
    /* non-fatal */
  }
  const row = await loadLinkedEmployee(req.user!.sub);
  if (!row) {
    return res.status(404).json({
      error: 'No employee profile is linked to your account. Ask Admin/HR to create or link your employee record.',
    });
  }
  res.json({ employee: mapEmployee(row, false) });
});

/** Self-service profile update — never allows salary, role, manager, department, status. */
router.patch('/me', requireAuth, attachUser, async (req, res) => {
  const row = await loadLinkedEmployee(req.user!.sub);
  if (!row) {
    return res.status(404).json({
      error: 'No employee profile is linked to your account. Ask Admin/HR to create or link your employee record.',
    });
  }

  const body = req.body || {};
  const phone = body.phone !== undefined ? String(body.phone || '').trim() : String(row.phone || '');
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  const location =
    body.location !== undefined || body.city !== undefined
      ? String(body.location ?? body.city ?? '').trim() || null
      : row.location;
  const state = body.state !== undefined ? String(body.state || '').trim() || null : row.state;
  const district = body.district !== undefined ? String(body.district || '').trim() || null : row.district;
  const country =
    body.country !== undefined ? String(body.country || '').trim() || null : row.country;
  const bio = body.bio !== undefined ? String(body.bio || '').trim() : String(row.bio || '');
  if (bio.length > 2000) return res.status(400).json({ error: 'Bio must be 2000 characters or fewer' });

  const skills =
    body.skills !== undefined ? parseStringList(body.skills).slice(0, 40) : parseStringList(row.skills);
  const experience =
    body.experience !== undefined
      ? normalizeExperience(body.experience).slice(0, 20)
      : normalizeExperience(row.experience);
  const qualifications =
    body.qualifications !== undefined
      ? normalizeQualifications(body.qualifications).slice(0, 20)
      : normalizeQualifications(row.qualifications);

  const me = await ensureAppUser(req);
  await query(
    `UPDATE employees SET phone=$1, location=$2, state=$3, district=$4, country=$5,
       bio=$6, skills=$7, experience=$8, qualifications=$9,
       updated_by=$10, updated_at=CURRENT_TIMESTAMP
     WHERE id=$11 AND tenant_id=$12`,
    [
      phone,
      location,
      state,
      district,
      country,
      bio || null,
      JSON.stringify(skills),
      JSON.stringify(experience),
      JSON.stringify(qualifications),
      me?.id ?? req.user!.sub,
      row.id,
      DEFAULT_TENANT,
    ],
  );

  if (me) {
    await writeAudit(me.id, me.name, 'Profile updated', 'Updated own employee profile', String(row.id), {
      moduleKey: 'employees',
      after: { phone, location, state, district, country, bio, skills, experience, qualifications },
    });
  }

  const next = await loadLinkedEmployee(req.user!.sub);
  res.json({ employee: mapEmployee(next || row, false) });
});

router.post(
  '/me/avatar',
  requireAuth,
  attachUser,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      next();
    });
  },
  async (req, res) => {
    const row = await loadLinkedEmployee(req.user!.sub);
    if (!row) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'No employee profile is linked to your account' });
    }
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    const filename = `${uuid().slice(0, 12)}${safeExt}`;
    const dest = path.join(avatarsDir, filename);
    fs.renameSync(req.file.path, dest);

    unlinkAvatarFile(row.avatar != null ? String(row.avatar) : null);
    const relative = path.join('avatars', filename);
    const me = await ensureAppUser(req);
    await query(
      `UPDATE employees SET avatar=$1, updated_by=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3 AND tenant_id=$4`,
      [relative, me?.id ?? req.user!.sub, row.id, DEFAULT_TENANT],
    );
    if (me) {
      await writeAudit(me.id, me.name, 'Profile photo updated', 'Uploaded profile photo', String(row.id), {
        moduleKey: 'employees',
      });
    }
    res.status(201).json({
      avatar: `/api/employees/${row.id}/avatar-file`,
      employee: mapEmployee({ ...row, avatar: relative }, false),
    });
  },
);

router.delete('/me/avatar', requireAuth, attachUser, async (req, res) => {
  const row = await loadLinkedEmployee(req.user!.sub);
  if (!row) return res.status(404).json({ error: 'No employee profile is linked to your account' });
  unlinkAvatarFile(row.avatar != null ? String(row.avatar) : null);
  const me = await ensureAppUser(req);
  await query(
    `UPDATE employees SET avatar=NULL, updated_by=$1, updated_at=CURRENT_TIMESTAMP
     WHERE id=$2 AND tenant_id=$3`,
    [me?.id ?? req.user!.sub, row.id, DEFAULT_TENANT],
  );
  if (me) {
    await writeAudit(me.id, me.name, 'Profile photo removed', 'Removed profile photo', String(row.id), {
      moduleKey: 'employees',
    });
  }
  res.json({ ok: true, avatar: null });
});

/** Serve employee avatar file — self or employees:read. Must be before /:id. */
router.get('/:id/avatar-file', requireAuth, attachUser, async (req, res) => {
  const row = await queryOne('SELECT id, user_id, avatar FROM employees WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const isSelf = row.user_id && String(row.user_id) === req.user!.sub;
  if (!isSelf) {
    const u = await ensureAppUser(req);
    const canRead = u != null && hasAction(u.permissions ?? {}, 'employees', 'read');
    if (!canRead && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const abs = resolveAvatarAbs(row.avatar != null ? String(row.avatar) : null);
  if (!abs) return res.status(404).json({ error: 'No photo' });
  res.setHeader('Cache-Control', 'private, max-age=120');
  res.sendFile(abs);
});

/** Organizational hierarchy for Admin/HR (and managers for their subtree). Must be before /:id. */
router.get('/hierarchy', requireAuth, attachUser, requirePermission('employees', 'read'), async (req, res) => {
  const role = req.user!.role;
  try {
    const { backfillEmployeeUserLinks } = await import('../lib/link-employee-user.js');
    await backfillEmployeeUserLinks();
  } catch {
    /* non-fatal */
  }
  const rows = await query(
    `SELECT e.id, e.user_id, e.name, e.email, e.department, e.position, e.designation, e.manager_user_id, e.manager, e.status,
            u.role AS user_role, m.name AS manager_name
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN users m ON m.id = e.manager_user_id
     WHERE e.tenant_id = $1
     ORDER BY e.department, e.name`,
    [DEFAULT_TENANT],
  );

  let list = rows.map((r) => ({
    id: Number(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    name: String(r.name),
    email: String(r.email),
    department: String(r.department || ''),
    position: String(r.position || r.designation || ''),
    designation: r.designation ? String(r.designation) : null,
    managerUserId: r.manager_user_id ? String(r.manager_user_id) : null,
    managerName: r.manager_name ? String(r.manager_name) : r.manager ? String(r.manager) : null,
    role: r.user_role ? String(r.user_role) : null,
    status: String(r.status || 'Active'),
  }));

  if (role === 'manager') {
    const teamIds = new Set(
      list.filter((e) => e.managerUserId === req.user!.sub).map((e) => e.userId).filter(Boolean) as string[],
    );
    list = list.filter((e) => e.userId === req.user!.sub || (e.userId && teamIds.has(e.userId)) || e.managerUserId === req.user!.sub);
  }

  const byUser = new Map(list.filter((e) => e.userId).map((e) => [e.userId as string, e]));
  const roots = list.filter((e) => !e.managerUserId || !byUser.has(e.managerUserId));
  const childrenOf = (managerUserId: string | null) =>
    list.filter((e) => (managerUserId ? e.managerUserId === managerUserId : !e.managerUserId));

  type Node = (typeof list)[number] & { reports: Node[] };
  const build = (managerUserId: string | null, depth = 0): Node[] => {
    if (depth > 8) return [];
    return childrenOf(managerUserId).map((e) => ({
      ...e,
      reports: e.userId ? build(e.userId, depth + 1) : [],
    }));
  };

  const treeRoots = roots.length ? roots : list;
  const tree: Node[] = treeRoots.map((r) => ({
    ...r,
    reports: r.userId ? build(r.userId, 1) : [],
  }));

  res.json({ employees: list, tree });
});

router.get('/:id', requireAuth, attachUser, requireSelfOrPermission('employees', 'read'), async (req, res) => {
  const row = await queryOne(
    `SELECT e.*, u.role AS user_role
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [req.params.id, DEFAULT_TENANT],
  );
  if (!row) return res.status(404).json({ error: 'Not found' });

  const role = req.user!.role;
  const isSelf = row.user_id === req.user!.sub;
  if (role === 'manager' && !isSelf) {
    const ok = await canViewEmployeeActivity(req.user!.sub, role, String(row.user_id || ''));
    // Also allow when this manager is the assigned reporting manager (covers employees without login)
    const isDirectReport = String(row.manager_user_id || '') === req.user!.sub;
    if (!ok && !isDirectReport) return res.status(403).json({ error: 'Forbidden' });
  }

  const u = await ensureAppUser(req);
  const canSeeOthersSalary =
    role === 'admin' || hasAction(u?.permissions ?? {}, 'employees', 'update');
  const hideSalary = !isSelf && !canSeeOthersSalary;
  res.json({ employee: mapEmployee(row, hideSalary) });
});

router.post('/', requireAuth, attachUser, requirePermission('employees', 'create'), async (req, res) => {
  const e = req.body || {};
  const email = String(e.email || '').trim().toLowerCase();
  const dup = await queryOne('SELECT id FROM employees WHERE tenant_id = $1 AND LOWER(email) = $2', [DEFAULT_TENANT, email]);
  if (dup) return res.status(409).json({ error: 'Employee with this email already exists' });

  const u = await ensureAppUser(req);
  const { linkEmployeeToUserByEmail } = await import('../lib/link-employee-user.js');
  let linkedUserId = e.userId ?? e.user_id ?? null;
  if (!linkedUserId) {
    linkedUserId = await linkEmployeeToUserByEmail(email);
  }
  const id = await insert(
    `INSERT INTO employees (tenant_id, user_id, name, email, phone, department, position, status, join_date, salary, location, state, district, country, avatar, manager, skills, manager_user_id, designation, employment_type, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      DEFAULT_TENANT,
      linkedUserId,
      e.name,
      email,
      e.phone ?? null,
      e.department,
      e.position,
      e.status ?? 'Active',
      e.joinDate ?? e.join_date ?? new Date().toISOString().slice(0, 10),
      e.salary ?? 0,
      e.location ?? e.city ?? null,
      e.state ?? null,
      e.district ?? null,
      e.country ?? null,
      e.avatar ?? null,
      e.manager ?? null,
      JSON.stringify(e.skills ?? []),
      e.managerUserId ?? e.manager_user_id ?? null,
      e.designation ?? e.position ?? null,
      e.employmentType ?? e.employment_type ?? 'full_time',
      u?.id ?? req.user!.sub,
      u?.id ?? req.user!.sub,
    ],
  );
  if (u) {
    await writeAudit(u.id, u.name, 'Employee created', `Created employee ${e.name}`, String(id), {
      moduleKey: 'employees',
      after: { name: e.name, email, department: e.department, status: e.status ?? 'Active' },
    });
  }
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, attachUser, requirePermission('employees', 'update'), async (req, res) => {
  const e = req.body || {};
  const before = await queryOne(
    'SELECT * FROM employees WHERE id = $1 AND tenant_id = $2',
    [req.params.id, DEFAULT_TENANT],
  );
  if (!before) return res.status(404).json({ error: 'Not found' });

  const pick = <T,>(val: T | undefined, fallback: T): T => (val !== undefined ? val : fallback);

  const emailRaw = e.email !== undefined ? String(e.email || '').trim().toLowerCase() : String(before.email).toLowerCase();
  if (e.email !== undefined) {
    const dup = await queryOne(
      'SELECT id FROM employees WHERE tenant_id = $1 AND LOWER(email) = $2 AND id <> $3',
      [DEFAULT_TENANT, emailRaw, req.params.id],
    );
    if (dup) return res.status(409).json({ error: 'Employee with this email already exists' });
  }

  const managerProvided = e.managerUserId !== undefined || e.manager_user_id !== undefined;
  let managerUserId: string | null = managerProvided
    ? (e.managerUserId ?? e.manager_user_id ?? null)
    : before.manager_user_id
      ? String(before.manager_user_id)
      : null;
  if (managerUserId === '' || managerUserId === 'none') managerUserId = null;

  let managerName: string | null =
    e.manager !== undefined ? (e.manager ? String(e.manager) : null) : before.manager ? String(before.manager) : null;

  if (managerProvided && managerUserId) {
    if (before.user_id && String(before.user_id) === String(managerUserId)) {
      return res.status(400).json({ error: 'An employee cannot report to themselves' });
    }
    const mgrUser = await queryOne<{ id: string; name: string; role: string; active: number }>(
      `SELECT id, name, role, active FROM users WHERE id = $1 AND tenant_id = $2`,
      [managerUserId, DEFAULT_TENANT],
    );
    if (!mgrUser || !Number(mgrUser.active)) {
      return res.status(400).json({ error: 'Reporting manager user not found or inactive' });
    }
    if (!['manager', 'admin', 'hr'].includes(String(mgrUser.role))) {
      return res.status(400).json({
        error: 'Reporting manager must have Manager, HR, or Admin role so approvals can route correctly',
      });
    }
    // Prevent simple cycles: manager's manager chain must not include this employee
    let walk: string | null = managerUserId;
    for (let i = 0; i < 12 && walk; i++) {
      const link = await queryOne<{ manager_user_id: string | null; user_id: string | null }>(
        `SELECT manager_user_id, user_id FROM employees WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
        [DEFAULT_TENANT, walk],
      );
      if (!link) break;
      if (before.user_id && String(link.manager_user_id || '') === String(before.user_id)) {
        return res.status(400).json({ error: 'That assignment would create a reporting cycle' });
      }
      walk = link.manager_user_id ? String(link.manager_user_id) : null;
    }
    if (e.manager === undefined) managerName = mgrUser.name;
  }

  const next = {
    name: String(pick(e.name, before.name)),
    email: emailRaw,
    phone: pick(e.phone, before.phone),
    department: String(pick(e.department, before.department)),
    position: String(pick(e.position, before.position)),
    status: String(pick(e.status, before.status)),
    salary: e.salary !== undefined && e.salary !== null ? Number(e.salary) : Number(before.salary ?? 0),
    location: pick(e.location ?? e.city, before.location),
    state: pick(e.state, before.state),
    district: pick(e.district, before.district),
    country: pick(e.country, before.country),
    designation: pick(e.designation, before.designation),
    employment_type: pick(e.employmentType ?? e.employment_type, before.employment_type),
    bio: e.bio !== undefined ? String(e.bio || '').trim() : String(before.bio || ''),
    skills: e.skills !== undefined ? parseStringList(e.skills).slice(0, 40) : parseStringList(before.skills),
    experience:
      e.experience !== undefined
        ? normalizeExperience(e.experience).slice(0, 20)
        : normalizeExperience(before.experience),
    qualifications:
      e.qualifications !== undefined
        ? normalizeQualifications(e.qualifications).slice(0, 20)
        : normalizeQualifications(before.qualifications),
  };

  const me = await ensureAppUser(req);
  const { linkEmployeeToUserByEmail } = await import('../lib/link-employee-user.js');
  const linkedUserId =
    before.user_id ||
    (await linkEmployeeToUserByEmail(next.email)) ||
    null;

  await query(
    `UPDATE employees SET name=$1, email=$2, phone=$3, department=$4, position=$5, status=$6, salary=$7,
       location=$8, state=$9, district=$10, country=$11,
       manager=$12, manager_user_id=$13, user_id=COALESCE($19, user_id),
       designation=COALESCE($14, designation), employment_type=COALESCE($15, employment_type),
       bio=$20, skills=$21, experience=$22, qualifications=$23,
       updated_by=$16, updated_at=CURRENT_TIMESTAMP
     WHERE id=$17 AND tenant_id=$18`,
    [
      next.name,
      next.email,
      next.phone,
      next.department,
      next.position,
      next.status,
      next.salary,
      next.location,
      next.state,
      next.district,
      next.country,
      managerProvided ? managerName : before.manager,
      managerProvided ? managerUserId : before.manager_user_id,
      next.designation ?? null,
      next.employment_type ?? null,
      me?.id ?? req.user!.sub,
      req.params.id,
      DEFAULT_TENANT,
      linkedUserId,
      next.bio || null,
      JSON.stringify(next.skills),
      JSON.stringify(next.experience),
      JSON.stringify(next.qualifications),
    ],
  );

  if (me) {
    const beforeSnap: Record<string, unknown> = {
      name: before.name,
      email: before.email,
      department: before.department,
      position: before.position,
      status: before.status,
      salary: before.salary,
      manager_user_id: before.manager_user_id,
    };
    const afterSnap: Record<string, unknown> = {
      name: next.name,
      email: next.email,
      department: next.department,
      position: next.position,
      status: next.status,
      salary: next.salary,
      manager_user_id: managerProvided ? managerUserId : before.manager_user_id,
    };
    const changes: string[] = [];
    for (const k of Object.keys(beforeSnap)) {
      if (String(beforeSnap[k] ?? '') !== String(afterSnap[k] ?? '')) {
        changes.push(`${k}: ${beforeSnap[k] ?? '—'} → ${afterSnap[k] ?? '—'}`);
      }
    }
    if (changes.length) {
      await writeAudit(
        me.id,
        me.name,
        'Employee updated',
        `Employee ${before.name}: ${changes.join('; ')}`,
        String(req.params.id),
        { moduleKey: 'employees', before: beforeSnap, after: afterSnap },
      );
    }
  }

  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requirePermission('employees', 'delete'), async (req, res) => {
  const before = await queryOne('SELECT * FROM employees WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  await query('DELETE FROM employees WHERE id = $1 AND tenant_id = $2', [req.params.id, DEFAULT_TENANT]);
  const me = await ensureAppUser(req);
  if (me && before) {
    await writeAudit(me.id, me.name, 'Employee deleted', `Deleted employee ${before.name}`, String(req.params.id), {
      moduleKey: 'employees',
      before: { name: before.name, email: before.email, department: before.department },
    });
  }
  res.json({ ok: true });
});

export default router;
