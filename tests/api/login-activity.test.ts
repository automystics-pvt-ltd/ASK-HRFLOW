import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001';

async function login(email: string, password = 'demo123', location?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...(location || {}) }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie =
    setCookie.map((c) => c.split(';')[0]).join('; ') || (res.headers.get('set-cookie') || '').split(';')[0];
  const body = await res.json();
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(body)}`);
  return { cookie, user: body.user as { id: string; role: string; name: string } };
}

function auth(cookie: string): HeadersInit {
  return { Cookie: cookie, 'Content-Type': 'application/json' };
}

describe('Login activity tracking', () => {
  let admin: { cookie: string; user: { id: string; name: string } };
  let employee: { cookie: string; user: { id: string; name: string } };

  before(async () => {
    const health = await fetch(`${BASE}/api/health`);
    assert.equal(health.status, 200);
    admin = await login('alvi@automystics.com', 'demo123', {
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 25,
      locationStatus: 'granted',
    });
    employee = await login('rahul.verma@automystics.com', 'demo123', {
      locationStatus: 'denied',
    });
  });

  it('records login rows and admin can list them', async () => {
    const res = await fetch(`${BASE}/api/login-activity?limit=50`, { headers: auth(admin.cookie) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.activity));
    assert.ok(body.activity.length >= 1);
    const mine = body.activity.find((r: { userId: string; event: string }) => r.userId === admin.user.id && r.event === 'login');
    assert.ok(mine, 'admin login activity missing');
    assert.equal(mine.locationStatus, 'granted');
    assert.ok(mine.latitude != null);
    assert.ok(mine.longitude != null);
  });

  it('stores permission denial without coordinates', async () => {
    const res = await fetch(
      `${BASE}/api/login-activity?userId=${encodeURIComponent(employee.user.id)}&event=login&limit=10`,
      { headers: auth(admin.cookie) },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    const row = body.activity.find((r: { userId: string }) => r.userId === employee.user.id);
    assert.ok(row);
    assert.equal(row.locationStatus, 'denied');
    assert.equal(row.latitude, null);
  });

  it('employee cannot read login activity', async () => {
    const res = await fetch(`${BASE}/api/login-activity`, { headers: auth(employee.cookie) });
    assert.equal(res.status, 403);
  });

  it('hr can read login activity', async () => {
    const hr = await login('priya.nair@automystics.com');
    const res = await fetch(`${BASE}/api/login-activity?limit=20`, { headers: auth(hr.cookie) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.activity));
  });

  it('records logout with optional location', async () => {
    const res = await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: auth(admin.cookie),
      body: JSON.stringify({ locationStatus: 'unavailable' }),
    });
    assert.equal(res.status, 200);
    // re-login to query
    admin = await login('alvi@automystics.com');
    const list = await fetch(
      `${BASE}/api/login-activity?userId=${encodeURIComponent(admin.user.id)}&event=logout&limit=5`,
      { headers: auth(admin.cookie) },
    );
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.ok(body.activity.some((r: { event: string }) => r.event === 'logout'));
  });
});

describe('Login activity manager scoping', () => {
  it('manager only sees assigned team activity', async () => {
    const mgr = await login('ananya.manager@automystics.com');
    // Ensure a team member login exists
    await login('rahul.verma@automystics.com', 'demo123', { locationStatus: 'unavailable' });
    const res = await fetch(`${BASE}/api/login-activity?limit=100`, { headers: auth(mgr.cookie) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.activity));
    // Manager must not see admin logins
    for (const row of body.activity) {
      assert.notEqual(row.userId, 'u-admin');
    }
  });
});
