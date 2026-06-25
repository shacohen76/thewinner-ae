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
// ============================================

import type { Metadata } from 'next';
import { CONFIG } from './utils';

const toArPath = (path: string): string => (path === '/' ? '/ar' : `/ar${path}`);

// `arIndexed` = does an indexable Arabic version of this page exist (DB-driven:
// the caller checks for an Arabic translation). When true we add the reciprocal
// `ar` hreflang; when false the cluster is en-AE + x-default only (byte-identical
// to the pre-Arabic English output). Never list a non-existent/noindex `ar`.
export function buildAlternates(
  path: string,
  locale: string,
  arIndexed = false,
): Metadata['alternates'] {
  const base = CONFIG.canonicalUrl;
  const enAbs = path === '/' ? base : `${base}${path}`;
  const arAbs = `${base}${toArPath(path)}`;

  // Order preserved as en-AE → (ar) → x-default.
  const languages: Record<string, string> = { 'en-AE': enAbs };
  if (arIndexed) {
    languages['ar'] = arAbs;
  }
  languages['x-default'] = enAbs;

  return {
    canonical: locale === 'ar' ? toArPath(path) : path,
    languages,
  };
}
