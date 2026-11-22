import { DEFAULT_TENANT, query, queryOne } from '../db.js';

/** Employees (user_ids) reporting to this manager. */
export async function teamUserIds(managerUserId: string): Promise<string[]> {
  const rows = await query<{ user_id: string | null }>(
    `SELECT user_id FROM employees
     WHERE tenant_id = $1 AND manager_user_id = $2 AND user_id IS NOT NULL`,
    [DEFAULT_TENANT, managerUserId],
  );
  return rows.map((r) => String(r.user_id)).filter(Boolean);
}

export async function isManagerOf(managerUserId: string, employeeUserId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2 AND manager_user_id = $3 LIMIT 1`,
    [DEFAULT_TENANT, employeeUserId, managerUserId],
  );
  return Boolean(row);
}

export async function getEmployeeManagerUserId(employeeUserId: string): Promise<string | null> {
  const row = await queryOne<{ manager_user_id: string | null }>(
    `SELECT manager_user_id FROM employees WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
    [DEFAULT_TENANT, employeeUserId],
  );
  return row?.manager_user_id ? String(row.manager_user_id) : null;
}

export async function canViewEmployeeActivity(
  viewerId: string,
  viewerRole: string,
  targetUserId: string,
): Promise<boolean> {
  if (viewerId === targetUserId) return true;
  if (viewerRole === 'admin' || viewerRole === 'hr') return true;
  if (viewerRole === 'manager') return isManagerOf(viewerId, targetUserId);
  return false;
}
