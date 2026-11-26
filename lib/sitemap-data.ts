// ============================================
// Sitemap data + XML builders (shared by the index + chunk route handlers)
// ============================================
// 2026-08-25 (rerank-11 SEO): the flat app/sitemap.ts hit ~48.9K URLs (Google's 50k/file
// cap). We split via explicit route handlers instead of Next's generateSitemaps() because
// generateSitemaps did NOT serve a working /sitemap.xml index in this Next 14.2 + next-intl
// setup (the bare index 404'd; children only at /sitemap.xml/<id>). Route handlers render
// identical XML in dev and prod, so /sitemap.xml (index) + /sitemap/<id>.xml (chunks) are
// predictable and verifiable. Middleware excludes the `sitemap` prefix so next-intl never
// rewrites these. Structure:
//   /sitemap.xml            -> <sitemapindex> listing the chunks below
//   /sitemap/structural.xml -> static + category + localized (ar/ja) + blog
//   /sitemap/best-<i>.xml   -> English /best keyword pages, CHUNK_SIZE each
// ============================================

import { getAllKeywords, getTranslatedSlugs, getTranslatedByGEntries, getMarketplaceSlugs, getEnglishByGSlugs, getSlugCreatedAt, MAIN_CATEGORIES, SUBCATEGORY_NAMES, type EnBygEntry } from '@/lib/supabase';
import { getIndexAllowlist, allowlistRestriction, isAllowlistLocale, getIndexModeFor } from '@/lib/index-allowlist';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';
import { BR_PT_ENABLED, BF_TWINS_ENABLED } from '@/lib/feature-flags';
import { EU_NATIVE_CODES } from '@/lib/native-locales';
import { BF_SUFFIX, bfTwinBaseSlug, bfTwinsNoindex } from '@/lib/bf-twin';
import BF_SITEMAP_SLUGS from '@/lib/bf-sitemap-slugs.json';

export const CHUNK_SIZE = 20000; // English /best URLs per chunk — well under the 50k cap

export interface SitemapEntry {
  url: string;
  changefreq: string;
  priority: number;
  // ISO 8601 last-modified = the page's creation date (keywords.created_at). OPTIONAL:
  // omitted for code-defined pages (home/category/blog) and for any slug whose date we
  // can't read. We never stamp "now" — see getSlugCreatedAt + the 2026-11-10 fix.
  lastmod?: string;
}

// Number of English /best chunks (>=1). Errors default to 1 so the index still renders.
export async function bestChunkCount(): Promise<number> {
  try {
    const keywords = await getAllKeywords();
    return Math.max(1, Math.ceil(keywords.length / CHUNK_SIZE));
  } catch (error) {
    console.error('sitemap bestChunkCount failed, defaulting to 1:', error);
    return 1;
  }
}

// All chunk ids in order. 2026-09-10 (keep-best-~1K): the index now lists three
// clean per-locale "indexable" sitemaps (allowlisted pages only) + structural.
// The old best-<i> chunks (the ~48.9K English keyword dump) are gone — that
// index bloat is exactly what triggered the Aug-21 sitewide demotion. Grow the
// allowlist (seo_index_allowlist) to re-expand; no code change needed.
export async function chunkIds(): Promise<string[]> {
  // 2026-09-27 (BR 1): + 'indexable-pt' when the /pt locale is enabled.
  // 2026-11-08 (EU NATIVE 1): + 'indexable-<code>' per enabled EU native locale (none by default).
  // 2026-11-11 (BF 1, owner): + 'black-friday' while the BF twins are on and not yet switched to noindex.
  // 2026-11-26 (all-indexable): a locale in index_mode='all_complete' is split into 20K chunks
  // ('indexable-en-0', …) — one file would exceed Google's 50K cap at ~46–62K URLs. 'allowlist' mode
  // keeps the single 'indexable-<loc>' file. The [id] route resolves both forms.
  const localeIds: string[] = [];
  for (const loc of ['en', 'ar', 'ja'] as const) {
    if ((await getIndexModeFor(loc)) === 'all_complete') {
      const n = await indexableChunkCount(loc);
      for (let i = 0; i < n; i++) localeIds.push(`indexable-${loc}-${i}`);
    } else {
      localeIds.push(`indexable-${loc}`);
    }
  }
  return ['structural', ...localeIds, ...(BR_PT_ENABLED ? ['indexable-pt'] : []),
    ...EU_NATIVE_CODES.map((c) => `indexable-${c}`), ...(bfSitemapLive() ? ['black-friday'] : [])];
}

