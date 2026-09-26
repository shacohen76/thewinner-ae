// ============================================
// Cache tags + saved-page copies for /best pages — ONE place for both.
// ============================================
// 2026-09-23 (Vercel cost fix — scoped refresh signals). WHY: every /best slug is
// saved as one ISR copy per (locale × market) — see middleware + page.tsx. A refresh
// signal used to mark ALL copies (e.g. an Arabic title change also rebuilt every
// English copy = wasted ISR writes). Now a signal can name the locale and/or market
// that changed, and only those copies are marked.
//
// GROWTH: nothing here lists markets or languages. They come from geo-config
// (CATALOG_MARKETPLACES, LOCALE_CATALOG) and i18n routing (routing.locales), so a
// new market or language is picked up automatically.
// ============================================

import { CATALOG_MARKETPLACES, LOCALE_CATALOG, isCatalogMarket } from '@/lib/geo-config';
import { routing } from '@/i18n/routing';

/** Tag on EVERY copy of a slug's product data (unscoped purge = today's behaviour). */
export function catalogTag(slug: string): string {
  return `catalog:${slug}`;
}

/** Tag on ONE copy (locale × market) of a slug's product data. */
export function catalogCopyTag(slug: string, market: string, locale: string): string {
  return `catalog:${slug}:${market}:${locale}`;
}

export interface BestPageCopy {
  locale: string;
  market: string;
  path: string; // internal ISR path the middleware rewrites /best/<slug> to
}

/**
 * The saved copies of /best/<slug>, optionally narrowed to one locale and/or market.
 * A locale pinned to one catalog (LOCALE_CATALOG, e.g. ja→jp) only ever has that
 * market's copy; other locales follow the visitor's geo (every catalog market).
 */
export function bestPageCopies(slug: string, opts: { locale?: string; market?: string } = {}): BestPageCopy[] {
  const copies: BestPageCopy[] = [];
  const locales = opts.locale ? [opts.locale] : [...routing.locales];
  for (const locale of locales) {
    const markets = LOCALE_CATALOG[locale] ? [LOCALE_CATALOG[locale]] : Array.from(CATALOG_MARKETPLACES);
    for (const market of markets) {
      if (opts.market && market !== opts.market) continue;
      copies.push({ locale, market, path: `/${locale}/best/${market}/${slug}` });
    }
  }
  return copies;
}

export function isKnownLocale(locale: string): boolean {
  return (routing.locales as readonly string[]).includes(locale);
}

// 2026-09-26 (BR 1): also accept locale-pinned markets (br via pt) so a scoped
// refresh signal for market='br' is not rejected. Unchanged while BR_PT is off.
export function isKnownMarket(market: string): boolean {
  return isCatalogMarket(market);
}
