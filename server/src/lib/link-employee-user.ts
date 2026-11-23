import { DEFAULT_TENANT, query, queryOne } from '../db.js';

/** Link an employee row to a login user by matching email (case-insensitive). */
export async function linkEmployeeToUserByEmail(email: string, preferredUserId?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  let userId = preferredUserId ? String(preferredUserId) : null;
  if (!userId) {
    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 LIMIT 1`,
      [DEFAULT_TENANT, normalized],
    );
    userId = user?.id ?? null;
  }
  if (!userId) return null;

  await query(
    `UPDATE employees SET user_id = $1
     WHERE tenant_id = $2 AND LOWER(email) = $3
       AND (user_id IS NULL OR user_id = '' OR user_id = $1)`,
    [userId, DEFAULT_TENANT, normalized],
  );
  return userId;
}

/** Backfill user_id for employees whose email matches a user account. */
export async function backfillEmployeeUserLinks(): Promise<number> {
  const orphans = await query<{ id: number; email: string }>(
    `SELECT id, email FROM employees
     WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = '')`,
    [DEFAULT_TENANT],
  );
  let linked = 0;
  for (const row of orphans) {
    const id = await linkEmployeeToUserByEmail(String(row.email));
    if (id) linked += 1;
  }
  return linked;
}