// All-indexable (2026-11-26): the COMPLETE slug set for a locale when index_mode='all_complete',
// sorted by slug so the index chunk COUNT and the chunk-route SLICES agree across separate requests
// (same stable-order rule as getAllKeywords). en → BYG keywords (page re-checks >=1 AE product);
// ar/ja → noun+BYG translations (getTranslatedSlugs already filters BYG; the /ja page re-checks >=1
// JP catalog product). Candidate lists only — the page's robots gate makes the final index decision.
// 2026-11-26 (timeout fix): the EN set is read ONCE per request and memoised (EN_BYG_TTL), shared by
// the index chunk count AND every chunk slice, so a build/render does a single cheap keyset read
// (id, slug, created_at) instead of one ~125 MB getEnglishByGSlugs call per caller. The entries carry
// created_at, so EN chunks need no getSlugCreatedAt pass. Sorted by slug so the chunk COUNT and the
// chunk SLICES agree across separate requests.
// Read ONCE per request per locale and memoised (BYG_TTL), shared by the index chunk count AND every
// chunk slice: en via getEnglishByGSlugs, every other locale via getTranslatedByGEntries — each a
// single one-shot RPC (keyset fallback) that carries created_at, so chunks need no getSlugCreatedAt.
const bygMemo = new Map<string, { v: EnBygEntry[]; at: number }>();
const BYG_TTL_MS = 10 * 60 * 1000;
async function localeCompleteEntries(locale: string): Promise<EnBygEntry[]> {
  const now = Date.now();
  const m = bygMemo.get(locale);
  if (m && now - m.at < BYG_TTL_MS) return m.v;
  const rows = locale === 'en' ? await getEnglishByGSlugs() : await getTranslatedByGEntries(locale);
  const v = rows.slice().sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  bygMemo.set(locale, { v, at: now });
  return v;
}

// 2026-11-26: pt + EU sitemaps keep the allowlist filter, applied to the memoised entry set (the SAME
// rule as the page robots gate: not seeded pt/es → no restriction; EU with no rows → none; read error
// → no restriction).
async function allowlistedEntries(locale: string, entries: EnBygEntry[]): Promise<EnBygEntry[]> {
  if (!isAllowlistLocale(locale)) return entries;
  const only = allowlistRestriction(await getIndexAllowlist(), locale);
  return only === null ? entries : entries.filter((e) => only.has(e.slug));
}

async function completeSlugsFor(locale: 'en' | 'ar' | 'ja'): Promise<string[]> {
  return (await localeCompleteEntries(locale)).map((e) => e.slug);
}

// Number of 20K chunks for a locale's complete set (>=1 so the index always lists at least one file).
export async function indexableChunkCount(locale: 'en' | 'ar' | 'ja'): Promise<number> {
  return Math.max(1, Math.ceil((await completeSlugsFor(locale)).length / CHUNK_SIZE));
}

// One 20K chunk of a locale's complete set (index_mode='all_complete'). en → /best/<slug>;
// ar/ja → /<locale>/best/<slug>, self-canonical. created_at is carried from the memoised set, so no
// getSlugCreatedAt pass (what made the ja/ar chunk renders slow).
export async function indexableChunkEntries(locale: 'en' | 'ar' | 'ja', chunk: number): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const all = await localeCompleteEntries(locale);
  const slice = all.slice(chunk * CHUNK_SIZE, (chunk + 1) * CHUNK_SIZE);
  return slice.map((e) => ({
    url: `${base}${prefix}/best/${encodeURIComponent(e.slug)}`, changefreq: 'weekly', priority: 0.9,
    lastmod: e.createdAt ?? undefined,
  }));
}

// 2026-11-11 (BF 1, owner "lets sitemap separately"): the Black Friday twins get their OWN sitemap,
// separate from the allowlisted ones. The list is FIXED (lib/bf-sitemap-slugs.json = the Tier 1
// base slugs whose base page passed a production Googlebot check, 2026-11-11) — never the full
// keyword set (Aug-21 index-bloat lesson). Empty when the flag is off or BF_TWINS_NOINDEX_AFTER
// is reached, so the sitemap stops listing twins the moment they turn noindex.
// 2026-11-11 (6.8): listed ONLY on the canonical host (thewinner.ae), with absolute canonical URLs —
// on the other host (thewinners.ae, whose pages canonicalize to thewinner.ae) the chunk is omitted.
export function bfSitemapLive(): boolean {
  const onCanonicalHost = new URL(CONFIG.siteUrl).host === new URL(CONFIG.canonicalUrl).host;
  return BF_TWINS_ENABLED && !bfTwinsNoindex() && onCanonicalHost;
}

