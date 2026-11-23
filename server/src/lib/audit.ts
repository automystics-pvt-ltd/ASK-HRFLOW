import { v4 as uuid } from 'uuid';
import { query, DEFAULT_TENANT } from '../db.js';

export type AuditExtra = {
  moduleKey?: string;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(
  actorId: string,
  actorName: string,
  event: string,
  detail: string,
  targetId?: string,
  extra?: AuditExtra,
) {
  const moduleKey = extra?.moduleKey ?? null;
  const beforeJson = extra?.before != null ? JSON.stringify(extra.before) : null;
  const afterJson = extra?.after != null ? JSON.stringify(extra.after) : null;
  try {
    await query(
      `INSERT INTO audit_logs (id, tenant_id, actor_id, actor_name, event, detail, target_id, module_key, before_json, after_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uuid().slice(0, 12),
        DEFAULT_TENANT,
        actorId,
        actorName,
        event,
        detail,
        targetId ?? null,
        moduleKey,
        beforeJson,
        afterJson,
      ],
    );
  } catch {
    // Fallback if migration columns not yet present
    await query(
      `INSERT INTO audit_logs (id, tenant_id, actor_id, actor_name, event, detail, target_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuid().slice(0, 12), DEFAULT_TENANT, actorId, actorName, event, detail, targetId ?? null],
    );
  }
}
