'use client';
// ============================================
// LanguageSwitcher.tsx — INTL1 Phase 3 (the launch)
// ============================================
// Created: 2026-06-03 (INTL1 Phase 3 — index + hreflang launch)
//
// Minimal GLOBE-ICON language chooser — the /ar exposure point (first UI that
// links English <-> Arabic). The header shows ONLY a globe; clicking it opens a
// small menu listing the available languages in their own script. English is
// the default/main; more languages slot in automatically (driven by
// routing.locales — to add one: add it to i18n/routing.ts + LANGUAGE_NAMES).
//
// Each option is a plain <a> (full reload — correct for a language switch) to
// that locale's version of the CURRENT page. next-intl usePathname() gives the
// path WITHOUT the locale prefix, so we build: default locale → prefix-less
// path; any other → "/<locale>" + path. Locale detection is OFF (i18n/routing),
// so these clean links are never bounced by a stale NEXT_LOCALE cookie. The geo
// axis (tw_geo / Amazon program) is untouched — this only swaps the language.
// ============================================

import { useState, useRef, useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { routing } from '@/i18n/routing';

// Native-script display name per locale. Add new languages here as they launch.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
};

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hrefFor = (l: string) =>
    l === routing.defaultLocale ? pathname || '/' : `/${l}${pathname === '/' ? '' : pathname}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={locale === 'ar' ? 'تغيير اللغة' : 'Change language'}
        className="flex items-center text-gray-600 hover:text-blue-600 transition-colors p-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-40 bg-white rounded-xl shadow-lg border py-1 z-50"
        >
          {routing.locales.map((l) => (
            <a
              key={l}
              href={hrefFor(l)}
              hrefLang={l === 'en' ? 'en-AE' : l}
              role="menuitem"
              aria-current={l === locale ? 'true' : undefined}
              className={`block px-4 py-2 text-sm hover:bg-gray-50 ${
                l === locale ? 'font-semibold text-blue-600' : 'text-gray-700'
              }`}
            >
              {LANGUAGE_NAMES[l] ?? l}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