export function bfTwinEntries(): SitemapEntry[] {
  if (!bfSitemapLive()) return [];
  const base = CONFIG.canonicalUrl;
  return (BF_SITEMAP_SLUGS as string[])
    .filter((slug) => bfTwinBaseSlug(slug + BF_SUFFIX, 'en') === slug)   // same guard as the route (no -spc)
    .map((slug) => ({ url: `${base}/best/${encodeURIComponent(slug)}${BF_SUFFIX}`, changefreq: 'daily', priority: 0.8 }));
}

// 2026-11-11 (LOCALE SITE 1 · PR B): pt + EU sitemaps list only slugs their locale's index
// allowlist lets index — the SAME rule as the page's robots gate (lib/index-allowlist.ts
// allowlistRestriction: not seeded pt/es → no restriction; pl/fr/it/de/sv/nl with no rows → none;
// read error → no restriction).
// (allowlisted(slugs[]) was replaced 2026-11-26 by allowlistedEntries(entries) above — same rule.)

// 2026-11-08 (EU NATIVE 1, owner D-3 "copy PT"): every page with a native noun in an enabled EU
// locale. Same shape as ptIndexableEntries; the page itself re-checks BYG + ≥1 product before it
// emits index (a listed page that is not complete yet stays noindex until its text lands).
export async function euNativeIndexableEntries(locale: string): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  try {
    const entries = await allowlistedEntries(locale, await localeCompleteEntries(locale));
    return entries.map((e) => ({
      url: `${base}/${locale}/best/${encodeURIComponent(e.slug)}`, changefreq: 'weekly', priority: 0.9,
      lastmod: e.createdAt ?? undefined,
    }));
  } catch (error) {
    // 2026-11-14: rethrow (was `return []`). The route then fails this render, so ISR keeps the
    // last good copy instead of caching an empty 200; with no good copy yet it answers 5xx.
    console.error(`sitemap euNativeIndexableEntries(${locale}) failed:`, error);
    throw error;
  }
}

// 2026-09-27 (BR 1, owner): ALL complete /pt pages were indexed (2026-11-11: now ANDed with the pt allowlist, see allowlisted() above; was: no allowlist — intentional
// exception, see the /best page). Listed = keywords with a pt noun + pt BYG. The BR text
// publisher (br_publish_pt_text_v1.py) only writes pt text for keywords it also published
// BR products for, so this set == complete pages; the page itself re-checks ≥1 BR product
// before emitting index. One paginated read of keyword_translations(pt) — cheap.
export async function ptIndexableEntries(): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  try {
    const entries = await allowlistedEntries('pt', await localeCompleteEntries('pt'));
    return entries.map((e) => ({
      url: `${base}/pt/best/${encodeURIComponent(e.slug)}`, changefreq: 'weekly', priority: 0.9,
      lastmod: e.createdAt ?? undefined,
    }));
  } catch (error) {
    console.error('sitemap ptIndexableEntries failed:', error);
    throw error;   // 2026-11-14: same as euNativeIndexableEntries — never cache an empty 200
  }
}

export async function structuralEntries(): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  const out: SitemapEntry[] = [
    { url: base, changefreq: 'daily', priority: 1 },
    { url: `${base}/about`, changefreq: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, changefreq: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, changefreq: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changefreq: 'yearly', priority: 0.3 },
    { url: `${base}/blog`, changefreq: 'weekly', priority: 0.8 },
  ];
  for (const slug of Object.keys(MAIN_CATEGORIES)) out.push({ url: `${base}/category/${slug}`, changefreq: 'weekly', priority: 0.8 });
  for (const slug of Object.keys(SUBCATEGORY_NAMES)) out.push({ url: `${base}/category/${slug}`, changefreq: 'weekly', priority: 0.7 });

  // localized /best (ar/ja) now live in their own indexable-ar / indexable-ja
  // sitemaps (allowlisted pages only) — no longer dumped here. 2026-09-10.

  // Blog slugs (file + DB merged). 2026-11-14: getAllSlugs is now async (hybrid blog) and
  // wrapped so a blog/DB failure can NEVER drop the structural pages above (home, categories)
  // or fail the build — it just yields zero blog URLs for this render.
  try {
    for (const slug of await getAllSlugs()) out.push({ url: `${base}/blog/${slug}`, changefreq: 'monthly', priority: 0.7 });
  } catch (error) {
    console.error('sitemap structuralEntries blog slugs failed, skipping blog URLs:', error);
  }
  return out;
}

