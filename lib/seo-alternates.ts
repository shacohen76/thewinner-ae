// ============================================
// INTL1 Phase 3 — locale-aware canonical + hreflang (defined ONCE)
// ============================================
// Created: 2026-06-03 (INTL1 Phase 3 — index + hreflang launch)
//
// Every localized page that participates in Arabic indexing builds its
// <link rel="canonical"> + hreflang cluster through this helper, so the rule
// lives in ONE place and can't drift into the §6 de-index mistake (an Arabic
// page canonicalizing to English).
//
// RULES (roadmap v2_0 §6 / §Phase 3):
//   • Self-canonical per locale. English page → English URL; Arabic page → its
//     OWN /ar URL. NEVER Arabic→English (that de-indexes Arabic).
//   • hreflang cluster: keep `en-AE`, add plain `ar` ONLY when the Arabic page
//     is in the indexing allowlist, `x-default` → English. The same cluster is
//     emitted by BOTH the English and the Arabic version of a page (reciprocal).
//   • `ar` is OMITTED while the Arabic page is noindex — never list a noindex
//     page as an hreflang alternate ("no return tags").
//
// `path` is the prefix-less English path (e.g. '/', '/best/earbuds'). Canonical
// is emitted RELATIVE so it resolves against `metadataBase` (the English
// canonical host) exactly as the previous inline blocks did. With the allowlist
// empty, the English output is byte-identical to before → PR 3.1 is a no-op.
//
// INTL1 JP Phase 2 (2026-07-06): generalized from a single `arIndexed` boolean to
// an `indexedLocales` list so EACH non-English page (ar, ja, …) that is indexable
// gets a reciprocal hreflang. The EN output stays byte-identical while no `ja`
// pages are indexed yet — 'ja' only joins the cluster once its noun+BYG land.
// ============================================

import type { Metadata } from 'next';
import { CONFIG } from './utils';

// Prefix-less English path → the localized path for `locale` (e.g. '/ar/best/x').
const toLocalePath = (path: string, locale: string): string =>
  path === '/' ? `/${locale}` : `/${locale}${path}`;

// `indexedLocales` = the non-English locales whose version of THIS page is
// indexable (DB-driven: the caller checks each locale's translation for
// noun + BYG). We add a reciprocal hreflang for each; a locale that is not
// indexed is NEVER listed ("no return tags" for noindex pages). With the list
// empty the cluster is en-AE + x-default only — byte-identical to the pre-i18n
// English output.
// 2026-09-10 (seo index allowlist): added `enIndexed`. Once we deindex most
// English pages (keep-best-~1K strategy), a slug's ENGLISH version may be
// noindex while its ar/ja version stays indexed (each locale has its own
// allowlist). Google's rule is "no return tags for noindex pages", so the
// hreflang cluster must list ONLY indexed locales. When English is deindexed we
// drop `en-AE` and re-home `x-default` onto the first indexed localized page —
// so a kept ar/ja page is NEVER dragged down by pointing at a noindex EN URL.
// The page stays SELF-canonical regardless (a noindex page self-canonical is
// correct — it must not canonicalize onto another URL).
export function buildAlternates(
  path: string,
  locale: string,
  indexedLocales: string[] = [],
  enIndexed: boolean = true,
): Metadata['alternates'] {
  const base = CONFIG.canonicalUrl;
  const enAbs = path === '/' ? base : `${base}${path}`;

  // Order: en-AE (only if English is indexed) → (localized…) → x-default. The
  // hreflang key is the plain locale code (ar, ja); en uses region 'en-AE'.
  const languages: Record<string, string> = {};
  if (enIndexed) languages['en-AE'] = enAbs;
  for (const loc of indexedLocales) {
    languages[loc] = `${base}${toLocalePath(path, loc)}`;
  }
  // x-default → the indexed English page; if English is deindexed, the first
  // indexed localized page; if nothing is indexed, omit it (no valid target).
  if (enIndexed) languages['x-default'] = enAbs;
  else if (indexedLocales.length) languages['x-default'] = `${base}${toLocalePath(path, indexedLocales[0])}`;

  return {
    // Self-canonical per locale: English → prefix-less path; any localized page
    // → its own /<locale> URL. NEVER localized → English (that de-indexes it).
    canonical: locale === 'en' ? path : toLocalePath(path, locale),
    languages,
  };
}
