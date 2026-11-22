import { query, queryOne, DEFAULT_TENANT } from '../db.js';
import type { Action, PermissionSet, Role } from './permissions.js';
import { defaultRolePermissions, hasAction } from './permissions.js';

const departments = ['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance'];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  active: boolean;
  departmentAccess: string[];
  permissions?: PermissionSet;
  lastLogin?: string;
}

export function toAppUser(row: Record<string, unknown>, permissions?: PermissionSet): AppUser {
  let departmentAccess = departments;
  if (row.department_access) {
    departmentAccess = Array.isArray(row.department_access)
      ? (row.department_access as string[])
      : JSON.parse(String(row.department_access));
  }
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    department: String(row.department),
    active: Boolean(row.active),
    departmentAccess,
    permissions,
    lastLogin: row.last_login ? new Date(String(row.last_login)).toISOString() : undefined,
  };
}

export async function loadUserPermissions(userId: string, role: Role): Promise<PermissionSet> {
  if (role === 'admin') return defaultRolePermissions.admin;

  const overrides = await query<{ module_id: string; actions: Action[] }>(
    `SELECT module_id, actions FROM user_permissions WHERE tenant_id = $1 AND user_id = $2`,
    [DEFAULT_TENANT, userId],
  );

  if (overrides.length > 0) {
    const set: PermissionSet = { ...defaultRolePermissions[role] };
    for (const row of overrides) {
      const actions = Array.isArray(row.actions) ? row.actions : (JSON.parse(String(row.actions)) as Action[]);
      set[row.module_id] = actions;
    }
    return set;
  }

  const rows = await query<{ module_id: string; actions: Action[] }>(
    `SELECT module_id, actions FROM role_permissions WHERE tenant_id = $1 AND role = $2`,
    [DEFAULT_TENANT, role],
  );

  if (rows.length === 0) return defaultRolePermissions[role];

  const set: PermissionSet = { ...emptyPerms() };
  for (const row of rows) {
    const actions = Array.isArray(row.actions) ? row.actions : (JSON.parse(String(row.actions)) as Action[]);
    set[row.module_id] = actions;
  }
  return set;
}

function emptyPerms(): PermissionSet {
  return JSON.parse(JSON.stringify(defaultRolePermissions.employee)) as PermissionSet;
}

export async function getFullUser(userId: string): Promise<AppUser | null> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE id = $1 AND tenant_id = $2',
    [userId, DEFAULT_TENANT],
  );
  if (!row) return null;
  const permissions = await loadUserPermissions(userId, row.role as Role);
  return toAppUser(row, permissions);
}

export async function userCan(userId: string, role: Role, module: string, action: Action): Promise<boolean> {
  const perms = await loadUserPermissions(userId, role);
  return hasAction(perms, module, action);
}