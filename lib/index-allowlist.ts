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

const EMPTY: Allowlist = { en: new Set(), ar: new Set(), ja: new Set() };

// Uses the service-role key (present in the build/runtime env) so it reads the
// table regardless of RLS. Returns EMPTY on ANY error → fail-open (see header).
export const getIndexAllowlist = unstable_cache(
  async (): Promise<Allowlist> => {
    const out: Allowlist = { en: new Set(), ar: new Set(), ja: new Set() };
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) return EMPTY;
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
          // Partial read = treat as failure → fail-open with EMPTY, not a
          // half-built set that would wrongly deindex the missing pages.
          if (from === 0) return EMPTY;
          break;
        }
        for (const r of data as { locale: string; slug: string }[]) {
          const s = r.slug?.toLowerCase();
          if (s && (r.locale === 'en' || r.locale === 'ar' || r.locale === 'ja')) {
            out[r.locale].add(s);
          }
        }
        if (data.length < page) break;
        from += page;
      }
    } catch {
      return EMPTY;
    }
    return out;
  },
  ['seo-index-allowlist-v1'],
  { revalidate: 3600, tags: ['seo-allowlist'] },
);

// True if this (locale, slug) may be indexed per the allowlist. FAIL-OPEN: an
// empty set for the locale means "allowlist unavailable/not built" → do not
// restrict (index as before). Callers still AND this with their own gates
// (e.g. ar/ja noun+BYG), so an empty set never over-indexes untranslated pages.
export function isAllowlisted(allow: Allowlist, locale: Locale, slug: string): boolean {
  const set = allow[locale];
  if (!set || set.size === 0) return true; // fail-open
  return set.has(slug.toLowerCase());
}
