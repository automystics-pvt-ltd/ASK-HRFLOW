import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';

export type NoticeKind = 'approval' | 'leave' | 'claim' | 'announcement' | 'system';

/** Create a notice for one user. Uses a stable id when provided to prevent duplicates. */
export async function createNotice(opts: {
  userId: string;
  title: string;
  body: string;
  kind?: NoticeKind;
  /** Stable id (max 32 chars). Re-inserts are ignored via INSERT IGNORE / existing check. */
  id?: string;
}) {
  const id = (opts.id || `n-${uuid()}`.replace(/-/g, '')).slice(0, 32);
  const existing = await queryOne('SELECT id FROM notices WHERE id = $1', [id]);
  if (existing) return id;
  await query(
    `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by)
     VALUES ($1,$2,$3,$4,$5,$6,'[]')`,
    [id, DEFAULT_TENANT, opts.userId, opts.title, opts.body, opts.kind || 'approval'],
  );
  return id;
}

export async function notifyUserIds(
  userIds: Array<string | null | undefined>,
  title: string,
  body: string,
  kind: NoticeKind,
  idPrefix: string,
) {
  const unique = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  for (const uid of unique) {
    await createNotice({
      userId: uid,
      title,
      body,
      kind,
      id: `${idPrefix}-${uid}`.slice(0, 32),
    });
  }
}

export async function activeUsersByRoles(roles: Array<'admin' | 'hr' | 'manager' | 'employee'>) {
  if (!roles.length) return [] as { id: string; role: string; name: string }[];
  const placeholders = roles.map((_, i) => `$${i + 2}`).join(',');
  return query<{ id: string; role: string; name: string }>(
    `SELECT id, role, name FROM users
     WHERE tenant_id = $1 AND active = 1 AND role IN (${placeholders})`,
    [DEFAULT_TENANT, ...roles],
  );
}
