import { DEFAULT_TENANT, query, queryOne } from '../db.js';
import { TN_DISTRICTS } from './tn-districts.js';

/** Minimal India + other countries so the master is usable beyond TN. */
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
];

const IN_STATES: { code: string; name: string }[] = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TS', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
];

async function ensureCountry(code: string, name: string): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM geo_countries WHERE tenant_id = $1 AND code = $2',
    [DEFAULT_TENANT, code],
  );
  if (existing) return Number(existing.id);
  await query(
    'INSERT INTO geo_countries (tenant_id, code, name, active) VALUES ($1,$2,$3,1)',
    [DEFAULT_TENANT, code, name],
  );
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM geo_countries WHERE tenant_id = $1 AND code = $2',
    [DEFAULT_TENANT, code],
  );
  return Number(row!.id);
}

async function ensureState(countryId: number, code: string, name: string): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM geo_states WHERE tenant_id = $1 AND country_id = $2 AND code = $3',
    [DEFAULT_TENANT, countryId, code],
  );
  if (existing) return Number(existing.id);
  await query(
    'INSERT INTO geo_states (tenant_id, country_id, code, name, active) VALUES ($1,$2,$3,$4,1)',
    [DEFAULT_TENANT, countryId, code, name],
  );
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM geo_states WHERE tenant_id = $1 AND country_id = $2 AND code = $3',
    [DEFAULT_TENANT, countryId, code],
  );
  return Number(row!.id);
}

async function ensureDistrict(stateId: number, code: string, name: string): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM geo_districts WHERE tenant_id = $1 AND state_id = $2 AND name = $3',
    [DEFAULT_TENANT, stateId, name],
  );
  if (existing) return Number(existing.id);
  await query(
    'INSERT INTO geo_districts (tenant_id, state_id, code, name, active) VALUES ($1,$2,$3,$4,1)',
    [DEFAULT_TENANT, stateId, code, name],
  );
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM geo_districts WHERE tenant_id = $1 AND state_id = $2 AND name = $3',
    [DEFAULT_TENANT, stateId, name],
  );
  return Number(row!.id);
}

async function ensureCity(stateId: number, districtId: number | null, name: string) {
  const existing = districtId
    ? await queryOne<{ id: number }>(
        `SELECT id FROM geo_cities
         WHERE tenant_id = $1 AND state_id = $2 AND name = $3 AND district_id = $4 LIMIT 1`,
        [DEFAULT_TENANT, stateId, name, districtId],
      )
    : await queryOne<{ id: number }>(
        `SELECT id FROM geo_cities
         WHERE tenant_id = $1 AND state_id = $2 AND name = $3 AND district_id IS NULL LIMIT 1`,
        [DEFAULT_TENANT, stateId, name],
      );
  if (existing) return;
  await query(
    'INSERT INTO geo_cities (tenant_id, state_id, district_id, name, active) VALUES ($1,$2,$3,$4,1)',
    [DEFAULT_TENANT, stateId, districtId, name],
  );
}

/** Idempotent seed of location master + full Tamil Nadu district/city coverage. */
export async function seedLocationMaster(): Promise<{ countries: number; tnDistricts: number; tnCities: number }> {
  for (const c of COUNTRIES) {
    await ensureCountry(c.code, c.name);
  }
  const indiaId = await ensureCountry('IN', 'India');
  for (const s of IN_STATES) {
    await ensureState(indiaId, s.code, s.name);
  }

  const tn = await queryOne<{ id: number }>(
    `SELECT s.id FROM geo_states s
     JOIN geo_countries c ON c.id = s.country_id
     WHERE s.tenant_id = $1 AND c.code = 'IN' AND s.code = 'TN'`,
    [DEFAULT_TENANT],
  );
  if (!tn) return { countries: COUNTRIES.length, tnDistricts: 0, tnCities: 0 };

  let tnCities = 0;
  for (const d of TN_DISTRICTS) {
    const districtId = await ensureDistrict(Number(tn.id), d.code, d.name);
    for (const city of d.cities) {
      await ensureCity(Number(tn.id), districtId, city);
      tnCities += 1;
    }
  }

  // Light seed for a few other IN states (cities without districts) for expansion UX
  const extra: Record<string, string[]> = {
    KA: ['Bengaluru', 'Bangalore', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
    KL: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
    MH: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
    DL: ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
  };
  for (const [code, cities] of Object.entries(extra)) {
    const st = await queryOne<{ id: number }>(
      'SELECT id FROM geo_states WHERE tenant_id = $1 AND country_id = $2 AND code = $3',
      [DEFAULT_TENANT, indiaId, code],
    );
    if (!st) continue;
    for (const city of cities) await ensureCity(Number(st.id), null, city);
  }

  return { countries: COUNTRIES.length, tnDistricts: TN_DISTRICTS.length, tnCities };
}
