import { Router } from 'express';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getLeavePolicySettings } from '../lib/leave-policy.js';
import { runLeaveAutoApprove } from '../lib/leave-auto-approve.js';

export { runLeaveAutoApprove };

const router = Router();

export async function seedApprovalWorkflows() {
  const defaults = [
    { moduleKey: 'leave', name: 'Leave approval', role: 'manager' as const },
    { moduleKey: 'timesheet', name: 'Timesheet approval', role: 'hr' as const },
    { moduleKey: 'claim', name: 'Expense claim approval', role: 'manager' as const },
  ];
  for (const d of defaults) {
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM approval_workflows WHERE tenant_id = $1 AND module_key = $2',
      [DEFAULT_TENANT, d.moduleKey],
    );
    let workflowId = existing?.id;
    if (!workflowId) {
      workflowId = await insert(
        `INSERT INTO approval_workflows (tenant_id, module_key, name, active) VALUES ($1,$2,$3,1)`,
        [DEFAULT_TENANT, d.moduleKey, d.name],
      );
    }
    const step = await queryOne('SELECT id FROM approval_steps WHERE workflow_id = $1 AND step_order = 1', [
      workflowId,
    ]);
    if (!step) {
      await query(
        `INSERT INTO approval_steps (workflow_id, step_order, approver_role, label)
         VALUES ($1,1,$2,$3)`,
        [workflowId, d.role, `${d.name} — ${d.role === 'manager' ? 'Manager' : 'HR'}`],
      );
    }
  }
}

export async function createApprovalRequest(opts: {
  moduleKey: string;
  entityType: string;
  entityId: string | number;
  requesterId: string;
  payload?: unknown;
  preferredApproverRole?: string;
  preferredApproverUserId?: string;
}): Promise<number | null> {
  const wf = await queryOne<{ id: number; active: number }>(
    'SELECT id, active FROM approval_workflows WHERE tenant_id = $1 AND module_key = $2',
    [DEFAULT_TENANT, opts.moduleKey],
  );
  if (!wf || !Number(wf.active)) return null;

  // Prefer routing metadata inside payload (avoids mutating shared workflow steps)
  const payloadObj =
    opts.payload && typeof opts.payload === 'object'
      ? { ...(opts.payload as Record<string, unknown>) }
      : opts.payload != null
        ? { value: opts.payload }
        : {};
  if (opts.preferredApproverRole) payloadObj.preferredApproverRole = opts.preferredApproverRole;
  if (opts.preferredApproverUserId) payloadObj.preferredApproverUserId = opts.preferredApproverUserId;

  // When HR is preferred (no manager), ensure step 1 can be HR for this workflow if only manager exists
  if (opts.preferredApproverRole === 'hr' && !opts.preferredApproverUserId) {
    const step1 = await queryOne<{ id: number; approver_role: string }>(
      'SELECT id, approver_role FROM approval_steps WHERE workflow_id = $1 AND step_order = 1',
      [wf.id],
    );
    if (step1 && step1.approver_role === 'manager') {
      // leave step as manager; inbox falls back to HR/admin when no manager assigned
      payloadObj.preferredApproverRole = 'hr';
    }
  }

  const id = await insert(
    `INSERT INTO approval_requests
     (tenant_id, workflow_id, module_key, entity_type, entity_id, requester_id, status, current_step, payload)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',1,$7)`,
    [
      DEFAULT_TENANT,
      wf.id,
      opts.moduleKey,
      opts.entityType,
      String(opts.entityId),
      opts.requesterId,
      JSON.stringify(payloadObj),
    ],
  );
  return id;
}

function mapWorkflow(r: Record<string, unknown>, steps: Record<string, unknown>[]) {
  return {
    id: r.id,
    moduleKey: r.module_key,
    name: r.name,
    active: Boolean(Number(r.active)),
    escalationHours: r.escalation_hours,
    createdAt: r.created_at,
    steps: steps.map((s) => ({
      id: s.id,
      stepOrder: s.step_order,
      approverRole: s.approver_role,
      approverUserId: s.approver_user_id,
      label: s.label,
    })),
  };
}

router.get('/workflows', requireAuth, requirePermission('settings', 'read'), async (_req, res) => {
  await seedApprovalWorkflows();
  const workflows = await query('SELECT * FROM approval_workflows WHERE tenant_id = $1 ORDER BY module_key', [
    DEFAULT_TENANT,
  ]);
  const result = [];
  for (const w of workflows) {
    const steps = await query('SELECT * FROM approval_steps WHERE workflow_id = $1 ORDER BY step_order', [w.id]);
    result.push(mapWorkflow(w as Record<string, unknown>, steps as Record<string, unknown>[]));
  }
  res.json({ workflows: result });
});

