// ============================================
// Black Friday twin pages — slug parsing + noindex switch (edge-safe: no DB, no utils)
// ============================================
// Created: 2026-11-10 (BF 1). Plan: AMZ_AFF/Docs_MD/BF_PAGES_PLAN_v0_1_2026_11_10.md
//
// /best/<base>-black-friday-deals is a CODE-ONLY twin of the English /best/<base> page for the
// Black Friday GAds campaigns (one page feed label per market). No DB row: the twin renders the
// base keyword's products (same cache entry) with the BF texts from lib/title-bf.ts. A real
// keyword whose slug happens to end in the suffix always wins.
//
// SEO (owner 2026-11-10): twins are INDEXABLE (index,follow, self-canonical) but are never put in
// a sitemap or the allowlist and nothing links to them (Google finds them only on its own).
// After the season: BF_TWINS_NOINDEX_AFTER (ISO date, runtime env) flips every twin to noindex —
// set it ahead of time and the flip happens on that date with no deploy. Unset = never.
// No -spc twins (owner D3) and no redirect (owner D6: the campaigns are stopped by hand).
// Off unless NEXT_PUBLIC_BF_TWINS=1 (lib/feature-flags).
// ============================================

import { BF_TWINS_ENABLED } from '@/lib/feature-flags';

export const BF_SUFFIX = '-black-friday-deals';

/** Base slug of an ENGLISH twin request, or null (flag off, other locale, no suffix, -spc base). */
export function bfTwinBaseSlug(slug: string, locale: string): string | null {
  if (!BF_TWINS_ENABLED || locale !== 'en') return null;
  const s = slug.toLowerCase();
  if (!s.endsWith(BF_SUFFIX)) return null;
  const base = s.slice(0, -BF_SUFFIX.length);
  if (!base || base.endsWith('-spc')) return null;
  return base;
}

/** True once BF_TWINS_NOINDEX_AFTER is set and reached (twins then turn noindex). */
export function bfTwinsNoindex(now: Date = new Date()): boolean {
  const raw = process.env.BF_TWINS_NOINDEX_AFTER;
  if (!raw) return false;
  const t = Date.parse(raw);
  return Number.isFinite(t) && now.getTime() >= t;
}
