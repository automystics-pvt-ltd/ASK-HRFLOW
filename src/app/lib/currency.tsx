import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { brandingApi } from './api';

export interface Currency { code: string; symbol: string; locale: string; /** units per 1 USD (display FX only) */ rate: number }

export const currencies: Record<string, Currency> = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US', rate: 1 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', rate: 0.92 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', rate: 0.79 },
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', rate: 83 },
  AED: { code: 'AED', symbol: 'AED', locale: 'en-AE', rate: 3.67 },
  SAR: { code: 'SAR', symbol: 'SAR', locale: 'en-SA', rate: 3.75 },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG', rate: 1.34 },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU', rate: 1.52 },
  CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA', rate: 1.36 },
  JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP', rate: 150 },
};

export const countries: Record<string, string> = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Germany: 'EUR',
  France: 'EUR',
  India: 'INR',
  'United Arab Emirates': 'AED',
  'Saudi Arabia': 'SAR',
  Singapore: 'SGD',
  Australia: 'AUD',
  Canada: 'CAD',
  Japan: 'JPY',
};

const KEY = 'hrflow.currency-overrides.v1';

interface Ctx {
  /** Company reporting currency (INR or USD) — source of truth for dashboards/payroll */
  reporting: Currency;
  reportingCode: 'INR' | 'USD';
  timezone: string;
  exchangeRates: Record<string, number>;
  currencyFor: (id: string | number, country: string) => Currency;
  setCurrency: (id: string | number, code: string) => void;
  isOverridden: (id: string | number) => boolean;
  refreshOrg: () => Promise<void>;
}

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });
  const [reportingCode, setReportingCode] = useState<'INR' | 'USD'>('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.values(currencies).map((c) => [c.code, c.rate])),
  );

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(overrides)); }, [overrides]);

  const refreshOrg = useCallback(async () => {
    try {
      const data = await brandingApi.get();
      const code = String(data.company?.currency || 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
      setReportingCode(code);
      if (data.company?.timezone) setTimezone(String(data.company.timezone));
    } catch {
      /* keep defaults */
    }
    try {
      const { rates } = await brandingApi.exchangeRates();
      if (rates && typeof rates === 'object') {
        setExchangeRates((prev) => ({ ...prev, ...rates, USD: 1 }));
      }
    } catch {
      /* optional endpoint */
    }
  }, []);

  useEffect(() => {
    void refreshOrg();
  }, [refreshOrg]);

  const reporting = useMemo(
    () => currencies[reportingCode] ?? currencies.INR,
    [reportingCode],
  );

  const currencyFor = useCallback(
    (id: string | number, country: string) => {
      const override = overrides[String(id)];
      if (override && currencies[override]) return currencies[override];
      // Prefer company reporting currency for financial consistency
      return reporting;
      void country;
    },
    [overrides, reporting],
  );
  const setCurrency = useCallback((id: string | number, code: string) => setOverrides((o) => ({ ...o, [String(id)]: code })), []);
  const isOverridden = useCallback((id: string | number) => String(id) in overrides, [overrides]);

  const value = useMemo(
    () => ({
      reporting,
      reportingCode,
      timezone,
      exchangeRates,
      currencyFor,
      setCurrency,
      isOverridden,
      refreshOrg,
    }),
    [reporting, reportingCode, timezone, exchangeRates, currencyFor, setCurrency, isOverridden, refreshOrg],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const c = useContext(CurrencyContext);
  if (!c) throw new Error('useCurrency must be used inside CurrencyProvider');
  return c;
}

/**
 * Format an amount already denominated in `cur` (no FX multiply).
 * Historical payroll/payslips must pass the snapshotted currency_code — never re-convert.
 */
export function formatMoney(amount: number, cur: Currency, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat(cur.locale, {
    style: 'currency',
    currency: cur.code,
    maximumFractionDigits: 0,
    ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(Number(amount) || 0);
}

/** Convert using USD-base rates. Only for display when source ≠ target; never mutate stored records. */
export function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>,
): number {
  const from = rates[fromCode.toUpperCase()];
  const to = rates[toCode.toUpperCase()];
  if (!from || !to || fromCode.toUpperCase() === toCode.toUpperCase()) return amount;
  return (amount / from) * to;
}

export function currencyByCode(code?: string | null): Currency {
  const c = String(code || 'INR').toUpperCase();
  return currencies[c] ?? currencies.INR;
}