router.put('/workflows/:id', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const row = await queryOne('SELECT * FROM approval_workflows WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await query(
    `UPDATE approval_workflows SET
       name = COALESCE($1, name),
       active = COALESCE($2, active),
       escalation_hours = COALESCE($3, escalation_hours)
     WHERE id = $4`,
    [
      b.name ?? null,
      b.active === undefined ? null : b.active ? 1 : 0,
      b.escalationHours ?? null,
      req.params.id,
    ],
  );
  if (Array.isArray(b.steps)) {
    await query('DELETE FROM approval_steps WHERE workflow_id = $1', [req.params.id]);
    for (const s of b.steps as {
      stepOrder?: number;
      approverRole?: string;
      approverUserId?: string;
      label?: string;
    }[]) {
      await query(
        `INSERT INTO approval_steps (workflow_id, step_order, approver_role, approver_user_id, label)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, s.stepOrder ?? 1, s.approverRole || 'hr', s.approverUserId ?? null, s.label ?? null],
      );
    }
  }
  res.json({ ok: true });
});

router.get('/run-auto-approve', requireAuth, requirePermission('settings', 'update'), async (_req, res) => {
  const result = await runLeaveAutoApprove();
  res.json(result);
});

router.get('/inbox', requireAuth, async (req, res) => {
  const role = req.user!.role;
  const userId = req.user!.sub;

  const rows = await query(
    `SELECT ar.*, aw.name AS workflow_name,
            s.approver_role, s.approver_user_id, s.label AS step_label,
            u.name AS requester_name
     FROM approval_requests ar
     JOIN approval_workflows aw ON aw.id = ar.workflow_id
     JOIN approval_steps s ON s.workflow_id = ar.workflow_id AND s.step_order = ar.current_step
     LEFT JOIN users u ON u.id = ar.requester_id
     LEFT JOIN employees emp ON emp.tenant_id = ar.tenant_id AND emp.user_id = ar.requester_id
     WHERE ar.tenant_id = $1 AND ar.status = 'pending'
       AND (
         (s.approver_user_id IS NOT NULL AND s.approver_user_id = $2)
         OR (s.approver_user_id IS NULL AND s.approver_role = $3)
         OR ($3 = 'admin')
         OR ($3 = 'hr' AND s.approver_role IN ('hr','manager'))
         OR (
           $3 = 'manager'
           AND s.approver_role = 'manager'
           AND emp.manager_user_id = $2
         )
         OR (
           JSON_UNQUOTE(JSON_EXTRACT(ar.payload, '$.preferredApproverUserId')) = $2
         )
       )
     ORDER BY ar.created_at DESC`,
    [DEFAULT_TENANT, userId, role],
  );

  res.json({
    inbox: rows.map((r) => {
      let payload: Record<string, unknown> | null = null;
      if (r.payload != null) {
        if (typeof r.payload === 'object') payload = r.payload as Record<string, unknown>;
        else if (typeof r.payload === 'string') {
          try {
            payload = JSON.parse(r.payload) as Record<string, unknown>;
          } catch {
            payload = null;
          }
        }
      }
      const typeLabel =
        (payload?.type != null ? String(payload.type) : null) ||
        (r.module_key === 'leave'
          ? 'Leave Request'
          : r.module_key === 'timesheet'
            ? 'Timesheet'
            : r.module_key === 'claim'
              ? 'Expense Claim'
              : String(r.workflow_name ?? r.module_key));
      return {
        id: r.id,
        workflowId: r.workflow_id,
        workflowName: r.workflow_name,
        moduleKey: r.module_key,
        entityType: r.entity_type,
        entityId: r.entity_id,
        requesterId: r.requester_id,
        requesterName: r.requester_name ?? r.requester_id,
        typeLabel,
        status: r.status,
        currentStep: r.current_step,
        payload,
        stepLabel: r.step_label,
        createdAt: r.created_at,
      };
    }),
  });
});

router.post('/:id/action', requireAuth, async (req, res) => {
  const { action, comment } = req.body || {};
  if (!['approve', 'reject', 'request_changes'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const ar = await queryOne(
    `SELECT ar.*, s.approver_role, s.approver_user_id
     FROM approval_requests ar
     JOIN approval_steps s ON s.workflow_id = ar.workflow_id AND s.step_order = ar.current_step
     WHERE ar.id = $1 AND ar.tenant_id = $2`,
    [req.params.id, DEFAULT_TENANT],
  );
  if (!ar) return res.status(404).json({ error: 'Not found' });
  if (ar.status !== 'pending') return res.status(400).json({ error: 'Request already decided' });
  if (ar.requester_id === req.user!.sub) {
    return res.status(403).json({ error: 'Cannot approve your own request' });
  }

  const settings = await getLeavePolicySettings();
  const needsComment =
    ar.module_key === 'leave' || settings.requireApprovalComment || ar.module_key === 'claim';
  if (needsComment && !String(comment || '').trim()) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  const role = req.user!.role;
  let allowed =
    role === 'admin' ||
    (ar.approver_user_id && ar.approver_user_id === req.user!.sub) ||
    (!ar.approver_user_id && ar.approver_role === role) ||
    (role === 'hr' && ar.approver_role === 'manager');
  if (role === 'manager' && ar.approver_role === 'manager' && !ar.approver_user_id) {
    const emp = await queryOne(
      'SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2 AND manager_user_id = $3',
      [DEFAULT_TENANT, ar.requester_id, req.user!.sub],
    );
    allowed = Boolean(emp);
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  await query(
    `INSERT INTO approval_actions (request_id, step_order, actor_id, action, comment)
     VALUES ($1,$2,$3,$4,$5)`,
    [ar.id, ar.current_step, req.user!.sub, action, comment ?? null],
  );

  if (action === 'approve') {
    const next = await queryOne(
      'SELECT step_order FROM approval_steps WHERE workflow_id = $1 AND step_order > $2 ORDER BY step_order LIMIT 1',
      [ar.workflow_id, ar.current_step],
    );
    if (next) {
      await query(`UPDATE approval_requests SET current_step = $1, updated_at = NOW() WHERE id = $2`, [
        next.step_order,
        ar.id,
      ]);
    } else {
      await query(`UPDATE approval_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`, [ar.id]);
      if (ar.module_key === 'leave' && ar.entity_type === 'leave_request') {
        const leave = await queryOne('SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2', [
          ar.entity_id,
          DEFAULT_TENANT,
        ]);
        if (leave && leave.status === 'Pending') {
          const reviewer = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [
            req.user!.sub,
          ]);
          await query(`UPDATE leave_requests SET status = 'Approved', comment = $1, decided_by = $2 WHERE id = $3`, [
            comment ?? null,
            reviewer?.name,
            ar.entity_id,
          ]);
          if (leave.leave_type_id) {
            const year = new Date(String(leave.start_date)).getFullYear();
            await query(
              `UPDATE leave_balances SET used = used + $1
               WHERE tenant_id = $2 AND user_id = $3 AND leave_type_id = $4 AND year = $5`,
              [leave.days, DEFAULT_TENANT, leave.user_id, leave.leave_type_id, year],
            );
          }
        }
      }
      if (ar.module_key === 'claim' && ar.entity_type === 'expense_claim') {
        await query(
          `UPDATE expense_claims SET status = 'approved', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
          [ar.entity_id],
        );
      }
    }
  } else if (action === 'reject') {
    await query(`UPDATE approval_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [ar.id]);
    if (ar.module_key === 'leave' && ar.entity_type === 'leave_request') {
      const reviewer = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
      await query(
        `UPDATE leave_requests SET status = 'Rejected', comment = $1, decided_by = $2 WHERE id = $3 AND status = 'Pending'`,
        [comment ?? null, reviewer?.name, ar.entity_id],
      );
    }
    if (ar.module_key === 'claim' && ar.entity_type === 'expense_claim') {
      await query(
        `UPDATE expense_claims SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [ar.entity_id],
      );
    }
  } else {
    await query(`UPDATE approval_requests SET status = 'changes_requested', updated_at = NOW() WHERE id = $1`, [
      ar.id,
    ]);
    if (ar.module_key === 'claim' && ar.entity_type === 'expense_claim') {
      await query(
        `UPDATE expense_claims SET status = 'clarification', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [ar.entity_id],
      );
      await query(
        `INSERT INTO expense_claim_actions (claim_id, actor_id, action, comment) VALUES ($1,$2,'clarification',$3)`,
        [ar.entity_id, req.user!.sub, String(comment || '').trim()],
      );
    }
  }

  // Notify requester with structured detail (deduped)
  const { createNotice } = await import('../lib/notices-helper.js');
  const actor = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.user!.sub]);
  const statusWord =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs changes';
  const kind = ar.module_key === 'claim' ? 'claim' : ar.module_key === 'leave' ? 'leave' : 'approval';
  let detail = `${String(ar.module_key)} #${ar.entity_id}`;
  if (ar.module_key === 'leave') {
    const leave = await queryOne(
      'SELECT type, start_date, end_date, days, reason FROM leave_requests WHERE id = $1',
      [ar.entity_id],
    );
    if (leave) {
      detail = `${leave.type} leave (${leave.days} day(s), ${leave.start_date} → ${leave.end_date}). Reason: ${leave.reason || '—'}`;
    }
  } else if (ar.module_key === 'claim') {
    const claim = await queryOne(
      `SELECT c.amount, c.expense_date, c.description, cat.name AS category_name
       FROM expense_claims c LEFT JOIN expense_categories cat ON cat.id = c.category_id WHERE c.id = $1`,
      [ar.entity_id],
    );
    if (claim) {
      detail = `${claim.category_name || 'Expense'} claim of ${claim.amount} on ${claim.expense_date}: ${claim.description}`;
    }
  }
  await createNotice({
    userId: String(ar.requester_id),
    title: `Request ${statusWord}`,
    body: `Your ${detail} was ${statusWord} by ${actor?.name ?? 'approver'}. Comment: ${String(comment || '').trim() || '—'}`,
    kind: kind as 'leave' | 'claim' | 'approval',
    id: `n-apdec-${ar.id}-${action}`.slice(0, 32),
  });

  // Mirror claim approve/reject into expense_claim_actions when decided via inbox
  if (ar.module_key === 'claim' && (action === 'approve' || action === 'reject')) {
    await query(
      `INSERT INTO expense_claim_actions (claim_id, actor_id, action, comment) VALUES ($1,$2,$3,$4)`,
      [ar.entity_id, req.user!.sub, action, String(comment || '').trim()],
    );
  }

  res.json({ ok: true });
});

/** Employee-wise and team-wise approval history for Admin/HR/Manager */
router.get('/history', requireAuth, async (req, res) => {
  const role = req.user!.role;
  if (!['admin', 'hr', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const userId = req.query.userId ? String(req.query.userId) : null;
  const moduleKey = req.query.moduleKey ? String(req.query.moduleKey) : null;
  const limit = Math.min(Number(req.query.limit) || 100, 300);

  let sql = `
    SELECT ar.id, ar.module_key, ar.entity_type, ar.entity_id, ar.status, ar.created_at, ar.updated_at,
           ar.requester_id, u.name AS requester_name, e.department, e.manager_user_id,
           aa.action AS last_action, aa.comment AS last_comment, aa.actor_id AS last_actor_id,
           actor.name AS last_actor_name, aa.created_at AS decided_at
    FROM approval_requests ar
    LEFT JOIN users u ON u.id = ar.requester_id
    LEFT JOIN employees e ON e.tenant_id = ar.tenant_id AND e.user_id = ar.requester_id
    LEFT JOIN approval_actions aa ON aa.id = (
      SELECT MAX(a2.id) FROM approval_actions a2 WHERE a2.request_id = ar.id
    )
    LEFT JOIN users actor ON actor.id = aa.actor_id
    WHERE ar.tenant_id = $1`;
  const params: unknown[] = [DEFAULT_TENANT];
  let i = 2;

  if (role === 'manager') {
    sql += ` AND e.manager_user_id = $${i++}`;
    params.push(req.user!.sub);
  }
  if (userId) {
    sql += ` AND ar.requester_id = $${i++}`;
    params.push(userId);
  }
  if (moduleKey) {
    sql += ` AND ar.module_key = $${i++}`;
    params.push(moduleKey);
  }
  sql += ` ORDER BY ar.created_at DESC LIMIT $${i}`;
  params.push(limit);

  const rows = await query(sql, params);
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      moduleKey: r.module_key,
      entityType: r.entity_type,
      entityId: r.entity_id,
      status: r.status,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      department: r.department,
      managerUserId: r.manager_user_id,
      lastAction: r.last_action,
      lastComment: r.last_comment,
      lastActorId: r.last_actor_id,
      lastActorName: r.last_actor_name,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

export default router;
