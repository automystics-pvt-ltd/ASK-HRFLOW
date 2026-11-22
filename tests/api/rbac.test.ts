import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001';

async function login(email: string, password = 'demo123') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ') || (res.headers.get('set-cookie') || '').split(';')[0];
  const body = await res.json();
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(body)}`);
  return { cookie, user: body.user as { id: string; role: string } };
}

function auth(cookie: string): HeadersInit {
  return { Cookie: cookie, 'Content-Type': 'application/json' };
}

describe('API RBAC + health (MySQL)', () => {
  let admin: { cookie: string };
  let employee: { cookie: string };

  before(async () => {
    const health = await fetch(`${BASE}/api/health`);
    assert.equal(health.status, 200);
    const h = await health.json();
    assert.equal(h.db, 'mysql');
    admin = await login('alvi@automystics.com');
    employee = await login('rahul.verma@automystics.com');
  });

  it('admin can list employees', async () => {
    const res = await fetch(`${BASE}/api/employees`, { headers: auth(admin.cookie) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.employees));
    assert.ok(body.employees.length > 0);
  });

  it('employee cannot list all employees', async () => {
    const res = await fetch(`${BASE}/api/employees`, { headers: auth(employee.cookie) });
    assert.equal(res.status, 403);
  });

  it('dashboard stats are numeric from SQL', async () => {
    const res = await fetch(`${BASE}/api/dashboard/stats`, { headers: auth(admin.cookie) });
    assert.equal(res.status, 200);
    const { stats } = await res.json();
    assert.equal(typeof stats.totalEmployees, 'number');
    assert.ok(stats.totalEmployees >= 1);
  });

  it('employee leave list is scoped', async () => {
    const res = await fetch(`${BASE}/api/leave`, { headers: auth(employee.cookie) });
    assert.equal(res.status, 200);
    const { requests } = await res.json();
    for (const r of requests) {
      assert.equal(r.userId, 'u-emp');
    }
  });

  it('rejects unauthenticated access', async () => {
    const res = await fetch(`${BASE}/api/employees`);
    assert.ok(res.status === 401 || res.status === 403);
  });
});
