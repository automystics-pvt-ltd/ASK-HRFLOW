import { Router } from 'express';
import { DEFAULT_TENANT, query, queryOne, insert } from '../db.js';
import { requireAuth, attachUser } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { seedLocationMaster } from '../lib/location-seed.js';

const router = Router();

router.get('/countries', requireAuth, async (_req, res) => {
  const rows = await query(
    `SELECT id, code, name FROM geo_countries WHERE tenant_id = $1 AND active = 1 ORDER BY name`,
    [DEFAULT_TENANT],
  );
  res.json({ countries: rows });
});

router.get('/states', requireAuth, async (req, res) => {
  const countryId = Number(req.query.countryId);
  const countryCode = String(req.query.countryCode || '').trim();
  let sql = `SELECT s.id, s.code, s.name, s.country_id AS countryId
             FROM geo_states s WHERE s.tenant_id = $1 AND s.active = 1`;
  const params: unknown[] = [DEFAULT_TENANT];
  if (Number.isFinite(countryId) && countryId > 0) {
    sql += ' AND s.country_id = $2';
    params.push(countryId);
  } else if (countryCode) {
    sql += ` AND s.country_id = (
      SELECT id FROM geo_countries WHERE tenant_id = $1 AND code = $${params.length + 1} LIMIT 1
    )`;
    params.push(countryCode);
  }
  sql += ' ORDER BY s.name';
  const rows = await query(sql, params);
  res.json({ states: rows });
});

router.get('/districts', requireAuth, async (req, res) => {
  const stateId = Number(req.query.stateId);
  const stateCode = String(req.query.stateCode || '').trim();
  const countryCode = String(req.query.countryCode || 'IN').trim();
  let sql = `SELECT d.id, d.code, d.name, d.state_id AS stateId
             FROM geo_districts d WHERE d.tenant_id = $1 AND d.active = 1`;
  const params: unknown[] = [DEFAULT_TENANT];
  if (Number.isFinite(stateId) && stateId > 0) {
    sql += ' AND d.state_id = $2';
    params.push(stateId);
  } else if (stateCode) {
    sql += ` AND d.state_id = (
      SELECT s.id FROM geo_states s
      JOIN geo_countries c ON c.id = s.country_id
      WHERE s.tenant_id = $1 AND s.code = $2 AND c.code = $3 LIMIT 1
    )`;
    params.push(stateCode, countryCode);
  }
  sql += ' ORDER BY d.name';
  const rows = await query(sql, params);
  res.json({ districts: rows });
});

router.get('/cities', requireAuth, async (req, res) => {
  const stateId = Number(req.query.stateId);
  const districtId = Number(req.query.districtId);
  const q = String(req.query.q || '').trim();
  let sql = `SELECT c.id, c.name, c.state_id AS stateId, c.district_id AS districtId
             FROM geo_cities c WHERE c.tenant_id = $1 AND c.active = 1`;
  const params: unknown[] = [DEFAULT_TENANT];
  let i = 2;
  if (Number.isFinite(stateId) && stateId > 0) {
    sql += ` AND c.state_id = $${i++}`;
    params.push(stateId);
  }
  if (Number.isFinite(districtId) && districtId > 0) {
    sql += ` AND c.district_id = $${i++}`;
    params.push(districtId);
  } else if (String(req.query.districtId || '') === 'none') {
    sql += ' AND c.district_id IS NULL';
  }
  if (q) {
    sql += ` AND c.name LIKE $${i++}`;
    params.push(`%${q}%`);
  }
  sql += ' ORDER BY c.name LIMIT 200';
  const rows = await query(sql, params);
  res.json({ cities: rows });
});

/** Resolve cascade options for a country/state/district selection by name or code. */
router.get('/cascade', requireAuth, async (req, res) => {
  const country = String(req.query.country || '').trim();
  const state = String(req.query.state || '').trim();
  const district = String(req.query.district || '').trim();

  const countries = await query(
    `SELECT id, code, name FROM geo_countries WHERE tenant_id = $1 AND active = 1 ORDER BY name`,
    [DEFAULT_TENANT],
  );
  let countryRow = countries.find(
    (c) =>
      String(c.code).toLowerCase() === country.toLowerCase() ||
      String(c.name).toLowerCase() === country.toLowerCase(),
  );

  let states: Record<string, unknown>[] = [];
  let districts: Record<string, unknown>[] = [];
  let cities: Record<string, unknown>[] = [];
  let stateRow: Record<string, unknown> | undefined;
  let districtRow: Record<string, unknown> | undefined;

  if (countryRow) {
    states = await query(
      `SELECT id, code, name FROM geo_states WHERE tenant_id = $1 AND country_id = $2 AND active = 1 ORDER BY name`,
      [DEFAULT_TENANT, countryRow.id],
    );
    stateRow = states.find(
      (s) =>
        String(s.code).toLowerCase() === state.toLowerCase() ||
        String(s.name).toLowerCase() === state.toLowerCase(),
    );
  }

  if (stateRow) {
    districts = await query(
      `SELECT id, code, name FROM geo_districts WHERE tenant_id = $1 AND state_id = $2 AND active = 1 ORDER BY name`,
      [DEFAULT_TENANT, stateRow.id],
    );
    districtRow = districts.find(
      (d) =>
        String(d.name).toLowerCase() === district.toLowerCase() ||
        String(d.code || '').toLowerCase() === district.toLowerCase(),
    );
    if (districtRow) {
      cities = await query(
        `SELECT id, name FROM geo_cities WHERE tenant_id = $1 AND state_id = $2 AND district_id = $3 AND active = 1 ORDER BY name`,
        [DEFAULT_TENANT, stateRow.id, districtRow.id],
      );
    } else {
      cities = await query(
        `SELECT id, name, district_id AS districtId FROM geo_cities
         WHERE tenant_id = $1 AND state_id = $2 AND active = 1 ORDER BY name LIMIT 300`,
        [DEFAULT_TENANT, stateRow.id],
      );
    }
  }

  res.json({
    countries,
    states,
    districts,
    cities,
    selected: {
      country: countryRow ?? null,
      state: stateRow ?? null,
      district: districtRow ?? null,
    },
  });
});

