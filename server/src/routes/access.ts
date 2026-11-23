import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { attachUser, requireAuth } from '../middleware/auth.js';
import { ensureAppUser, requirePermission } from '../middleware/rbac.js';
import { defaultRolePermissions, type Action, type PermissionSet, type Role } from '../lib/permissions.js';
import { getFullUser, toAppUser } from '../lib/users.js';
import { writeAudit } from '../lib/audit.js';
import { generateTempPassword, hashPassword } from '../lib/password.js';

const router = Router();
const departments = ['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance'];

router.get('/users', requireAuth, requirePermission('access', 'read'), async (_req, res) => {
  const rows = await query(
    'SELECT id, name, email, role, department, active, department_access, last_login FROM users WHERE tenant_id = $1 ORDER BY name',
    [DEFAULT_TENANT],
  );
  const users = await Promise.all(
    rows.map(async (r) => {
      const full = await getFullUser(String(r.id));
      return full ?? toAppUser(r);
    }),
  );
  res.json({ users });
});

router.get('/permissions', requireAuth, async (_req, res) => {
  const rows = await query('SELECT role, module_id, actions FROM role_permissions WHERE tenant_id = $1', [DEFAULT_TENANT]);
  const roleTemplates: Record<Role, PermissionSet> = {
    admin: { ...defaultRolePermissions.admin },
    hr: { ...defaultRolePermissions.hr },
    manager: { ...defaultRolePermissions.manager },
    employee: { ...defaultRolePermissions.employee },
  };
  for (const r of rows) {
    const actions = Array.isArray(r.actions) ? r.actions : JSON.parse(String(r.actions));
    roleTemplates[r.role as Role][r.module_id as string] = actions;
  }
  res.json({ roleTemplates });
});

router.put('/permissions/:role', requireAuth, attachUser, requirePermission('access', 'update'), async (req, res) => {
  const me = await ensureAppUser(req);
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Only admin can edit role templates' });
  const role = req.params.role as Role;
  if (!['admin', 'hr', 'employee', 'manager'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'admin') return res.status(400).json({ error: 'Admin permissions are fixed' });

  const permissions = (req.body?.permissions ?? req.body) as PermissionSet;
  if (!permissions || typeof permissions !== 'object') return res.status(400).json({ error: 'Missing permissions' });

  await query('DELETE FROM role_permissions WHERE tenant_id = $1 AND role = $2', [DEFAULT_TENANT, role]);
  for (const [moduleId, actions] of Object.entries(permissions)) {
    if ((actions as Action[]).length) {
      await query(
        `INSERT INTO role_permissions (tenant_id, role, module_id, actions)
         VALUES ($1, $2, $3, $4)`,
        [DEFAULT_TENANT, role, moduleId, JSON.stringify(actions)],
      );
    }
  }
  if (me) await writeAudit(me.id, me.name, 'Role template updated', `Updated ${role} template`);
  res.json({ ok: true });
});

router.patch('/users/:id', requireAuth, attachUser, requirePermission('access', 'update'), async (req, res) => {
  const target = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Not found' });
  const me = await ensureAppUser(req);

  const { role, active, departmentAccess, permissions } = req.body || {};
  if (role === 'admin' && me?.role !== 'admin') return res.status(403).json({ error: 'Only admin can assign admin role' });
  if (target.role === 'admin' && me?.role !== 'admin') return res.status(403).json({ error: 'Only admin can change admin accounts' });
  if (req.params.id === req.user!.sub && active === false) return res.status(400).json({ error: 'Cannot deactivate yourself' });

  if (role) await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
  if (typeof active === 'boolean') await query('UPDATE users SET active = $1 WHERE id = $2', [active ? 1 : 0, req.params.id]);
  if (departmentAccess) {
    await query('UPDATE users SET department_access = $1 WHERE id = $2', [
      JSON.stringify(departmentAccess),
      req.params.id,
    ]);
  }

  if (permissions && target.role !== 'admin') {
    await query('DELETE FROM user_permissions WHERE user_id = $1', [req.params.id]);
    for (const [moduleId, actions] of Object.entries(permissions as PermissionSet)) {
      if ((actions as Action[]).length) {
        await query(
          'INSERT INTO user_permissions (tenant_id, user_id, module_id, actions) VALUES ($1,$2,$3,$4)',
          [DEFAULT_TENANT, req.params.id, moduleId, JSON.stringify(actions)],
        );
      }
    }
  }

  if (me) await writeAudit(me.id, me.name, 'Access updated', `Updated user ${target.name}`, req.params.id);
  const user = await getFullUser(req.params.id);
  res.json({ user });
});

router.post('/users', requireAuth, attachUser, requirePermission('access', 'create'), async (req, res) => {
  const { name, email, role, department, password } = req.body || {};
  if (!name || !email || !role || !department) return res.status(400).json({ error: 'Missing fields' });
  const me = await ensureAppUser(req);
  if (role === 'admin' && me?.role !== 'admin') return res.status(403).json({ error: 'Only admin can create admin' });

  const exists = await queryOne('SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)', [
    DEFAULT_TENANT,
    email,
  ]);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const id = 'u-' + uuid().slice(0, 8);
  const temporaryPassword = password ? String(password) : generateTempPassword();
  const hash = await hashPassword(temporaryPassword);
  const deptAccess =
    role === 'admin' ? departments : role === 'hr' ? [department, 'HR', 'Engineering'] : [];

  await query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, department, active, department_access, must_change_password, password_changed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,1,NOW())`,
    [id, DEFAULT_TENANT, name.trim(), email.trim().toLowerCase(), hash, role, department, JSON.stringify(deptAccess)],
  );

  if (me) await writeAudit(me.id, me.name, 'User created', `Created ${name}`, id);
  const user = await getFullUser(id);
  // temporaryPassword returned once — never stored in plaintext
  res.status(201).json({ user, temporaryPassword });
});

export default router;
