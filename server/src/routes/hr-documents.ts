import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { userCan } from '../lib/users.js';
import { isoDate } from '../lib/dates.js';

const router = Router();

const PLACEHOLDERS = [
  '{{employee_name}}',
  '{{employee_id}}',
  '{{designation}}',
  '{{department}}',
  '{{join_date}}',
  '{{salary}}',
  '{{address}}',
  '{{relieving_date}}',
  '{{company_name}}',
  '{{company_address}}',
  '{{today}}',
];

export const DEFAULT_TEMPLATES: {
  docType: string;
  name: string;
  description: string;
  bodyHtml: string;
  mandatory: string[];
}[] = [
  {
    docType: 'offer_letter',
    name: 'Offer Letter',
    description: 'Employment offer letter',
    mandatory: ['employee_name', 'designation', 'join_date', 'salary'],
    bodyHtml: `<h1>Offer of Employment</h1>
<p>Dear {{employee_name}},</p>
<p>We are pleased to offer you the position of <strong>{{designation}}</strong> in the {{department}} department at {{company_name}}.</p>
<p>Your proposed start date is {{join_date}} with a salary of {{salary}}.</p>
<p>Address: {{address}}</p>
<p>Issued on {{today}}.<br/>{{company_name}}<br/>{{company_address}}</p>`,
  },
  {
    docType: 'payslip',
    name: 'Payslip',
    description: 'Salary payslip summary',
    mandatory: ['employee_name', 'salary'],
    bodyHtml: `<h1>Payslip</h1>
<p>Employee: {{employee_name}} ({{employee_id}})</p>
<p>Designation: {{designation}} · Department: {{department}}</p>
<p>Net / gross reference: {{salary}}</p>
<p>Period ending {{today}}</p>
<p>{{company_name}} · {{company_address}}</p>`,
  },
  {
    docType: 'relieving_letter',
    name: 'Relieving Letter',
    description: 'Employee relieving letter',
    mandatory: ['employee_name', 'relieving_date'],
    bodyHtml: `<h1>Relieving Letter</h1>
<p>This is to certify that {{employee_name}} ({{employee_id}}), {{designation}} in {{department}}, has been relieved from duties effective {{relieving_date}}.</p>
<p>Last working day: {{relieving_date}}. Joined on {{join_date}}.</p>
<p>Issued on {{today}}.<br/>{{company_name}}<br/>{{company_address}}</p>`,
  },
  {
    docType: 'bonafide',
    name: 'Bonafide Certificate',
    description: 'Bonafide employment certificate',
    mandatory: ['employee_name'],
    bodyHtml: `<h1>Bonafide Certificate</h1>
<p>This is to certify that {{employee_name}} ({{employee_id}}) is a bonafide employee of {{company_name}}, working as {{designation}} in {{department}} since {{join_date}}.</p>
<p>Employee address on record: {{address}}</p>
<p>Issued on {{today}}.<br/>{{company_address}}</p>`,
  },
  {
    docType: 'experience',
    name: 'Experience Letter',
    description: 'Experience certificate',
    mandatory: ['employee_name', 'join_date'],
    bodyHtml: `<h1>Experience Letter</h1>
<p>This certifies that {{employee_name}} worked with {{company_name}} as {{designation}} in {{department}} from {{join_date}} to {{relieving_date}}.</p>
<p>Issued on {{today}}.<br/>{{company_name}} · {{company_address}}</p>`,
  },
  {
    docType: 'appointment',
    name: 'Appointment Letter',
    description: 'Appointment / confirmation letter',
    mandatory: ['employee_name', 'designation', 'join_date'],
    bodyHtml: `<h1>Appointment Letter</h1>
<p>Dear {{employee_name}},</p>
<p>You are hereby appointed as {{designation}} in {{department}} effective {{join_date}}.</p>
<p>Employee ID: {{employee_id}} · Compensation reference: {{salary}}</p>
<p>Issued on {{today}}.<br/>{{company_name}}<br/>{{company_address}}</p>`,
  },
];

