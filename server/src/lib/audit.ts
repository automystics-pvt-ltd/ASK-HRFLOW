import { v4 as uuid } from 'uuid';
import { query, DEFAULT_TENANT } from '../db.js';

export async function writeAudit(
  actorId: string,
  actorName: string,
  event: string,
  detail: string,
  targetId?: string,
) {
  await query(
    `INSERT INTO audit_logs (id, tenant_id, actor_id, actor_name, event, detail, target_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uuid().slice(0, 12), DEFAULT_TENANT, actorId, actorName, event, detail, targetId ?? null],
  );
}