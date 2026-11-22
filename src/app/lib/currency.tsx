import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface Currency { code: string; symbol: string; locale: string; rate: number }

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
  currencyFor: (id: string | number, country: string) => Currency;
  setCurrency: (id: string | number, code: string) => void;
  isOverridden: (id: string | number) => boolean;
}

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(overrides)); }, [overrides]);

  const currencyFor = useCallback(
    (id: string | number, country: string) =>
      currencies[overrides[String(id)] ?? countries[country] ?? 'USD'] ?? currencies.USD,
    [overrides],
  );
  const setCurrency = useCallback((id: string | number, code: string) => setOverrides((o) => ({ ...o, [String(id)]: code })), []);
  const isOverridden = useCallback((id: string | number) => String(id) in overrides, [overrides]);

  return <CurrencyContext.Provider value={{ currencyFor, setCurrency, isOverridden }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const c = useContext(CurrencyContext);
  if (!c) throw new Error('useCurrency must be used inside CurrencyProvider');
  return c;
}

export function formatMoney(usd: number, cur: Currency, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat(cur.locale, {
    style: 'currency',
    currency: cur.code,
    maximumFractionDigits: 0,
    ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(usd * cur.rate);
}