import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { brandingApi, type BrandingCompany, type BrandingTheme } from './api';

type BrandingState = {
  company: BrandingCompany;
  theme: BrandingTheme;
  logoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const defaults: BrandingState = {
  company: {
    name: 'Automystics',
    legalName: 'Automystics Technologies Private Limited',
    address: '',
    phone: '',
    email: '',
    website: '',
  },
  theme: {
    primary: '#0b57f0',
    secondary: '#0a2a7a',
    accent: '#1d6bff',
    mode: 'system',
  },
  logoUrl: null,
  loading: true,
  refresh: async () => {},
};

const BrandingContext = createContext<BrandingState>(defaults);

/** Blend a hex color toward white (0 = original, 1 = white). */
function mixWithWhite(hex: string, amount: number): string {
  const raw = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function applyThemeVars(theme: BrandingTheme) {
  const root = document.documentElement;
  const primary = theme.primary || '#0b57f0';
  const secondary = theme.secondary || '#0a2a7a';
  const accent = theme.accent || '#1d6bff';

  // Solid action color for all primary buttons / CTAs
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', '#ffffff');
  root.style.setProperty('--ring', accent);

  // Soft surfaces derived from primary so outline/secondary/ghost stay uniform
  root.style.setProperty('--secondary', mixWithWhite(primary, 0.9));
  root.style.setProperty('--secondary-foreground', primary);
  root.style.setProperty('--accent', mixWithWhite(primary, 0.88));
  root.style.setProperty('--accent-foreground', primary);

  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-accent', accent);

  // Side navigation panel
  root.style.setProperty('--sidebar-from', primary);
  root.style.setProperty('--sidebar-to', secondary);
  root.style.setProperty('--sidebar-accent', accent);
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<BrandingCompany>(defaults.company);
  const [theme, setTheme] = useState<BrandingTheme>(defaults.theme);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await brandingApi.get();
      setCompany({ ...defaults.company, ...data.company });
      const nextTheme = { ...defaults.theme, ...data.theme };
      setTheme(nextTheme);
      applyThemeVars(nextTheme);
      setLogoUrl(data.logoUrl ? `${data.logoUrl}?t=${Date.now()}` : null);
    } catch {
      applyThemeVars(defaults.theme);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ company, theme, logoUrl, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
