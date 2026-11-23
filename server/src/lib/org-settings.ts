import { DEFAULT_TENANT, query, queryOne } from '../db.js';

export type ReportingCurrency = 'INR' | 'USD';

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  INR: 83,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.36,
  JPY: 150,
};

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function getOrgSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await queryOne<{ value: unknown }>(
    'SELECT value FROM organization_settings WHERE tenant_id = $1 AND `key` = $2',
    [DEFAULT_TENANT, key],
  );
  return parseJson(row?.value ?? null, fallback);
}

export async function setOrgSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO organization_settings (tenant_id, \`key\`, value) VALUES ($1,$2,$3)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [DEFAULT_TENANT, key, JSON.stringify(value)],
  );
}

export async function getReportingCurrency(): Promise<ReportingCurrency> {
  const company = await getOrgSetting<{ currency?: string }>('company', {});
  const code = String(company.currency || 'INR').toUpperCase();
  return code === 'USD' ? 'USD' : 'INR';
}

/** How `employees.salary` is stored. Default monthly (INR-style); annual for legacy USD seeds. */
export type SalaryBasis = 'monthly' | 'annual';

export async function getSalaryBasis(): Promise<SalaryBasis> {
  const company = await getOrgSetting<{ salaryBasis?: string; currency?: string }>('company', {});
  const raw = String(company.salaryBasis || '').toLowerCase();
  if (raw === 'annual' || raw === 'monthly') return raw;
  // Sensible default: INR → monthly, otherwise annual (legacy US seed)
  const currency = String(company.currency || 'INR').toUpperCase();
  return currency === 'USD' ? 'annual' : 'monthly';
}

/** Convert stored employee.salary into a monthly amount for payroll/dashboards. */
export function toMonthlySalary(stored: number, basis: SalaryBasis): number {
  const n = Number(stored) || 0;
  return basis === 'annual' ? Math.round((n / 12) * 100) / 100 : n;
}

export async function getCompanyTimezone(): Promise<string> {
  const company = await getOrgSetting<{ timezone?: string }>('company', {});
  return company.timezone || 'Asia/Kolkata';
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  const stored = await getOrgSetting<Record<string, number>>('exchange_rates', {});
  return { ...DEFAULT_EXCHANGE_RATES, ...stored };
}

/** Convert amount between currencies using USD-base rates. Never invent rates for unknown codes. */
export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>,
): number {
  const from = rates[fromCode.toUpperCase()];
  const to = rates[toCode.toUpperCase()];
  if (!from || !to || fromCode.toUpperCase() === toCode.toUpperCase()) return amount;
  const inUsd = amount / from;
  return inUsd * to;
}