// Single-locale localized /best entries — used by /sitemap/<locale>.xml so JP (and next AR)
// can be submitted to GSC as a standalone sitemap while the big index is removed there.
// Lists a page ONLY when it renders index:true, matching
// app/[locale]/best/[market]/[slug]/page.tsx exactly:
//   • ar → noun + BYG                         (arIndexed)
//   • ja → noun + BYG + >=1 'jp' catalog       (jaIndexed) — the extra catalog gate is why
//     we intersect getMarketplaceSlugs('jp'); getTranslatedSlugs alone lists ~7 noun+BYG JP
//     pages that are actually noindex (no JP catalog), which would show as "noindex" in GSC.
// DB-driven: a NEW localized page enters automatically the moment it meets the gate — no
// redeploy needed. 2026-08-30 (JP-only GSC sitemap test; AR mirrors it for the next step).
export async function localizedBestEntries(locale: string): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  const out: SitemapEntry[] = [];
  try {
    const [keywords, translated, jaCatalog] = await Promise.all([
      getAllKeywords(),
      getTranslatedSlugs(locale),
      locale === 'ja' ? getMarketplaceSlugs('jp') : Promise.resolve(null as Set<string> | null),
    ]);
    const seen = new Set<string>();
    for (const k of keywords) {
      const s = k.slug.toLowerCase();
      if (!translated.has(s) || seen.has(s)) continue;
      if (jaCatalog && !jaCatalog.has(s)) continue; // ja only: require >=1 'jp' catalog product
      seen.add(s);
      out.push({ url: `${base}/${locale}/best/${encodeURIComponent(k.slug)}`, changefreq: 'weekly', priority: 0.9 });
    }
  } catch (error) {
    console.error(`sitemap localizedBestEntries(${locale}) failed:`, error);
  }
  return out;
}

// keep-best-~1K (2026-09-10): a per-locale "indexable" sitemap = ONLY the pages
// on that locale's allowlist (seo_index_allowlist), read through the SAME cached
// getIndexAllowlist the page's robots gate uses — so sitemap and robots always
// agree. English → /best/<slug>; ar/ja → /<locale>/best/<slug> (self-canonical).
// An empty/unavailable allowlist yields an empty file (safe: an empty sitemap
// never deindexes; Google keeps known URLs, and the page gate fails open).
export async function allowlistEntries(locale: 'en' | 'ar' | 'ja'): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const out: SitemapEntry[] = [];
  try {
    const allow = await getIndexAllowlist();
    const slugs = Array.from(allow[locale]);
    const dates = await getSlugCreatedAt(slugs);
    for (const slug of slugs) {
      out.push({ url: `${base}${prefix}/best/${encodeURIComponent(slug)}`, changefreq: 'weekly', priority: 0.9,
        lastmod: dates.get(slug.toLowerCase()) });
    }
  } catch (error) {
    console.error(`sitemap allowlistEntries(${locale}) failed:`, error);
  }
  return out;
}

// @deprecated 2026-09-10 (keep-best-~1K): NOT wired into the sitemap index or the
// [id] route any more — it emitted the full ~48.9K English keyword dump (the index
// bloat that tanked organic on Aug-21). Kept only for reference/rollback; use
// allowlistEntries('en') instead. bestChunkCount/localizedBestEntries likewise retired.
export async function bestChunkEntries(index: number): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  try {
    const keywords = await getAllKeywords();
    const start = index * CHUNK_SIZE;
    return keywords.slice(start, start + CHUNK_SIZE).map((k) => ({
      url: `${base}/best/${encodeURIComponent(k.slug)}`,
      changefreq: 'weekly',
      priority: 0.9,
    }));
  } catch (error) {
    console.error(`sitemap bestChunkEntries(${index}) failed:`, error);
    return [];
  }
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// 2026-11-10 (sitemap-lastmod fix): <lastmod> is now PER-ENTRY (the page's creation date)
// and OMITTED when absent. We no longer pass a single regen timestamp applied to every url
// (that falsely told crawlers all ~11K pages changed on every hourly regen/deploy).
export function urlsetXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const lm = e.lastmod ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '';
      return `  <url><loc>${xmlEscape(e.url)}</loc>${lm}<changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

// No <lastmod> on the index entries: a child sitemap's "changed" time is not a real signal
// here (the set changes only when the allowlist does), and stamping it "now" was the churn.
export function sitemapIndexXml(locs: string[]): string {
  const body = locs.map((l) => `  <sitemap><loc>${xmlEscape(l)}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}
