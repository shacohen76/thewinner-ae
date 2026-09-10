// ============================================================
// SEO INDEX ALLOWLIST — the ~1K-best-per-locale gate (server-only)
// ============================================================
// Created 2026-09-10 (deindex-most / keep-best recovery).
//
// WHY: the Aug-21 crash was self-inflicted index bloat (~79K thin/low-CTR
// pages across en/ar/ja) → sitewide quality demotion. We keep ONLY the pages
// that earn traffic and `noindex,follow` the rest (pages stay live; affiliate
// clicks unaffected; fully reversible). The kept set lives in the Supabase
// table `seo_index_allowlist` (locale, slug, active). Maintained OUT OF BAND by
// scripts/amz_seo_index_manager_v1.py (in AMZ_AFF) — the site only READS it, so
// growing the allowlist weekly needs NO code deploy.
//
// SIGNAL (how the set is chosen, for reference): affiliate CLICKOUTS per market
// (click_log = money) COMBINED with Google performance (GSC), per-market
// guaranteed. ar/ja are restricted to quality-pass pages (noun + BYG). Each
// locale is INDEPENDENT: /ja/best/x can index on the JA list even when the EN
// /best/x is deindexed, and vice-versa.
//
// FAIL-OPEN (critical): if the table can't be read (DB hiccup, missing env),
// this returns EMPTY sets and callers MUST treat "empty set" as "do not
// restrict" (index as before). Never let a transient read failure deindex the
// whole site. Cached 1h so weekly allowlist edits propagate without a deploy.
// ============================================================
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export type Locale = 'en' | 'ar' | 'ja';
export type Allowlist = Record<Locale, Set<string>>;

type AllowlistArrays = Record<Locale, string[]>;
const EMPTY_ARRAYS: AllowlistArrays = { en: [], ar: [], ja: [] };

// INNER (cached). MUST return JSON-serializable data: unstable_cache serializes
// its result, so returning a Set comes back as {} at runtime (".has is not a
// function" — this exact bug broke the first build). Return plain arrays here;
// getIndexAllowlist() below rebuilds the Sets from them. Service-role read so it
// works regardless of RLS. Returns empty arrays on ANY error → fail-open.
const getIndexAllowlistArrays = unstable_cache(
  async (): Promise<AllowlistArrays> => {
    const out: AllowlistArrays = { en: [], ar: [], ja: [] };
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) return EMPTY_ARRAYS;
      const admin = createClient(url, serviceKey);
      let from = 0;
      const page = 1000;
      for (;;) {
        const { data, error } = await admin
          .from('seo_index_allowlist')
          .select('locale, slug')
          .eq('active', true)
          // stable order is REQUIRED for range() pagination (else pages skip/dupe).
          .order('slug', { ascending: true })
          .range(from, from + page - 1);
        if (error || !data) {
          // Partial read = treat as failure → fail-open, not a half-built list
          // that would wrongly deindex the missing pages.
          if (from === 0) return EMPTY_ARRAYS;
          break;
        }
        for (const r of data as { locale: string; slug: string }[]) {
          const s = r.slug?.toLowerCase();
          if (s && (r.locale === 'en' || r.locale === 'ar' || r.locale === 'ja')) {
            out[r.locale].push(s);
          }
        }
        if (data.length < page) break;
        from += page;
      }
    } catch {
      return EMPTY_ARRAYS;
    }
    return out;
  },
  ['seo-index-allowlist-v1'],
  { revalidate: 3600, tags: ['seo-allowlist'] },
);

// PUBLIC: rebuild Sets from the cached arrays on each call (cheap: ~3×1K).
export async function getIndexAllowlist(): Promise<Allowlist> {
  const a = await getIndexAllowlistArrays();
  return { en: new Set(a.en), ar: new Set(a.ar), ja: new Set(a.ja) };
}

// True if this (locale, slug) may be indexed per the allowlist. FAIL-OPEN: an
// empty set for the locale means "allowlist unavailable/not built" → do not
// restrict (index as before). Callers still AND this with their own gates
// (e.g. ar/ja noun+BYG), so an empty set never over-indexes untranslated pages.
export function isAllowlisted(allow: Allowlist, locale: Locale, slug: string): boolean {
  const set = allow[locale];
  if (!set || set.size === 0) return true; // fail-open
  return set.has(slug.toLowerCase());
}
