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
//
// ── 2026-11-11 (LOCALE SITE 1 · PR B, roadmap LOCALES_ROADMAP_v1_0 change C) ──
// The gate now covers the single-language locales too: pt · es · pl · fr · it · de · sv · nl.
// Before this, pt and es indexed EVERY complete page (no allowlist) — with ~47K pages per
// locale coming, that is the Aug-21 index-bloat pattern. Two modes when a locale's set is EMPTY:
//   • OPEN_IF_EMPTY (en · ar · ja · pt · es) — "not seeded" → do not restrict (as before). pt/es
//     are live and indexing today, so a deploy that lands before their seed rows can never
//     deindex them. Once a locale has ≥1 row it is gated like en/ar/ja (keep-best, grow weekly).
//   • CLOSED_IF_EMPTY (pl · fr · it · de · sv · nl) — none of them indexes today. After a GOOD
//     read, an empty set means "nothing approved yet" → noindex. This is what stops a new
//     locale's complete pages from all indexing at once.
// FAIL-OPEN is unchanged and applies to EVERY locale: a read error / missing env with no
// previous good copy (`readOk: false`) → do not restrict. Never deindex on a DB blip.
// Callers still AND this with their own complete-gate (noun + BYG + products).
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Locale = 'en' | 'ar' | 'ja' | 'pt' | 'es' | 'pl' | 'fr' | 'it' | 'de' | 'sv' | 'nl';
export const ALLOWLIST_LOCALES: readonly Locale[] = ['en', 'ar', 'ja', 'pt', 'es', 'pl', 'fr', 'it', 'de', 'sv', 'nl'];
/** Locales whose EMPTY set (after a good read) means "nothing approved → noindex". */
// owner 11-12 decision A: every complete page indexes in every locale → no locale is closed-if-empty (was pl fr it de sv nl).
const CLOSED_IF_EMPTY: ReadonlySet<string> = new Set<string>([]);
/** readOk = the sets come from a complete, successful read (now or the last good copy).
 *  false → the allowlist is unavailable and every caller fails open. */
export type Allowlist = Record<Locale, Set<string>> & { readOk: boolean };

type AllowlistArrays = Record<Locale, string[]>;
const emptyArrays = (): AllowlistArrays =>
  Object.fromEntries(ALLOWLIST_LOCALES.map((l) => [l, [] as string[]])) as unknown as AllowlistArrays;
const EMPTY_ARRAYS: AllowlistArrays = emptyArrays();

export function isAllowlistLocale(locale: string): locale is Locale {
  return (ALLOWLIST_LOCALES as readonly string[]).includes(locale);
}

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
  const out: AllowlistArrays = emptyArrays();
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
        if (s && isAllowlistLocale(r.locale)) {
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

// PUBLIC: Sets rebuilt per call from the memoized arrays (cheap: a few K strings).
// readOk: the arrays are a complete good read (a memo is only ever stored from one); the
// EMPTY_ARRAYS fallback (read failed / no env, no previous good copy) is the only not-ok case.
export async function getIndexAllowlist(): Promise<Allowlist> {
  const a = await getIndexAllowlistArrays();
  const sets = Object.fromEntries(ALLOWLIST_LOCALES.map((l) => [l, new Set(a[l])])) as Record<Locale, Set<string>>;
  return { ...sets, readOk: a !== EMPTY_ARRAYS };
}

// The set that restricts this locale, or null = "do not restrict".
//   • read failed (readOk false)              → null (FAIL-OPEN, every locale)
//   • set has rows                            → that set
//   • empty + OPEN_IF_EMPTY (en ar ja pt es)  → null (not seeded → as before)
//   • empty + CLOSED_IF_EMPTY (none since owner 11-12 decision A) → the empty set (noindex)
export function allowlistRestriction(allow: Allowlist, locale: Locale): Set<string> | null {
  const set = allow[locale];
  if (!allow.readOk) return null;
  if (set && set.size > 0) return set;
  return CLOSED_IF_EMPTY.has(locale) ? (set ?? new Set<string>()) : null;
}

// True if this (locale, slug) may be indexed per the allowlist (see allowlistRestriction).
// Callers still AND this with their own gates (noun + BYG + products), so "not restricted"
// never over-indexes untranslated pages.
export function isAllowlisted(allow: Allowlist, locale: Locale, slug: string): boolean {
  const set = allowlistRestriction(allow, locale);
  return set === null || set.has(slug.toLowerCase());
}
