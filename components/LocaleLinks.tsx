// ============================================
// LocaleLinks.tsx — "other languages" internal-link nav (home + every /best page).
// Created 2026-09-29 (owner). For each supported locale OTHER than the current one,
// shows 3 links with NATIVE anchor text to that locale's page (lib/locale-links.ts),
// right under "More top picks" — connects en ↔ ja ↔ ar ↔ pt for crawlers + users.
// Server component → links are in the SSR HTML. Selection is DETERMINISTIC (seeded by
// the current slug, offset per locale): ISR-cache-safe, no hydration mismatch.
// Plain <a> on purpose: the target is a different locale (full navigation), and the
// hrefs are the canonical public paths. pt links render only when pt is routed
// (NEXT_PUBLIC_BR_PT_ENABLED), so a disabled locale is never linked.
// ============================================

import { routing } from '@/i18n/routing';
import { CROSS_LOCALE_POOL, LOCALE_LINK_META, LINK_LOCALES, type LinkLocale } from '@/lib/locale-links';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface LocaleLinksProps {
  /** Current page locale — its own group is omitted (More top picks covers it). */
  locale: string;
  /** Seed for the deterministic pick (the page slug; 'home' on the homepage). */
  seedKey: string;
  /** Links per language. */
  perLocale?: number;
}

export default function LocaleLinks({ locale, seedKey, perLocale = 3 }: LocaleLinksProps) {
  const routed = routing.locales as readonly string[];
  const targets = LINK_LOCALES.filter((l) => l !== locale && routed.includes(l));
  if (targets.length === 0) return null;

  const pool = CROSS_LOCALE_POOL.filter((p) => p.slug !== seedKey);
  const seed = hash(seedKey);
  const n = Math.min(perLocale, pool.length);

  return (
    <nav aria-label="Other languages" className="bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 pb-8 grid gap-4 sm:grid-cols-3">
        {targets.map((loc: LinkLocale, li) => {
          const meta = LOCALE_LINK_META[loc];
          const picks = Array.from({ length: n }, (_, i) => pool[(seed + li * 2 + i) % pool.length]);
          return (
            <div key={loc} lang={loc} dir={meta.dir}>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{meta.label}</div>
              <ul className="space-y-1 text-sm">
                {picks.map((p) => (
                  <li key={p.slug}>
                    <a href={meta.path(p.slug)} hrefLang={loc} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {meta.anchor(p[loc])}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
