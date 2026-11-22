import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, insert, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { getEmployeeManagerUserId, teamUserIds } from '../lib/team.js';
import { createApprovalRequest } from './approvals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

const router = Router();

function mapCategory(r: Record<string, unknown>) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    maxAmount: r.max_amount != null ? Number(r.max_amount) : null,
    monthlyLimit: r.monthly_limit != null ? Number(r.monthly_limit) : null,
    annualLimit: r.annual_limit != null ? Number(r.annual_limit) : null,
    requireReceipt: Boolean(Number(r.require_receipt ?? 1)),
    active: Boolean(Number(r.active ?? 1)),
  };
}

function mapClaim(r: Record<string, unknown>) {
  return {
    id: r.id,
    userId: r.user_id,
    employeeId: r.employee_id,
    categoryId: r.category_id,
    categoryName: r.category_name,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    description: r.description,
    receiptPath: r.receipt_path,
    status: r.status,
    approvedAmount: r.approved_amount != null ? Number(r.approved_amount) : null,
    paymentStatus: r.payment_status,
    currentApproverId: r.current_approver_id,
    createdAt: r.created_at,
    employeeName: r.employee_name ?? r.user_name,
  };
}

router.get('/categories', requireAuth, async (_req, res) => {
  const rows = await query(
    'SELECT * FROM expense_categories WHERE tenant_id = $1 AND active = 1 ORDER BY name',
    [DEFAULT_TENANT],
  );
  res.json({ categories: rows.map((r) => mapCategory(r as Record<string, unknown>)) });
});