function parseJsonArr(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapTemplate(r: Record<string, unknown>) {
  return {
    id: r.id,
    docType: r.doc_type,
    name: r.name,
    description: r.description,
    bodyHtml: r.body_html,
    placeholders: parseJsonArr(r.placeholders),
    mandatoryFields: parseJsonArr(r.mandatory_fields),
    headerHtml: r.header_html,
    footerHtml: r.footer_html,
    signatoryName: r.signatory_name,
    signatoryTitle: r.signatory_title,
    version: Number(r.version),
    active: Boolean(Number(r.active)),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function seedDocumentTemplates(createdBy = 'system') {
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await queryOne(
      'SELECT id FROM document_templates WHERE tenant_id = $1 AND doc_type = $2 LIMIT 1',
      [DEFAULT_TENANT, t.docType],
    );
    if (existing) continue;
    const id = `dt-${t.docType}`.slice(0, 32);
    await query(
      `INSERT INTO document_templates
       (id, tenant_id, doc_type, name, description, body_html, placeholders, mandatory_fields, created_by, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)`,
      [
        id,
        DEFAULT_TENANT,
        t.docType,
        t.name,
        t.description,
        t.bodyHtml,
        JSON.stringify(PLACEHOLDERS),
        JSON.stringify(t.mandatory),
        createdBy,
      ],
    );
  }
}

async function getCompany() {
  const row = await queryOne<{ value: unknown }>(
    'SELECT value FROM organization_settings WHERE tenant_id = $1 AND `key` = $2',
    [DEFAULT_TENANT, 'company'],
  );
  let company: Record<string, string> = {};
  if (row?.value) {
    company = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value as Record<string, string>);
  }
  return {
    name: company.name || company.legalName || 'Company',
    address: company.address || '',
  };
}

function fillTemplate(html: string, fields: Record<string, string>) {
  let out = html;
  for (const [key, val] of Object.entries(fields)) {
    out = out.replaceAll(`{{${key}}}`, val ?? '');
  }
  // Clear any remaining unknown placeholders
  out = out.replace(/\{\{[a-z_]+\}\}/gi, '');
  return out;
}

router.get('/templates', requireAuth, requirePermission('settings', 'read'), async (_req, res) => {
  await seedDocumentTemplates();
  const rows = await query('SELECT * FROM document_templates WHERE tenant_id = $1 ORDER BY doc_type, name', [
    DEFAULT_TENANT,
  ]);
  res.json({ templates: rows.map((r) => mapTemplate(r as Record<string, unknown>)) });
});

router.get('/templates/:id', requireAuth, requirePermission('settings', 'read'), async (req, res) => {
  const row = await queryOne('SELECT * FROM document_templates WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ template: mapTemplate(row as Record<string, unknown>) });
});

router.post('/templates', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const { docType, name, description, bodyHtml, mandatoryFields, headerHtml, footerHtml, signatoryName, signatoryTitle } =
    req.body || {};
  if (!docType || !name || !bodyHtml) return res.status(400).json({ error: 'docType, name, bodyHtml required' });
  const id = uuid().slice(0, 12);
  await query(
    `INSERT INTO document_templates
     (id, tenant_id, doc_type, name, description, body_html, placeholders, mandatory_fields, header_html, footer_html, signatory_name, signatory_title, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      DEFAULT_TENANT,
      docType,
      name,
      description ?? null,
      bodyHtml,
      JSON.stringify(PLACEHOLDERS),
      JSON.stringify(mandatoryFields ?? []),
      headerHtml ?? null,
      footerHtml ?? null,
      signatoryName ?? null,
      signatoryTitle ?? null,
      req.user!.sub,
    ],
  );
  res.status(201).json({ id });
});

router.put('/templates/:id', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const row = await queryOne('SELECT * FROM document_templates WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  await query(
    `UPDATE document_templates SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       body_html = COALESCE($3, body_html),
       mandatory_fields = COALESCE($4, mandatory_fields),
       header_html = COALESCE($5, header_html),
       footer_html = COALESCE($6, footer_html),
       signatory_name = COALESCE($7, signatory_name),
       signatory_title = COALESCE($8, signatory_title),
       version = version + 1
     WHERE id = $9`,
    [
      b.name ?? null,
      b.description ?? null,
      b.bodyHtml ?? null,
      b.mandatoryFields ? JSON.stringify(b.mandatoryFields) : null,
      b.headerHtml ?? null,
      b.footerHtml ?? null,
      b.signatoryName ?? null,
      b.signatoryTitle ?? null,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

router.post('/templates/:id/activate', requireAuth, requirePermission('settings', 'update'), async (req, res) => {
  const active = req.body?.active === false ? 0 : 1;
  const result = await query('UPDATE document_templates SET active = $1 WHERE id = $2 AND tenant_id = $3', [
    active,
    req.params.id,
    DEFAULT_TENANT,
  ]);
  void result;
  const row = await queryOne('SELECT id FROM document_templates WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, active: Boolean(active) });
});

router.post('/generate', requireAuth, requirePermission('employees', 'create'), async (req, res) => {
  const canUpdate = await userCan(req.user!.sub, req.user!.role, 'employees', 'update');
  if (!canUpdate && req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { employeeId, docType, fields } = req.body || {};
  if (!employeeId || !docType) return res.status(400).json({ error: 'employeeId and docType required' });

  const emp = await queryOne<{
    id: number;
    user_id: string | null;
    name: string;
    department: string | null;
    position: string | null;
    join_date: Date | string | null;
    salary: string | number | null;
    location: string | null;
  }>('SELECT * FROM employees WHERE id = $1 AND tenant_id = $2', [employeeId, DEFAULT_TENANT]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const tmpl = await queryOne(
    `SELECT * FROM document_templates WHERE tenant_id = $1 AND doc_type = $2 AND active = 1
     ORDER BY version DESC, updated_at DESC LIMIT 1`,
    [DEFAULT_TENANT, docType],
  );
  if (!tmpl) return res.status(404).json({ error: 'No active template for this document type' });

  const company = await getCompany();
  const extra = (fields && typeof fields === 'object' ? fields : {}) as Record<string, string>;
  const values: Record<string, string> = {
    employee_name: emp.name,
    employee_id: String(emp.id),
    designation: emp.position || '',
    department: emp.department || '',
    join_date: emp.join_date ? isoDate(emp.join_date) : '',
    salary: emp.salary != null ? String(emp.salary) : '',
    address: emp.location || '',
    relieving_date: '',
    company_name: company.name,
    company_address: company.address,
    today: isoDate(new Date()),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v ?? '')])),
  };

  const mandatory = parseJsonArr(tmpl.mandatory_fields);
  for (const m of mandatory) {
    if (!values[m]?.trim()) return res.status(400).json({ error: `Missing mandatory field: ${m}` });
  }

  const header = tmpl.header_html ? String(tmpl.header_html) : '';
  const footer = tmpl.footer_html ? String(tmpl.footer_html) : '';
  const body = fillTemplate(`${header}${tmpl.body_html}${footer}`, values);
  const id = uuid().slice(0, 12);
  const title = `${tmpl.name} — ${emp.name}`;

  await query(
    `INSERT INTO generated_documents
     (id, tenant_id, template_id, template_version, doc_type, employee_id, employee_user_id, title, field_values, html_content, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      DEFAULT_TENANT,
      tmpl.id,
      tmpl.version,
      docType,
      emp.id,
      emp.user_id,
      title,
      JSON.stringify(values),
      body,
      req.user!.sub,
    ],
  );
  res.status(201).json({ id, title });
});

router.get('/generated', requireAuth, async (req, res) => {
  const canAll = await userCan(req.user!.sub, req.user!.role, 'employees', 'read');
  const rows = canAll
    ? await query(
        `SELECT id, doc_type, employee_id, employee_user_id, title, generated_by, generated_at, mime_type
         FROM generated_documents WHERE tenant_id = $1 ORDER BY generated_at DESC`,
        [DEFAULT_TENANT],
      )
    : await query(
        `SELECT id, doc_type, employee_id, employee_user_id, title, generated_by, generated_at, mime_type
         FROM generated_documents WHERE tenant_id = $1 AND employee_user_id = $2 ORDER BY generated_at DESC`,
        [DEFAULT_TENANT, req.user!.sub],
      );

  res.json({
    documents: rows.map((r) => ({
      id: r.id,
      docType: r.doc_type,
      employeeId: r.employee_id,
      employeeUserId: r.employee_user_id,
      title: r.title,
      generatedBy: r.generated_by,
      generatedAt: r.generated_at,
      mimeType: r.mime_type,
    })),
  });
});

router.get('/generated/:id', requireAuth, async (req, res) => {
  const row = await queryOne('SELECT * FROM generated_documents WHERE id = $1 AND tenant_id = $2', [
    req.params.id,
    DEFAULT_TENANT,
  ]);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const canAll = await userCan(req.user!.sub, req.user!.role, 'employees', 'read');
  if (!canAll && row.employee_user_id !== req.user!.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.query.format === 'json') {
    return res.json({
      document: {
        id: row.id,
        title: row.title,
        docType: row.doc_type,
        html: row.html_content,
        generatedAt: row.generated_at,
      },
    });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${String(row.title).replace(/[^\w.-]+/g, '_')}.html"`);
  res.send(String(row.html_content));
});

export default router;
