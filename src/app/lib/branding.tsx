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
    primary: '#1e3a5f',
    secondary: '#3b82f6',
    accent: '#0ea5e9',
    mode: 'system',
  },
  logoUrl: null,
  loading: true,
  refresh: async () => {},
};

const BrandingContext = createContext<BrandingState>(defaults);

function applyThemeVars(theme: BrandingTheme) {
  const root = document.documentElement;
  if (theme.primary) root.style.setProperty('--primary', theme.primary);
  if (theme.secondary) root.style.setProperty('--secondary', theme.secondary);
  if (theme.accent) root.style.setProperty('--accent', theme.accent);
  // Also set common HSL-free fallbacks used by the shell
  if (theme.primary) root.style.setProperty('--brand-primary', theme.primary);
  if (theme.secondary) root.style.setProperty('--brand-secondary', theme.secondary);
  if (theme.accent) root.style.setProperty('--brand-accent', theme.accent);
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
