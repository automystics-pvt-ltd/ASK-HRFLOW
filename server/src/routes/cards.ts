import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { isManagerOf } from '../lib/team.js';

const router = Router();

function fillPlaceholders(html: string, data: Record<string, string>) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '');
}

router.get('/templates', requireAuth, requirePermission('settings', 'read'), async (_req, res) => {
  const rows = await query(
    'SELECT id, card_kind, name, width_mm, height_mm, version, active, updated_at FROM card_templates WHERE tenant_id = $1 ORDER BY card_kind, name',
    [DEFAULT_TENANT],
  );
  res.json({
    templates: rows.map((r) => ({
      id: r.id,
      cardKind: r.card_kind,
      name: r.name,
      widthMm: r.width_mm,
      heightMm: r.height_mm,
      version: r.version,
      active: Boolean(Number(r.active)),
      updatedAt: r.updated_at,
    })),
  });
});

router.post('/generate', requireAuth, requirePermission('employees', 'read'), async (req, res) => {
  const { employeeId, cardKind, templateId } = req.body || {};
  if (!employeeId || !cardKind) return res.status(400).json({ error: 'employeeId and cardKind required' });
  if (!['id_card', 'business_card'].includes(cardKind)) {
    return res.status(400).json({ error: 'cardKind must be id_card or business_card' });
  }

  const emp = await queryOne<Record<string, unknown>>(
    'SELECT * FROM employees WHERE id = $1 AND tenant_id = $2',
    [employeeId, DEFAULT_TENANT],
  );
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const canAll = await userCan(req.user!.sub, req.user!.role, 'employees', 'update');
  const isSelf = emp.user_id === req.user!.sub;
  const isMgr =
    req.user!.role === 'manager' && emp.user_id
      ? await isManagerOf(req.user!.sub, String(emp.user_id))
      : false;
  if (!canAll && !isSelf && !isMgr && req.user!.role !== 'hr' && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const tmpl = templateId
    ? await queryOne('SELECT * FROM card_templates WHERE id = $1 AND tenant_id = $2 AND active = 1', [
        templateId,
        DEFAULT_TENANT,
      ])
    : await queryOne(
        'SELECT * FROM card_templates WHERE tenant_id = $1 AND card_kind = $2 AND active = 1 ORDER BY version DESC LIMIT 1',
        [DEFAULT_TENANT, cardKind],
      );
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });

  const company = await queryOne<{ value: unknown }>(
    'SELECT value FROM organization_settings WHERE tenant_id = $1 AND `key` = $2',
    [DEFAULT_TENANT, 'company'],
  );
  let companyName = 'Automystics';
  if (company?.value) {
    const v = typeof company.value === 'string' ? JSON.parse(company.value) : company.value;
    companyName = String((v as { name?: string }).name || companyName);
  }

  const data: Record<string, string> = {
    company_name: companyName,
    employee_name: String(emp.name ?? ''),
    employee_id: String(emp.id),
    designation: String(emp.designation || emp.position || ''),
    department: String(emp.department ?? ''),
    email: String(emp.email ?? ''),
    phone: String(emp.phone ?? ''),
    position: String(emp.position ?? ''),
  };

  const html = fillPlaceholders(String(tmpl.front_html), data);
  const id = 'gc-' + uuid().slice(0, 10);
  const title = `${cardKind === 'id_card' ? 'ID Card' : 'Business Card'} — ${emp.name}`;

  await query(
    `INSERT INTO generated_cards
     (id, tenant_id, template_id, card_kind, employee_id, employee_user_id, title, html_content, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, DEFAULT_TENANT, tmpl.id, cardKind, emp.id, emp.user_id, title, html, req.user!.sub],
  );

  res.status(201).json({ id, title, html });
});

router.get('/generated', requireAuth, requirePermission('employees', 'read'), async (req, res) => {
  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  const rows = canAll
    ? await query(
        `SELECT g.id, g.card_kind, g.title, g.employee_id, g.employee_user_id, g.generated_at, e.name AS employee_name
         FROM generated_cards g
         JOIN employees e ON e.id = g.employee_id
         WHERE g.tenant_id = $1 ORDER BY g.generated_at DESC`,
        [DEFAULT_TENANT],
      )
    : await query(
        `SELECT g.id, g.card_kind, g.title, g.employee_id, g.employee_user_id, g.generated_at, e.name AS employee_name
         FROM generated_cards g
         JOIN employees e ON e.id = g.employee_id
         WHERE g.tenant_id = $1 AND (g.employee_user_id = $2 OR g.generated_by = $2)
         ORDER BY g.generated_at DESC`,
        [DEFAULT_TENANT, req.user!.sub],
      );

  res.json({
    cards: rows.map((r) => ({
      id: r.id,
      cardKind: r.card_kind,
      title: r.title,
      employeeId: r.employee_id,
      employeeUserId: r.employee_user_id,
      employeeName: r.employee_name,
      generatedAt: r.generated_at,
    })),
  });
});

router.get('/generated/:id', requireAuth, async (req, res) => {
  const row = await queryOne(
    `SELECT g.*, e.name AS employee_name FROM generated_cards g
     JOIN employees e ON e.id = g.employee_id
     WHERE g.id = $1 AND g.tenant_id = $2`,
    [req.params.id, DEFAULT_TENANT],
  );
  if (!row) return res.status(404).json({ error: 'Not found' });

  const canAll = req.user!.role === 'admin' || req.user!.role === 'hr';
  const isSelf = row.employee_user_id === req.user!.sub || row.generated_by === req.user!.sub;
  const isMgr =
    req.user!.role === 'manager' && row.employee_user_id
      ? await isManagerOf(req.user!.sub, String(row.employee_user_id))
      : false;
  if (!canAll && !isSelf && !isMgr) return res.status(403).json({ error: 'Forbidden' });

  if (req.query.format === 'html') {
    res.type('html').send(String(row.html_content));
    return;
  }

  res.json({
    card: {
      id: row.id,
      cardKind: row.card_kind,
      title: row.title,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      html: row.html_content,
      generatedAt: row.generated_at,
    },
  });
});

export default router;
