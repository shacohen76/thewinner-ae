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
// amz_seo_index_manager_v1.py (in AMZ_AFF) — the site only READS it, so
// growing the allowlist weekly needs NO code deploy.
//
// SIGNAL (how the set is chosen, for reference): affiliate CLICKOUTS per market
// (click_log = money) COMBINED with Google performance (GSC), per-market
// guaranteed. ar/ja are restricted to quality-pass pages (noun + BYG). Each
// locale is INDEPENDENT: /ja/best/x can index on the JA list even when the EN
// /best/x is deindexed, and vice-versa.
//
// FAIL-OPEN (critical): if the table can't be read and there is no previous good
// copy, this returns EMPTY sets and callers MUST treat "empty set" as "do not
// restrict" (index as before). Never let a transient read failure deindex the site.
//
// ── 2026-09-29 REWRITE (root cause of the "pages rebuild hourly" + DB-IO waste) ──
// The v1 reader was wrapped in Next's unstable_cache({ revalidate: 3600 }). Two
// Next.js 14.2 behaviours (node_modules/next/dist/server/web/spec-extension/
// unstable-cache.js) made that harmful on Vercel:
//   1. LIFETIME OVERRIDE (L72-81): an unstable_cache with a SHORTER revalidate than
//      the page lowers the WHOLE PAGE's ISR lifetime to it. The /best page is 7 days
//      (604800, PR #94 2026-09-22) but calls this in generateMetadata → every en/ar/ja
//      /best page silently had a 1-HOUR lifetime (verified: page header
//      `s-maxage=3600`; live en/ar pages STALE after 1h while /pt — which skips this
//      call — stays HIT at 4h). Since 2026-09-10 (PR #92) → hourly rebuilds, ISR
//      writes (Vercel bill) + Supabase IO far above what the 7-day fix intended.
//   2. BYPASS ON VERCEL BUILDS (L98): builds that Vercel runs as ISR regeneration
//      carry the `x-prerender-revalidate` header (isOnDemandRevalidate) → unstable_cache
//      is skipped → the full list (4 × 1000-row requests) was re-downloaded ~2× per
//      build: ~2,400–3,350 full downloads/hour, ~40% of all Supabase requests
//      (edge_logs 2026-09-29). Locally (`next start`, no header) it cached fine —
//      which is why it was never noticed.
// NEW DESIGN (no unstable_cache → cannot touch the page lifetime):
//   • In-process memo per server instance (same pattern as lib/tracking.ts pool cfg).
//   • Each build does ONE tiny "version" read (row count + max(updated_at)); the full
//     list is re-read only when the version changed, or the memo is > 1h old (safety
//     net), or there is no memo. Concurrent calls share one in-flight read; calls within
//     VERSION_DEDUPE_MS reuse the last check (generateMetadata runs ~2× per build).
//   • Reads use Next's ORIGINAL (un-patched) fetch → always live, never stored in
//     Next's data cache, never alters the page's static/ISR status.
//   • Correctness fixes: (a) a mid-pagination error now fails the WHOLE read (v1
//     returned a PARTIAL list → wrongly noindexed the missing pages, contrary to its
//     own comment); (b) pagination orders by the PRIMARY KEY (slug, locale) — v1 ordered
//     by slug only, which is not unique (same slug in en/ar/ja) → rows could be
//     skipped/duplicated at page boundaries.
//   • Freshness: an allowlist edit is seen by the next page build (version check), so
//     the SEO tool's add/weekly → revalidate flow indexes pages immediately.
//     DB trigger `seo_index_allowlist_touch` bumps updated_at on every UPDATE (so even a
//     manual SQL edit changes the version).
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Locale = 'en' | 'ar' | 'ja';
export type Allowlist = Record<Locale, Set<string>>;

type AllowlistArrays = Record<Locale, string[]>;
const EMPTY_ARRAYS: AllowlistArrays = { en: [], ar: [], ja: [] };

const PAGE_SIZE = 1000;                    // PostgREST max rows per request
const VERSION_DEDUPE_MS = 2_000;           // reuse a version check made this recently
const MEMO_MAX_AGE_MS = 60 * 60 * 1000;    // safety net: full re-read at least hourly per instance

interface Memo { version: string; data: AllowlistArrays; loadedAt: number }
let memo: Memo | null = null;
let lastVersionCheckAt = 0;
let inflight: Promise<AllowlistArrays> | null = null;

// Next.js patches global fetch (data cache + ISR lifetime bookkeeping). Use the ORIGINAL
// fetch it keeps (`_nextOriginalFetch`, patch-fetch.js) so these reads are always live
// and invisible to Next's caching. Fallback = global fetch (older/newer Next without it).
function liveFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const f = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
  return (f._nextOriginalFetch ?? f)(input, init);
}

let dbClient: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (dbClient) return dbClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  dbClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: liveFetch },
  });
  return dbClient;
}

// ONE tiny request: total row count + newest updated_at. Any insert/update/deactivate
// changes it (rows are never hard-deleted by the tool; a delete still changes the count).
async function readVersion(client: SupabaseClient): Promise<string | null> {
  try {
    const { data, count, error } = await client
      .from('seo_index_allowlist')
      .select('updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) return null;
    return `${count ?? 0}|${(data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? ''}`;
  } catch {
    return null;
  }
}

// Full list, all-or-nothing: ANY page error → null (never a partial list).
async function readAll(client: SupabaseClient): Promise<AllowlistArrays | null> {
  const out: AllowlistArrays = { en: [], ar: [], ja: [] };
  try {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from('seo_index_allowlist')
        .select('locale, slug')
        .eq('active', true)
        // Order by the PRIMARY KEY (slug, locale) → a total, stable order for range().
        .order('slug', { ascending: true })
        .order('locale', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) return null;
      for (const r of data as { locale: string; slug: string }[]) {
        const s = r.slug?.toLowerCase();
        if (s && (r.locale === 'en' || r.locale === 'ar' || r.locale === 'ja')) {
          out[r.locale].push(s);
        }
      }
      if (data.length < PAGE_SIZE) break;
    }
    return out;
  } catch {
    return null;
  }
}

async function refresh(): Promise<AllowlistArrays> {
  const client = db();
  if (!client) return memo?.data ?? EMPTY_ARRAYS;          // no env → last good copy, else fail-open
  const version = await readVersion(client);
  const now = Date.now();
  if (memo && version !== null && version === memo.version && now - memo.loadedAt < MEMO_MAX_AGE_MS) {
    lastVersionCheckAt = now;
    return memo.data;                                         // unchanged → reuse (1 tiny request)
  }
  const data = await readAll(client);
  if (!data) return memo?.data ?? EMPTY_ARRAYS;             // read failed → last good copy, else fail-open
  if (version !== null) {                                    // only memoize a versioned, complete read
    memo = { version, data, loadedAt: Date.now() };
    lastVersionCheckAt = Date.now();
  }
  return data;
}

async function getIndexAllowlistArrays(): Promise<AllowlistArrays> {
  if (memo && Date.now() - lastVersionCheckAt < VERSION_DEDUPE_MS) return memo.data;
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

// PUBLIC: Sets rebuilt per call from the memoized arrays (cheap: ~3×1K strings).
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
