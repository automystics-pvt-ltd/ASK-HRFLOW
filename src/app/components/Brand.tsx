import React from 'react';
import wordmarkDark from '../../assets/automystics-wordmark-dark.svg';
import wordmarkLight from '../../assets/automystics-wordmark-light.svg';
import { useBranding } from '../lib/branding';

/**
 * Transparent Automystics logo that adapts to its surface.
 * Uses uploaded branding logo when set; otherwise default wordmarks.
 * onDark: always the light-text version (navy sidebar).
 * otherwise: dark text in light mode, light text in dark mode.
 */
export function CompanyLogo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  const { logoUrl, company } = useBranding();
  const alt = company.legalName || company.name || 'Automystics Technologies Private Limited';

  if (logoUrl) {
    return <img src={logoUrl} alt={alt} className={`h-auto max-h-full w-auto object-contain ${className}`} />;
  }

  if (onDark) return <img src={wordmarkLight} alt={alt} className={`h-auto ${className}`} />;
  return (
    <>
      <img src={wordmarkDark} alt={alt} className={`h-auto dark:hidden ${className}`} />
      <img src={wordmarkLight} alt={alt} className={`h-auto hidden dark:block ${className}`} />
    </>
  );
}

/** Compact mark used in headers — fixed box so any uploaded aspect ratio stays aligned. */
function LogoMark({
  onDark = false,
  size = 'md',
}: {
  onDark?: boolean;
  size?: 'sm' | 'md';
}) {
  const { logoUrl, company } = useBranding();
  const alt = company.legalName || company.name || 'Company logo';
  const box = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  const img = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const shell = onDark
    ? 'bg-white/10 ring-1 ring-white/15'
    : 'bg-accent/70 ring-1 ring-border';

  if (!logoUrl) return null;

  return (
    <div
      className={`shrink-0 ${box} rounded-lg ${shell} flex items-center justify-center overflow-hidden`}
      aria-hidden={false}
    >
      <img src={logoUrl} alt={alt} className={`${img} object-contain`} />
    </div>
  );
}

/**
 * Sidebar / drawer header: uploaded logo sits beside the company name
 * (top-corner lockup). Falls back to the Automystics wordmark when no logo.
 */
export function BrandLockup({ onDark = false }: { onDark?: boolean }) {
  const { company, logoUrl } = useBranding();
  const companyName = company.name || 'Automystics';
  const nameClass = onDark ? 'text-white' : 'text-foreground';
  const mutedClass = onDark ? 'text-[#9db3e6]' : 'text-muted-foreground';

  if (logoUrl) {
    return (
      <div className="flex flex-col gap-3 min-w-0" data-brand="custom-logo">
        <div className="flex items-center gap-3 min-w-0">
          <LogoMark onDark={onDark} size="md" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className={`text-sm font-semibold truncate ${nameClass}`}>{companyName}</p>
            <p className={`text-[10px] font-semibold tracking-[0.14em] uppercase mt-1 ${mutedClass}`}>
              ASK HRFlow
            </p>
          </div>
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

/**
 * Sticky app-bar brand chip.
 * When Admin has uploaded a logo: logo mark + company name, left-aligned.
 * Without a custom logo: compact default wordmark only (company name lives in the sidebar lockup).
 */
export function HeaderBrand({ className = '' }: { className?: string }) {
  const { company, logoUrl } = useBranding();
  const companyName = company.name || 'Automystics';

  if (!logoUrl) {
    return (
      <div className={`flex items-center min-w-0 max-w-[9rem] sm:max-w-[11rem] md:hidden ${className}`}>
        <CompanyLogo className="h-7 w-auto max-w-full" />
        <span className="sr-only">{companyName}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 min-w-0 max-w-[46vw] sm:max-w-[15rem] ${className}`}
      data-brand="header-logo"
      title={companyName}
    >
      <LogoMark size="sm" />
      <span className="text-sm font-semibold truncate text-foreground leading-none">{companyName}</span>
    </div>
  );
}
