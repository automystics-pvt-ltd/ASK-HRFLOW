import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { getLeavePolicySettings } from './leave-policy.js';
import { isoDate } from './dates.js';

/**
 * Auto-approve leave requests pending longer than configured days.
 * Never runs for expense claims. Validates balance/overlap before approving.
 */
export async function runLeaveAutoApprove(): Promise<{ processed: number; approved: number; skipped: number }> {
  const settings = await getLeavePolicySettings();
  if (!settings.autoApproveEnabled) return { processed: 0, approved: 0, skipped: 0 };

  const days = Math.max(1, settings.autoApproveDays || 20);
  const pending = await query(
    `SELECT * FROM leave_requests
     WHERE tenant_id = $1 AND status = 'Pending'
       AND created_at <= DATE_SUB(NOW(), INTERVAL ${days} DAY)
       AND COALESCE(auto_approved, 0) = 0
     ORDER BY created_at ASC
     LIMIT 50`,
    [DEFAULT_TENANT],
  );

  let approved = 0;
  let skipped = 0;

  for (const row of pending) {
    const start = isoDate(row.start_date as Date | string);
    const end = isoDate(row.end_date as Date | string);
    const dayCount = Number(row.days);

    // Overlap with other approved leave
    const overlap = await queryOne(
      `SELECT id FROM leave_requests WHERE tenant_id = $1 AND user_id = $2 AND status = 'Approved'
       AND id <> $3 AND NOT (end_date < $4 OR start_date > $5) LIMIT 1`,
      [DEFAULT_TENANT, row.user_id, row.id, start, end],
    );
    if (overlap) {
      skipped += 1;
      continue;
    }

    // Balance check
    if (row.leave_type_id) {
      const year = new Date(start).getFullYear();
      const bal = await queryOne<{ allocated: string | number; used: string | number }>(
        `SELECT allocated, used FROM leave_balances
         WHERE tenant_id = $1 AND user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [DEFAULT_TENANT, row.user_id, row.leave_type_id, year],
      );
      if (bal && Number(bal.used) + dayCount > Number(bal.allocated)) {
        skipped += 1;
        continue;
      }
    }

    const reason = `Automatically approved after exceeding the configured ${days}-day approval period.`;

    await query(
      `UPDATE leave_requests
       SET status = 'Approved', comment = $1, decided_by = 'System', auto_approved = 1
       WHERE id = $2 AND status = 'Pending'`,
      [reason, row.id],
    );

    if (row.leave_type_id) {
      const year = new Date(start).getFullYear();
      await query(
        `UPDATE leave_balances SET used = used + $1
         WHERE tenant_id = $2 AND user_id = $3 AND leave_type_id = $4 AND year = $5`,
        [dayCount, DEFAULT_TENANT, row.user_id, row.leave_type_id, year],
      );
    }

    await query(
      `UPDATE approval_requests
       SET status = 'approved', updated_at = NOW()
       WHERE tenant_id = $1 AND module_key = 'leave' AND entity_type = 'leave_request'
         AND entity_id = $2 AND status = 'pending'`,
      [DEFAULT_TENANT, String(row.id)],
    );

    // Notify employee, manager, HR
    const emp = await queryOne<{ manager_user_id: string | null }>(
      'SELECT manager_user_id FROM employees WHERE tenant_id = $1 AND user_id = $2',
      [DEFAULT_TENANT, row.user_id],
    );
    const recipients = new Set<string>([String(row.user_id)]);
    if (emp?.manager_user_id) recipients.add(String(emp.manager_user_id));
    const hrs = await query<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('hr','admin') AND active = 1`,
      [DEFAULT_TENANT],
    );
    for (const h of hrs) recipients.add(String(h.id));

    for (const uid of recipients) {
      await query(
        `INSERT INTO notices (id, tenant_id, user_id, title, body, kind, read_by)
         VALUES ($1,$2,$3,$4,$5,'approval','[]')`,
        [
          `n-auto-${row.id}-${uid}`.slice(0, 32),
          DEFAULT_TENANT,
          uid,
          'Leave auto-approved',
          `Leave request #${row.id} for ${row.employee_name} was auto-approved: ${reason}`,
        ],
      );
    }

    approved += 1;
  }

  return { processed: pending.length, approved, skipped };
}
