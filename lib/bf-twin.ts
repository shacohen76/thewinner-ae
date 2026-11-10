// ============================================
// Black Friday twin pages — slug parsing + season window (edge-safe: no DB, no utils)
// ============================================
// Created: 2026-11-10 (BF 1). Plan: AMZ_AFF/Docs_MD/BF_PAGES_PLAN_v0_1_2026_11_10.md
//
// /best/<base>-black-friday-deals is a CODE-ONLY twin of the English /best/<base> page for the
// Black Friday GAds campaigns (one page feed label per market, like the -spc pages). No DB row:
// the twin renders the base keyword's products (same cache entry) with the BF headline/title/meta
// from lib/title-bf.ts. A real keyword whose slug happens to end in the suffix always wins.
//
// SEO (Aug-21 index-bloat lesson): a twin is ALWAYS noindex,follow (page meta + middleware
// X-Robots-Tag), canonical → the base page, no hreflang, never in a sitemap or the allowlist.
// Season end: from BF_TWINS_END the middleware 301s every twin to its base page.
// Off unless NEXT_PUBLIC_BF_TWINS=1 (lib/feature-flags).
// ============================================

import { BF_TWINS_ENABLED } from '@/lib/feature-flags';

export const BF_SUFFIX = '-black-friday-deals';

// Runtime env (read per request in middleware) so the owner can move the date without a deploy.
const BF_TWINS_END_DEFAULT = '2026-12-03T00:00:00Z';

/** Base slug of an ENGLISH twin request, or null (flag off, other locale, no suffix). */
export function bfTwinBaseSlug(slug: string, locale: string): string | null {
  if (!BF_TWINS_ENABLED || locale !== 'en') return null;
  const s = slug.toLowerCase();
  if (!s.endsWith(BF_SUFFIX)) return null;
  const base = s.slice(0, -BF_SUFFIX.length);
  return base ? base : null;
}

/** True once the Black Friday season is over (twins then 301 to their base page). */
export function bfTwinsExpired(now: Date = new Date()): boolean {
  const end = Date.parse(process.env.BF_TWINS_END || BF_TWINS_END_DEFAULT);
  return Number.isFinite(end) && now.getTime() >= end;
}