router.post('/categories', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const { code, name, maxAmount, monthlyLimit, annualLimit, requireReceipt, active } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  const id = await insert(
    `INSERT INTO expense_categories
     (tenant_id, code, name, max_amount, monthly_limit, annual_limit, require_receipt, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      DEFAULT_TENANT,
      String(code).toLowerCase().replace(/\s+/g, '_'),
      name,
      maxAmount ?? null,
      monthlyLimit ?? null,
      annualLimit ?? null,
      requireReceipt === false ? 0 : 1,
      active === false ? 0 : 1,
    ],
  );
  res.status(201).json({ id });
});

router.put('/categories/:id', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const row = await queryOne('SELECT id FROM expense_categories WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await query(
    `UPDATE expense_categories SET
       name = COALESCE($1, name),
       max_amount = COALESCE($2, max_amount),
       monthly_limit = COALESCE($3, monthly_limit),
       annual_limit = COALESCE($4, annual_limit),
       require_receipt = COALESCE($5, require_receipt),
       active = COALESCE($6, active)
     WHERE id = $7`,
    [
      b.name ?? null,
      b.maxAmount !== undefined ? b.maxAmount : null,
      b.monthlyLimit !== undefined ? b.monthlyLimit : null,
      b.annualLimit !== undefined ? b.annualLimit : null,
      b.requireReceipt === undefined ? null : b.requireReceipt ? 1 : 0,
      b.active === undefined ? null : b.active ? 1 : 0,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

router.get('/', requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
  const role = req.user!.sub;
  const canAll =
    req.user!.role === 'admin' ||
    req.user!.role === 'hr' ||
    (await userCan(req.user!.sub, req.user!.role, 'payroll', 'update'));
  let rows: Record<string, unknown>[];
  if (canAll) {
    rows = await query(
      `SELECT c.*, cat.name AS category_name, u.name AS user_name
       FROM expense_claims c
       JOIN expense_categories cat ON cat.id = c.category_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.tenant_id = $1 ORDER BY c.created_at DESC`,
      [DEFAULT_TENANT],
    );
  } else if (req.user!.role === 'manager') {
    const team = await teamUserIds(req.user!.sub);
    const ids = [...team, req.user!.sub];
    rows = await query(
      `SELECT c.*, cat.name AS category_name, u.name AS user_name
       FROM expense_claims c
       JOIN expense_categories cat ON cat.id = c.category_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.tenant_id = $1 AND c.user_id IN (${ids.map((_, i) => `$${i + 2}`).join(',')})
       ORDER BY c.created_at DESC`,
      [DEFAULT_TENANT, ...ids],
    );
  } else {
    rows = await query(
      `SELECT c.*, cat.name AS category_name, u.name AS user_name
       FROM expense_claims c
       JOIN expense_categories cat ON cat.id = c.category_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.tenant_id = $1 AND c.user_id = $2
       ORDER BY c.created_at DESC`,
      [DEFAULT_TENANT, role],
    );
  }
  res.json({ claims: rows.map((r) => mapClaim(r)) });
});

router.post('/', requireAuth, requirePermission('attendance', 'create'), upload.single('receipt'), async (req, res) => {
  const amount = Number(req.body?.amount);
  const categoryId = Number(req.body?.categoryId);
  const expenseDate = String(req.body?.expenseDate || '');
  const description = String(req.body?.description || '').trim();
  if (!categoryId || !amount || !expenseDate || !description) {
    return res.status(400).json({ error: 'categoryId, amount, expenseDate and description required' });
  }

  const cat = await queryOne<{ require_receipt: number; max_amount: string | number | null; active: number }>(
    'SELECT * FROM expense_categories WHERE id = $1 AND tenant_id = $2',
    [categoryId, DEFAULT_TENANT],
  );
  if (!cat || !Number(cat.active)) return res.status(400).json({ error: 'Invalid category' });
  if (Number(cat.require_receipt) && !req.file) {
    return res.status(400).json({ error: 'Receipt is required for this category' });
  }
  if (cat.max_amount != null && amount > Number(cat.max_amount)) {
    return res.status(400).json({ error: `Amount exceeds category max of ${cat.max_amount}` });
  }

  let receiptPath: string | null = null;
  if (req.file) {
    const dest = path.join(uploadsDir, uuid().slice(0, 12) + path.extname(req.file.originalname || '.bin'));
    fs.renameSync(req.file.path, dest);
    receiptPath = dest;
  }

  const emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE tenant_id = $1 AND user_id = $2', [
    DEFAULT_TENANT,
    req.user!.sub,
  ]);
  const managerId = await getEmployeeManagerUserId(req.user!.sub);

  const id = await insert(
    `INSERT INTO expense_claims
     (tenant_id, user_id, employee_id, category_id, amount, expense_date, description, receipt_path, status, current_approver_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)`,
    [
      DEFAULT_TENANT,
      req.user!.sub,
      emp?.id ?? null,
      categoryId,
      amount,
      expenseDate,
      description,
      receiptPath,
      managerId,
    ],
  );

  try {
    await createApprovalRequest({
      moduleKey: 'claim',
      entityType: 'expense_claim',
      entityId: id,
      requesterId: req.user!.sub,
      payload: { amount, categoryId, expenseDate, description },
      preferredApproverRole: managerId ? 'manager' : 'hr',
      preferredApproverUserId: managerId ?? undefined,
    });
  } catch {
    /* optional */
  }

  res.status(201).json({ id });
});

router.post('/:id/action', requireAuth, requirePermission('attendance', 'approve'), async (req, res) => {
  const { action, comment, approvedAmount } = req.body || {};
  if (!['approve', 'reject', 'clarification', 'pay'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  if (!String(comment || '').trim()) {
    return res.status(400).json({ error: 'Comment is mandatory for claim decisions' });
  }

  const claim = await queryOne('SELECT * FROM expense_claims WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  if (req.user!.role === 'manager') {
    const team = await teamUserIds(req.user!.sub);
    if (!team.includes(String(claim.user_id))) return res.status(403).json({ error: 'Forbidden' });
  }

  // Claims are NEVER auto-approved — every decision requires an actor + comment
  await query(
    `INSERT INTO expense_claim_actions (claim_id, actor_id, action, comment) VALUES ($1,$2,$3,$4)`,
    [claim.id, req.user!.sub, action, String(comment).trim()],
  );

  if (action === 'approve') {
    await query(
      `UPDATE expense_claims SET status = 'approved', approved_amount = $1, updated_at = NOW() WHERE id = $2`,
      [approvedAmount != null ? Number(approvedAmount) : claim.amount, claim.id],
    );
  } else if (action === 'reject') {
    await query(`UPDATE expense_claims SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [claim.id]);
  } else if (action === 'clarification') {
    await query(`UPDATE expense_claims SET status = 'clarification', updated_at = NOW() WHERE id = $1`, [claim.id]);
  } else if (action === 'pay') {
    if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
      return res.status(403).json({ error: 'Only HR/Admin can mark paid' });
    }
    await query(
      `UPDATE expense_claims SET status = 'paid', payment_status = 'paid', updated_at = NOW() WHERE id = $1`,
      [claim.id],
    );
  }

  await query(
    `UPDATE approval_requests SET status = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND module_key = 'claim' AND entity_type = 'expense_claim'
       AND entity_id = $3 AND status = 'pending'`,
    [
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested',
      DEFAULT_TENANT,
      String(claim.id),
    ],
  );

  res.json({ ok: true });
});

export default router;
