import React from 'react';
import wordmarkDark from '../../assets/automystics-wordmark-dark.svg';
import wordmarkLight from '../../assets/automystics-wordmark-light.svg';
import { useBranding } from '../lib/branding';
import type { BrandingTheme } from '../lib/api';

/** Logo display sizes (height). Width scales with original aspect ratio. */
export const LOGO_SIZE_PX: Record<NonNullable<BrandingTheme['logoSize']>, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

export function logoSizeKey(theme?: BrandingTheme | null): NonNullable<BrandingTheme['logoSize']> {
  const s = theme?.logoSize;
  return s === 'sm' || s === 'md' || s === 'lg' || s === 'xl' ? s : 'md';
}

/**
 * Transparent Automystics logo that adapts to its surface.
 * Uses uploaded branding logo when set; otherwise default wordmarks.
 * onDark: always the light-text version (navy sidebar).
 * otherwise: dark text in light mode, light text in dark mode.
 */
export function CompanyLogo({
  onDark = false,
  className = '',
  size,
}: {
  onDark?: boolean;
  className?: string;
  /** Override theme logoSize */
  size?: NonNullable<BrandingTheme['logoSize']>;
}) {
  const { logoUrl, company, theme } = useBranding();
  const alt = company.legalName || company.name || 'Automystics Technologies Private Limited';
  const key = size || logoSizeKey(theme);
  const maxH = LOGO_SIZE_PX[key];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={`h-auto w-auto object-contain ${className}`}
        style={{ maxHeight: maxH }}
      />
    );
  }

  if (onDark) return <img src={wordmarkLight} alt={alt} className={`h-auto ${className}`} style={{ maxHeight: maxH }} />;
  return (
    <>
      <img src={wordmarkDark} alt={alt} className={`h-auto dark:hidden ${className}`} style={{ maxHeight: maxH }} />
      <img
        src={wordmarkLight}
        alt={alt}
        className={`h-auto hidden dark:block ${className}`}
        style={{ maxHeight: maxH }}
      />
    </>
  );
}

/**
 * Sidebar / drawer header brand.
 * Uploaded logos auto-fit (square or wide) beside the company name.
 * No logo: default Automystics wordmark + product label.
 */
export function BrandLockup({ onDark = false }: { onDark?: boolean }) {
  const { company, logoUrl, theme } = useBranding();
  const companyName = company.name || 'Automystics';
  const nameClass = onDark ? 'text-white' : 'text-foreground';
  const mutedClass = onDark ? 'text-[#9db3e6]' : 'text-muted-foreground';
  const alt = company.legalName || companyName;
  const key = logoSizeKey(theme);
  const maxH = LOGO_SIZE_PX[key];
  const wellH = Math.max(maxH + 12, 40);
  const wellMaxW = Math.round(maxH * 3.2);

  if (logoUrl) {
    return (
      <div className="flex items-center gap-3 min-w-0" data-brand="custom-logo">
        <div
          className={[
            'shrink-0 min-w-[2.75rem] px-1.5 rounded-xl',
            'flex items-center justify-center overflow-hidden',
            onDark ? 'bg-white/10' : 'bg-muted/60 ring-1 ring-border/50',
          ].join(' ')}
          style={{ height: wellH, maxWidth: wellMaxW }}
        >
          <img
            src={logoUrl}
            alt={alt}
            className="w-auto h-auto object-contain"
            style={{ maxHeight: maxH, maxWidth: wellMaxW - 12 }}
          />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className={`text-sm font-semibold truncate ${nameClass}`} title={companyName}>
            {companyName}
          </p>
          <p className={`text-[10px] font-semibold tracking-[0.14em] uppercase mt-1 ${mutedClass}`}>
            ASK HRFlow
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-w-0" data-brand="default-wordmark">
      <CompanyLogo onDark={onDark} className="w-full max-w-[210px]" />
      <div className={`text-xs font-medium truncate ${mutedClass}`}>{companyName}</div>
      <div className={`flex items-center gap-2 text-xs ${mutedClass}`}>
        <span className={`h-px flex-1 ${onDark ? 'bg-white/20' : 'bg-border'}`} />
        <span className="font-semibold tracking-[0.14em] uppercase">ASK HRFlow</span>
        <span className={`h-px flex-1 ${onDark ? 'bg-white/20' : 'bg-border'}`} />
      </div>
    </div>
  );
}
