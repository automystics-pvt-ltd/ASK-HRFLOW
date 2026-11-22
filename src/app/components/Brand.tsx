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
    return <img src={logoUrl} alt={alt} className={`h-auto object-contain ${className}`} />;
  }

  if (onDark) return <img src={wordmarkLight} alt={alt} className={`h-auto ${className}`} />;
  return (
    <>
      <img src={wordmarkDark} alt={alt} className={`h-auto dark:hidden ${className}`} />
      <img src={wordmarkLight} alt={alt} className={`h-auto hidden dark:block ${className}`} />
    </>
  );
}

/** Sidebar / menu header: company logo with the product name beneath. */
export function BrandLockup({ onDark = false }: { onDark?: boolean }) {
  const { company } = useBranding();
  const companyName = company.name || 'Automystics';
  return (
    <div className="flex flex-col gap-3">
      <CompanyLogo onDark={onDark} className="w-full max-w-[210px]" />
      <div className={`text-xs font-medium truncate ${onDark ? 'text-[#9db3e6]' : 'text-muted-foreground'}`}>
        {companyName}
      </div>
      <div className={`flex items-center gap-2 text-xs ${onDark ? 'text-[#9db3e6]' : 'text-muted-foreground'}`}>
        <span className={`h-px flex-1 ${onDark ? 'bg-white/20' : 'bg-border'}`} />
        <span className="font-semibold tracking-[0.14em] uppercase">ASK HRFlow</span>
        <span className={`h-px flex-1 ${onDark ? 'bg-white/20' : 'bg-border'}`} />
      </div>
    </div>
  );
}