router.post('/seed', requireAuth, attachUser, requirePermission('settings', 'update'), async (_req, res) => {
  const result = await seedLocationMaster();
  res.json({ ok: true, ...result });
});

router.post('/districts', requireAuth, attachUser, requirePermission('settings', 'update'), async (req, res) => {
  const stateId = Number(req.body?.stateId);
  const name = String(req.body?.name || '').trim();
  const code = String(req.body?.code || '').trim() || null;
  if (!stateId || !name) return res.status(400).json({ error: 'stateId and name are required.' });
  const dup = await queryOne(
    'SELECT id FROM geo_districts WHERE tenant_id = $1 AND state_id = $2 AND name = $3',
    [DEFAULT_TENANT, stateId, name],
  );
  if (dup) return res.status(409).json({ error: 'District already exists.' });
  const id = await insert(
    'INSERT INTO geo_districts (tenant_id, state_id, code, name, active) VALUES ($1,$2,$3,$4,1)',
    [DEFAULT_TENANT, stateId, code, name],
  );
  res.status(201).json({ id });
});

router.post('/cities', requireAuth, attachUser, requirePermission('settings', 'update'), async (req, res) => {
  const stateId = Number(req.body?.stateId);
  const districtId = req.body?.districtId != null ? Number(req.body.districtId) : null;
  const name = String(req.body?.name || '').trim();
  if (!stateId || !name) return res.status(400).json({ error: 'stateId and name are required.' });
  const dup = districtId
    ? await queryOne(
        'SELECT id FROM geo_cities WHERE tenant_id = $1 AND state_id = $2 AND district_id = $3 AND name = $4',
        [DEFAULT_TENANT, stateId, districtId, name],
      )
    : await queryOne(
        'SELECT id FROM geo_cities WHERE tenant_id = $1 AND state_id = $2 AND district_id IS NULL AND name = $3',
        [DEFAULT_TENANT, stateId, name],
      );
  if (dup) return res.status(409).json({ error: 'City already exists.' });
  const id = await insert(
    'INSERT INTO geo_cities (tenant_id, state_id, district_id, name, active) VALUES ($1,$2,$3,$4,1)',
    [DEFAULT_TENANT, stateId, districtId, name],
  );
  res.status(201).json({ id });
});

router.patch('/districts/:id', requireAuth, attachUser, requirePermission('settings', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
  const active = req.body?.active != null ? (req.body.active ? 1 : 0) : undefined;
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  if (name !== undefined) {
    await query('UPDATE geo_districts SET name = $1 WHERE id = $2 AND tenant_id = $3', [name, id, DEFAULT_TENANT]);
  }
  if (active !== undefined) {
    await query('UPDATE geo_districts SET active = $1 WHERE id = $2 AND tenant_id = $3', [active, id, DEFAULT_TENANT]);
  }
  res.json({ ok: true });
});

router.patch('/cities/:id', requireAuth, attachUser, requirePermission('settings', 'update'), async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
  const active = req.body?.active != null ? (req.body.active ? 1 : 0) : undefined;
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  if (name !== undefined) {
    await query('UPDATE geo_cities SET name = $1 WHERE id = $2 AND tenant_id = $3', [name, id, DEFAULT_TENANT]);
  }
  if (active !== undefined) {
    await query('UPDATE geo_cities SET active = $1 WHERE id = $2 AND tenant_id = $3', [active, id, DEFAULT_TENANT]);
  }
  res.json({ ok: true });
});

router.get('/admin/summary', requireAuth, attachUser, requirePermission('settings', 'read'), async (_req, res) => {
  const tn = await queryOne<{ districts: number; cities: number }>(
    `SELECT
       (SELECT COUNT(*) FROM geo_districts d
        JOIN geo_states s ON s.id = d.state_id
        JOIN geo_countries c ON c.id = s.country_id
        WHERE d.tenant_id = $1 AND c.code = 'IN' AND s.code = 'TN' AND d.active = 1) AS districts,
       (SELECT COUNT(*) FROM geo_cities ci
        JOIN geo_states s ON s.id = ci.state_id
        JOIN geo_countries c ON c.id = s.country_id
        WHERE ci.tenant_id = $1 AND c.code = 'IN' AND s.code = 'TN' AND ci.active = 1) AS cities`,
    [DEFAULT_TENANT],
  );
  res.json({
    tamilNadu: { districts: Number(tn?.districts || 0), cities: Number(tn?.cities || 0) },
  });
});

export default router;
