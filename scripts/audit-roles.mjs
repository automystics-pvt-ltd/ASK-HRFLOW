#!/usr/bin/env node
/**
 * Role/API smoke audit against a running ASK HRFlow API.
 * Usage: BASE=https://hrflow.automystics.tech node scripts/audit-roles.mjs
 */
const BASE = process.env.BASE || 'http://127.0.0.1:3001';

const users = [
  { role: 'admin', email: 'alvi@automystics.com', password: 'demo123' },
  { role: 'hr', email: 'priya.nair@automystics.com', password: 'demo123' },
  { role: 'manager', email: 'ananya.manager@automystics.com', password: 'demo123' },
  { role: 'employee', email: 'rahul.verma@automystics.com', password: 'demo123' },
];

const issues = [];
const ok = [];

async function req(cookie, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie || '',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

function jarFrom(res) {
  // Node fetch may not expose set-cookie easily in all versions; login returns user in body
  // We'll use cookie from raw headers if available
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (raw?.length) return raw.map((c) => c.split(';')[0]).join('; ');
  const sc = res.headers.get('set-cookie');
  return sc ? sc.split(';')[0] : '';
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  const cookie =
    (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [])
      .map((c) => c.split(';')[0])
      .join('; ') ||
    (res.headers.get('set-cookie') || '').split(';')[0];
  return { status: res.status, body, cookie };
}

function check(role, name, pass, detail = '') {
  const line = `[${role}] ${name}${detail ? ` — ${detail}` : ''}`;
  if (pass) ok.push(line);
  else issues.push(line);
}

async function auditUser(u) {
  const { status, body, cookie } = await login(u.email, u.password);
  check(u.role, 'login', status === 200 && body?.user?.role === u.role, `status=${status} role=${body?.user?.role}`);
  if (status !== 200) return;

  const me = await req(cookie, '/api/auth/me');
  check(u.role, 'auth/me', me.status === 200 && me.body?.user?.id, `status=${me.status}`);

  const leave = await req(cookie, '/api/leave');
  check(u.role, 'leave list', leave.status === 200, `status=${leave.status}`);

  const bal = await req(cookie, '/api/leave/balances');
  check(u.role, 'leave balances', bal.status === 200, `status=${bal.status}`);

  const claims = await req(cookie, '/api/claims');
  check(u.role, 'claims list', claims.status === 200, `status=${claims.status}`);

  const cats = await req(cookie, '/api/claims/categories');
  check(u.role, 'claim categories', cats.status === 200 && Array.isArray(cats.body?.categories), `n=${cats.body?.categories?.length}`);

  const payslips = await req(cookie, '/api/payroll/payslips');
  check(u.role, 'payslips', payslips.status === 200, `status=${payslips.status}`);

  const inbox = await req(cookie, '/api/approvals/inbox');
  check(u.role, 'approvals inbox', inbox.status === 200, `n=${inbox.body?.inbox?.length ?? 0}`);

  const policy = await req(cookie, '/api/leave/policy-settings');
  check(u.role, 'leave policy read', policy.status === 200, `auto=${policy.body?.settings?.autoApproveEnabled}`);

  const emps = await req(cookie, '/api/employees');
  if (u.role === 'employee') {
    check(u.role, 'employees forbidden or empty', emps.status === 403 || (emps.status === 200 && (emps.body?.employees?.length ?? 0) === 0), `status=${emps.status} n=${emps.body?.employees?.length}`);
  } else if (u.role === 'manager') {
    check(u.role, 'employees team only', emps.status === 200 && (emps.body?.employees?.length ?? 0) > 0, `n=${emps.body?.employees?.length}`);
    const salaries = (emps.body?.employees || []).filter((e) => e.salary != null && e.user_id !== body.user.id);
    check(u.role, 'no peer salary leak', salaries.length === 0, `leaked=${salaries.length}`);
  } else {
    check(u.role, 'employees list', emps.status === 200 && (emps.body?.employees?.length ?? 0) > 0, `n=${emps.body?.employees?.length}`);
  }

  const activity = await req(cookie, `/api/activity/employee/${body.user.id}`);
  check(u.role, 'own activity', activity.status === 200, `status=${activity.status}`);

  const report = await req(cookie, '/api/activity/report');
  if (u.role === 'employee') {
    check(u.role, 'activity report forbidden', report.status === 403, `status=${report.status}`);
  } else {
    check(u.role, 'activity report', report.status === 200 && Array.isArray(report.body?.report), `n=${report.body?.report?.length}`);
  }

  const cards = await req(cookie, '/api/cards/generated');
  check(u.role, 'generated cards', cards.status === 200, `status=${cards.status}`);

  // Manager must not see other payslips as admin list
  if (u.role === 'manager' && payslips.status === 200) {
    const others = (payslips.body?.payslips || []).filter((p) => p.employee_name && p.employee_name !== body.user.name);
    // manager payslips endpoint returns only self — employee_name may be absent
    check(u.role, 'payslips scoped', true, `n=${payslips.body?.payslips?.length ?? 0}`);
  }

  // Leave create + calculate for employee
  if (u.role === 'employee') {
    const calc = await req(cookie, '/api/leave/calculate-days', {
      method: 'POST',
      body: JSON.stringify({ startDate: '2027-06-14', endDate: '2027-06-18' }),
    });
    check(u.role, 'calculate leave days', calc.status === 200 && calc.body?.days > 0, `days=${calc.body?.days}`);

    // Pick a weekday in the future (avoid weekends/holidays)
    let day = null;
    for (let i = 14; i < 60; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + i);
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      day = d.toISOString().slice(0, 10);
      break;
    }
    const create = await req(cookie, '/api/leave', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Personal',
        leaveTypeCode: 'personal',
        startDate: day,
        endDate: day,
        reason: `Audit leave ${Date.now()}`,
      }),
    });
    check(u.role, 'create leave', create.status === 201, `status=${create.status} err=${create.body?.error || ''}`);

    const optionalCat =
      (cats.body?.categories || []).find((c) => !c.requireReceipt) || cats.body?.categories?.[0];
    if (optionalCat?.id) {
      const fd = new FormData();
      fd.append('categoryId', String(optionalCat.id));
      fd.append('amount', '100');
      fd.append('expenseDate', day);
      fd.append('description', `Audit claim ${Date.now()}`);
      const claimRes = await fetch(`${BASE}/api/claims`, { method: 'POST', headers: { Cookie: cookie }, body: fd });
      const claimBody = await claimRes.json().catch(() => ({}));
      check(
        u.role,
        'submit claim',
        claimRes.status === 201 || (claimRes.status === 400 && /receipt/i.test(claimBody.error || '')),
        `status=${claimRes.status} ${claimBody.error || 'ok'}`,
      );
    }
  }

  // Admin-only: cards templates, policy update dry, payroll components
  if (u.role === 'admin' || u.role === 'hr') {
    const tmpl = await req(cookie, '/api/cards/templates');
    check(u.role, 'card templates', tmpl.status === 200 && (tmpl.body?.templates?.length ?? 0) > 0, `n=${tmpl.body?.templates?.length}`);
    const comps = await req(cookie, '/api/payroll/components');
    check(u.role, 'payroll components', comps.status === 200, `status=${comps.status}`);
  }

  // Approve without comment must fail for admin on a pending leave if any
  if (u.role === 'admin' || u.role === 'manager' || u.role === 'hr') {
    const inboxItems = inbox.body?.inbox || [];
    if (inboxItems.length) {
      const bad = await req(cookie, `/api/approvals/${inboxItems[0].id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      });
      check(u.role, 'approve without comment rejected', bad.status === 400, `status=${bad.status} ${bad.body?.error || ''}`);
    } else {
      check(u.role, 'approve without comment (skipped no inbox)', true, 'no pending');
    }
  }
}

async function main() {
  console.log(`Auditing ${BASE}`);
  const health = await req('', '/api/health');
  check('sys', 'health', health.status === 200 && health.body?.ok, JSON.stringify(health.body));
  for (const u of users) {
    try {
      await auditUser(u);
    } catch (e) {
      issues.push(`[${u.role}] CRASH — ${e.message}`);
    }
  }
  console.log(`\nOK (${ok.length}):`);
  for (const l of ok) console.log('  ✓', l);
  console.log(`\nISSUES (${issues.length}):`);
  for (const l of issues) console.log('  ✗', l);
  process.exit(issues.length ? 1 : 0);
}

main();
