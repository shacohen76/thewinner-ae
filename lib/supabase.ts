import { createClient } from '@supabase/supabase-js';
import { sanitizeProductTitle } from './utils';

// ============================================
// SUPABASE CLIENT — thewinner.ae Database Queries
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-03-19
// AMZ project: acreztrqmszpdenpsbwx (Mumbai)
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ML 3 (2026-07-17): during `next build` (static prerender) we must NEVER throw on
// a read failure — a transient statement-timeout under build-time DB concurrency
// would fail the ENTIRE deploy (this is exactly what broke PR #46's builds). At
// build we degrade gracefully instead (return null → caller renders empty/404,
// which ISR self-heals at runtime). At RUNTIME we still throw so a failed render
// is not cached empty for 7 days.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

// Run a Supabase read with retries. On persistent failure: THROW at runtime (keeps
// the failed render out of the ISR cache — Next serves the last good copy / retries
// next request), DEGRADE to null at build (never fail the deploy). The happy path is
// unchanged (returns on attempt 1). This reacts only to actual DB ERRORS — a
// legitimate empty result is returned as-is, so genuinely-empty pages render
// normally. The /api/catalog route also catches the runtime throw → uncached empty.
async function readWithRetry<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
  attempts = 3,
): Promise<T | null> {
  let lastError: { message?: string } | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await run();
    if (!error) return data;
    lastError = error;
    console.error(`${label} failed (attempt ${attempt}/${attempts}):`, error);
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 150 * attempt));
  }
  if (IS_BUILD_PHASE) {
    console.error(`${label} failed after ${attempts} attempts (build phase — degrading, not failing build):`, lastError?.message);
    return null;
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError?.message ?? 'unknown error'}`);
}

// ============================================
// DATABASE TYPES
// ============================================

export interface Product {
  asin: string;
  title: string;
  brand: string | null;
  image_url: string | null;
  // product_url dropped 2026-08-27 — never read (links built from /dp/{asin} + tag); column removed from Supabase
  description: string | null;
  bullet_points: string[] | null;
  wwl_points: string[] | null;
  amazon_category: string | null;
  is_on_discount: boolean;
  original_price: number | null;
  discount_percentage: number | null;
  is_out_of_stock: boolean;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: number;
  keyword_text: string;
  slug: string;
  category_id: number | null;
  qa_guide: { q: string; a: string }[] | null;
  validation_status: string;
  scraped_at: string;
}

export interface KeywordProduct {
  keyword_id: number;
  asin: string;
  rank: number;
  price_at_scrape: string | null;
  scraped_at: string;
  validated_at: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

// ============================================
// MAIN CATEGORIES CONFIG (frontend grouping)
// Maps AMZ 37 categories into 8 main groups
// Same pattern as KSP
// ============================================

export const MAIN_CATEGORIES: Record<string, { label: string; icon: string; color: string; gradient: string; description: string; subcategories: string[] }> = {
  'appliances-main': {
    label: 'Home Appliances', icon: '🏠', color: 'green',
    gradient: 'from-green-600 via-green-700 to-teal-800',
    description: 'Home appliances — refrigerators, washing machines, vacuum cleaners, air conditioners and more.',
    subcategories: ['large-appliances', 'vacuum-cleaners', 'laundry', 'climate-control'],
  },
  'kitchen-main': {
    label: 'Kitchen & Coffee', icon: '☕', color: 'amber',
    gradient: 'from-amber-700 via-amber-800 to-yellow-900',
    description: 'Everything for the kitchen — cooking appliances, coffee machines, kettles and more.',
    subcategories: ['kitchen-appliances', 'coffee-tea'],
  },
  'computers-main': {
    label: 'Computers & Phones', icon: '💻', color: 'blue',
    gradient: 'from-blue-600 via-blue-700 to-indigo-800',
    description: 'Laptops, phones, tablets, monitors, printers and accessories.',
    subcategories: ['laptops', 'desktops', 'phones-accessories', 'tablets', 'monitors', 'printers', 'computer-accessories', 'watches-wearables'],
  },
  'entertainment-main': {
    label: 'TV & Audio', icon: '📺', color: 'purple',
    gradient: 'from-purple-600 via-purple-700 to-indigo-800',
    description: 'Televisions, speakers, headphones and audio equipment.',
    subcategories: ['tv-projectors', 'speakers-audio', 'headphones-earbuds'],
  },
  'care-main': {
    label: 'Beauty, Care & Family', icon: '✨', color: 'pink',
    gradient: 'from-pink-500 via-pink-600 to-rose-700',
    description: 'Perfumes, makeup, hair care, skincare, and baby products.',
    subcategories: ['perfumes-fragrances', 'makeup', 'hair-care-styling', 'skincare', 'personal-care', 'baby-kids'],
  },
  'hobbies-main': {
    label: 'Hobbies & Leisure', icon: '🎮', color: 'red',
    gradient: 'from-red-600 via-red-700 to-orange-800',
    description: 'Gaming, toys, sports, cameras and musical instruments.',
    subcategories: ['gaming', 'toys', 'fitness-sports', 'cameras-photography', 'musical-instruments'],
  },
  'home-main': {
    label: 'Home & Garden', icon: '🏡', color: 'teal',
    gradient: 'from-teal-600 via-teal-700 to-emerald-800',
    description: 'Furniture, bathroom, lighting, smart home, garden and power tools.',
    subcategories: ['furniture', 'bathroom', 'lighting', 'smart-home', 'garden-outdoor', 'power-tools'],
  },
  'other-main': {
    label: 'More', icon: '📦', color: 'gray',
    gradient: 'from-gray-600 via-gray-700 to-slate-800',
    description: 'Automotive, bags and more.',
    subcategories: ['automotive', 'bags-backpacks', 'other'],
  },
};

// Subcategory display names (maps to categories.slug in DB)
export const SUBCATEGORY_NAMES: Record<string, { name: string; icon: string }> = {
  'large-appliances': { name: 'Large Appliances', icon: '🔌' },
  'vacuum-cleaners': { name: 'Vacuum Cleaners', icon: '🧹' },
  'laundry': { name: 'Laundry', icon: '🧺' },
  'climate-control': { name: 'Climate Control', icon: '❄️' },
  'kitchen-appliances': { name: 'Kitchen Appliances', icon: '🍳' },
  'coffee-tea': { name: 'Coffee & Tea', icon: '☕' },
  'laptops': { name: 'Laptops', icon: '💻' },
  'desktops': { name: 'Desktops', icon: '🖥️' },
  'phones-accessories': { name: 'Phones & Accessories', icon: '📱' },
  'tablets': { name: 'Tablets', icon: '📱' },
  'monitors': { name: 'Monitors', icon: '🖥️' },
  'printers': { name: 'Printers', icon: '🖨️' },
  'computer-accessories': { name: 'Computer Accessories', icon: '🔧' },
  'watches-wearables': { name: 'Watches & Wearables', icon: '⌚' },
  'tv-projectors': { name: 'TV & Projectors', icon: '📺' },
  'speakers-audio': { name: 'Speakers & Audio', icon: '🔊' },
  'headphones-earbuds': { name: 'Headphones & Earbuds', icon: '🎧' },
  'perfumes-fragrances': { name: 'Perfumes & Fragrances', icon: '🌸' },
  'makeup': { name: 'Makeup', icon: '💄' },
  'hair-care-styling': { name: 'Hair Care & Styling', icon: '💇' },
  'skincare': { name: 'Skincare', icon: '🧴' },
  'personal-care': { name: 'Personal Care', icon: '🪥' },
  'baby-kids': { name: 'Baby & Kids', icon: '👶' },
  'gaming': { name: 'Gaming', icon: '🎮' },
  'toys': { name: 'Toys', icon: '🧸' },
  'fitness-sports': { name: 'Fitness & Sports', icon: '🏋️' },
  'cameras-photography': { name: 'Cameras & Photography', icon: '📷' },
  'musical-instruments': { name: 'Musical Instruments', icon: '🎸' },
  'furniture': { name: 'Furniture', icon: '🛋️' },
  'bathroom': { name: 'Bathroom', icon: '🚿' },
  'lighting': { name: 'Lighting', icon: '💡' },
  'smart-home': { name: 'Smart Home', icon: '🏠' },
  'garden-outdoor': { name: 'Garden & Outdoor', icon: '🌿' },
  'power-tools': { name: 'Power Tools', icon: '🔨' },
  'automotive': { name: 'Automotive', icon: '🚗' },
  'bags-backpacks': { name: 'Bags & Backpacks', icon: '🎒' },
  'other': { name: 'Other', icon: '📦' },
};

// Helper: check if slug is a main category
export function isMainCategory(slug: string): boolean {
  return slug in MAIN_CATEGORIES;
}

// Helper: find which main category a subcat belongs to
export function getMainCategoryForSubcat(subcatSlug: string): string | null {
  for (const [mainSlug, config] of Object.entries(MAIN_CATEGORIES)) {
    if (config.subcategories.includes(subcatSlug)) return mainSlug;
  }
  return null;
}

// ============================================
// DATABASE QUERIES
// ============================================

// Get all categories
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data || [];
}

// Get keywords by category (subcat slug) — single FK join query.
// ML 3 (2026-07-17): the REAL fix for the empty kitchen-appliances / coffee-tea
// pages is the narrowed SELECT below — the old `select('*')` pulled the heavy
// `qa_guide` JSONB for every row (664/321 rows), blowing past the Postgres
// statement timeout (57014); selecting only the columns the page uses runs in
// ~300ms. readWithRetry adds resilience on top: retry a transient blip, then throw
// at RUNTIME (so a failed render isn't cached empty) but degrade at BUILD (so a
// build-time timeout under concurrency doesn't fail the deploy).
export async function getKeywordsByCategory(
  categorySlug: string,
): Promise<Pick<Keyword, 'id' | 'keyword_text' | 'slug'>[]> {
  const rows = await readWithRetry<Pick<Keyword, 'id' | 'keyword_text' | 'slug'>[]>(
    `getKeywordsByCategory("${categorySlug}")`,
    () =>
      supabase
        .from('keywords')
        .select('id, keyword_text, slug, categories!inner(slug)')
        .eq('categories.slug', categorySlug)
        .order('keyword_text') as unknown as PromiseLike<{
        data: Pick<Keyword, 'id' | 'keyword_text' | 'slug'>[] | null;
        error: { message?: string } | null;
      }>,
  );
  return rows || [];
}

// Get keyword by slug
export async function getKeywordBySlug(slug: string): Promise<Keyword | null> {
  // Slugs are always lowercase
  const normalizedSlug = slug.toLowerCase();

  // ML 3 (2026-07-17): use limit(1) + first row — NOT single()/maybeSingle().
  // Some slugs have DUPLICATE rows in the table (e.g. asus-vivobook has 2), and
  // single()/maybeSingle() ERROR on multiple rows — under readWithRetry that threw
  // and FAILED THE BUILD. limit(1) resolves duplicates to one keyword (lowest id)
  // and returns null only for genuinely-missing slugs (real 404). Only an actual DB
  // error is retried → thrown at runtime (not cached) / degraded at build.
  const rows = await readWithRetry<Keyword[]>('getKeywordBySlug', () =>
    supabase
      .from('keywords')
      .select('id, keyword_text, slug, category_id, qa_guide, validation_status, scraped_at')
      .eq('slug', normalizedSlug)
      .order('id')
      .limit(1),
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

// CONTENT-BY-ASIN model (2026-07-06, "max generalization"): a product's CONTENT
// (title, WWL, image, …) is ONE row per asin — the English base — SHARED by every
// program. `marketplace` is only a MEMBERSHIP axis on keyword_products (which
// asins a program shows) + the derived link; it is NOT part of product identity.
// This map records which storefronts are NON-English-native (their catalog was
// scraped in another language), so on an English page we know to pull the English
// overlay for their asins. English-native storefronts (ae/us/uk/sg/nl/…) skip the
// overlay — English IS the base — keeping the hot AE path a single content read.
// (Removed MARKETPLACE_NATIVE_LOCALE 2026-07-09 — the overlay now skips only the
// true ae+en base; see getProductsForKeyword step 3.)

// Get products for a keyword.
// LIMIT: Returns max 10 products, ordered by rank.
// Buffer system: Scraper links 15 → Website shows 10 → room for OOS/removals.
//
// Reads in three steps so product CONTENT can be shared across programs:
//   1. MEMBERSHIP — keyword_products for THIS program (marketplace) → the asins.
//   2. CONTENT    — products by asin (NOT by marketplace). Schema-agnostic: while
//      the legacy per-market rows still exist a shared asin may return >1 row, so
//      we pick the canonical one (prefer 'ae' = the English base). After the DB
//      collapse there is exactly one row per asin and the pick is a no-op.
//   3. OVERLAY    — the requested language by (asin, locale), when the program is
//      not English-native for that locale.
export async function getProductsForKeyword(
  keywordId: number,
  locale: string = 'en',
  marketplace: string = 'ae', // which program's catalog membership to serve (geo-driven)
): Promise<(Product & KeywordProduct)[]> {
  // 1) MEMBERSHIP — which asins this program ranks for the keyword.
  // ML 3 (2026-07-17): retry-then-throw on a real DB error (readWithRetry) so a
  // transient blip can't render an empty listing that ISR caches for 7 days. A
  // legitimate empty result (0 asins — some keywords genuinely have no products)
  // still returns [] normally below; only ERRORS throw.
  const links = await readWithRetry<
    Pick<KeywordProduct, 'asin' | 'rank' | 'price_at_scrape' | 'scraped_at' | 'validated_at'>[]
  >(`getProductsForKeyword.membership(kw=${keywordId},mkt=${marketplace})`, () =>
    supabase
      .from('keyword_products')
      .select('asin, rank, price_at_scrape, scraped_at, validated_at')
      .eq('keyword_id', keywordId)
      .eq('marketplace', marketplace)
      .order('rank')
      .limit(15), // Fetch 15 (buffer), will filter to 10
  );

  const linkRows = links || [];
  const asins = Array.from(new Set(linkRows.map(l => l.asin).filter(Boolean)));
  if (asins.length === 0) return []; // legitimate empty (not an error) — render graceful empty state

  // 2) CONTENT — shared product rows by asin. Canonical pick (prefer 'ae' English
  // base) covers the transition window where a shared asin still has per-market
  // rows; post-collapse each asin has one row and this just returns it.
  // ML 3 (2026-07-17): same retry-then-throw guard as the membership read — a
  // transient failure here must not cache an empty listing.
  const prodRows = await readWithRetry<(Product & { marketplace?: string })[]>(
    `getProductsForKeyword.content(kw=${keywordId})`,
    () => supabase.from('products').select('*').in('asin', asins),
  );

  const canonical = new Map<string, Product>();
  for (const p of (prodRows || []) as (Product & { marketplace?: string })[]) {
    const cur = canonical.get(p.asin) as (Product & { marketplace?: string }) | undefined;
    if (!cur || (p.marketplace === 'ae' && cur.marketplace !== 'ae')) {
      canonical.set(p.asin, p);
    }
  }

  // Join membership (rank order) + content; drop OOS; take top 10; sanitize title.
  const products = linkRows
    .map(l => {
      const p = canonical.get(l.asin);
      return p ? { ...(p as Product), ...l } : null;
    })
    .filter((p): p is Product & KeywordProduct => !!p && !p.is_out_of_stock)
    .slice(0, 10)
    .map(p => ({ ...p, title: sanitizeProductTitle(p.title ?? '') }));

  // 3) OVERLAY — apply the requested language for every render EXCEPT the TRUE
  // base (AE English), where products.* already IS the content so we skip and keep
  // the AE hot path to one read (byte-identical to before).
  // INTL1 JP (2026-07-09): was `locale !== marketplaceNative`, which wrongly SKIPPED
  // the overlay for jp+ja (ja is jp-native). But a JP product's base wwl_points is
  // ENGLISH (the shared base, needed by the English /best page shown to JP-geo
  // visitors) — the Japanese WWL lives only in product_translations(asin,'ja'). So
  // jp+ja MUST read its ja overlay: title (Japanese, for shared asins; absent for
  // JP-only asins → keeps the Japanese base title) + wwl (Japanese). Skipping only
  // the ae+en base keeps AE unchanged while /ja gets Japanese WWL. AE/ar and JP/en
  // already ran the overlay and are unaffected.
  const isBaseRender = marketplace === 'ae' && locale === 'en';
  if (!isBaseRender && products.length > 0) {
    const pa = products.map(p => p.asin).filter(Boolean);
    const { data: translations, error: tErr } = await supabase
      .from('product_translations')
      .select('asin, title, wwl_points, bullet_points')
      .eq('locale', locale)
      .in('asin', pa);

    if (tErr) {
      console.error('Error fetching product translations:', tErr);
    } else {
      // (2026-08-28) A FOREIGN-language page (ar/ja) must never leak English base
      // content: for both WWL and the "for Nerds" specs (bullet_points), use the
      // product's localized value when present, else CLEAR it. WWL then renders the
      // locale-aware rank fallback; specs simply hide until the localized backfill
      // (product_translations.bullet_points) lands. English renders on non-AE
      // markets (locale==='en') keep the real English base values untouched. Title
      // stays localized whenever a translation row exists.
      const isForeign = locale !== 'en';
      const byAsin = new Map<
        string,
        { title: string | null; wwl_points: unknown; bullet_points: unknown }
      >();
      for (const t of translations ?? []) if (!byAsin.has(t.asin)) byAsin.set(t.asin, t);
      for (const p of products) {
        const tr = byAsin.get(p.asin);
        if (tr) {
          const localizedTitle = sanitizeProductTitle(tr.title ?? '');
          if (localizedTitle) p.title = localizedTitle;
        }
        const hasLocalizedWwl =
          !!tr && Array.isArray(tr.wwl_points) && tr.wwl_points.length > 0;
        if (hasLocalizedWwl) {
          p.wwl_points = tr!.wwl_points as string[];
        } else if (isForeign) {
          p.wwl_points = [];
        }
        const hasLocalizedBullets =
          !!tr && Array.isArray(tr.bullet_points) && tr.bullet_points.length > 0;
        if (hasLocalizedBullets) {
          p.bullet_points = tr!.bullet_points as string[];
        } else if (isForeign) {
          p.bullet_points = [];
        }
      }
    }
  }

  return products;
}

// INTL1 Phase 2C slice 4: per-keyword translated copy (buying guide + noun phrase)
// from keyword_translations. Returns null for English or when no localized row
// exists yet — the caller falls back to the English keyword fields.
export async function getKeywordTranslation(
  keywordId: number,
  locale: string,
): Promise<{ keyword_text: string | null; qa_guide: unknown } | null> {
  if (locale === 'en') return null;
  const { data, error } = await supabase
    .from('keyword_translations')
    .select('keyword_text, qa_guide')
    .eq('keyword_id', keywordId)
    .eq('locale', locale)
    .maybeSingle();
  if (error) {
    console.error('Error fetching keyword translation:', error);
    return null;
  }
  return data ?? null;
}

// Is an Arabic buying guide actually present (non-empty)? The translation flow
// fills a page in stages — the noun first (qa_guide left empty), then the BYG.
// A page is "ready to index" only once its editorial text (noun + BYG) is
// Arabic; WWL can lag (English bullets fall back). qa_guide is a jsonb array of
// {q,a}; an empty array (or null) means BYG not done yet.
export function hasBuyingGuide(qa: unknown): boolean {
  if (Array.isArray(qa)) return qa.length > 0;
  if (typeof qa === 'string') {
    const s = qa.trim();
    if (!s || s === '[]') return false;
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.length > 0 : !!s;
    } catch {
      return !!s;
    }
  }
  return false;
}

// INTL1 JP (2026-07-09): how many products a program (marketplace) lists for a
// keyword. Used to gate /ja indexing on JP-catalog presence: a /ja page with no JP
// products gives JP visitors dead amazon.co.jp links, so it must NOT be indexed.
export async function getKeywordMarketplaceCount(keywordId: number, marketplace: string): Promise<number> {
  // Data-length (not head+count): mirrors getProductsForKeyword's read exactly, so it
  // behaves identically under RLS/anon and avoids the head:true count quirk. We only
  // need to know presence (>=1), so a small cap is enough.
  const { data, error } = await supabase
    .from('keyword_products')
    .select('asin')
    .eq('keyword_id', keywordId)
    .eq('marketplace', marketplace)
    .limit(15);
  if (error) {
    console.error('Error counting keyword_products:', error);
    return 0;
  }
  return (data ?? []).length;
}

// INTL1 (DB-driven auto-index): the set of /best slugs READY to index for a
// given locale = those with a noun AND a non-empty BYG in that locale. This
// REPLACES the baked allowlist — the sitemap includes, and the /<locale>/best
// page sets robots:index for, exactly these slugs. So a page indexes
// automatically once its noun+BYG are published (Stage 1 + Stage 2), no deploy.
// Lowercased to match URL slugs.
// INTL1 JP Phase 2 (2026-07-06): parameterized by `locale` (was ar-only) so /ja
// reuses the identical gate. Callers pass 'ar' or 'ja'.
export async function getTranslatedSlugs(locale: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('keyword_translations')
      .select('qa_guide, keywords(slug)')
      .eq('locale', locale)
      // 2026-08-30: stable sort is REQUIRED for range() pagination — without it PostgREST
      // returns rows in unspecified order and pages silently skip/duplicate rows, so the
      // set came back short & non-deterministically (same bug getAllKeywords documents).
      // keyword_id is unique within a locale, so it's a stable total order.
      .order('keyword_id', { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      console.error(`Error fetching ${locale} translated slugs:`, error);
      break;
    }
    // supabase-js types the embedded relation as an array; at runtime a to-one
    // FK returns a single object. Handle both.
    const rows = (data ?? []) as any[];
    for (const r of rows) {
      if (!hasBuyingGuide(r?.qa_guide)) continue; // need noun + BYG to index
      const kw = r?.keywords;
      const slug: string | undefined = Array.isArray(kw) ? kw[0]?.slug : kw?.slug;
      if (slug) slugs.add(slug.toLowerCase());
    }
    if (rows.length < page) break;
    from += page;
  }
  return slugs;
}

// Set of keyword slugs (lowercased) that have >=1 catalog product in `marketplace`.
// One paginated join (mirrors getTranslatedSlugs) so a sitemap can apply the SAME catalog
// gate the page uses for jaIndexed — jaIndexed requires getKeywordMarketplaceCount('jp')>=1
// — without an N-per-keyword fan-out. 2026-08-30 (JP-only GSC sitemap).
export async function getMarketplaceSlugs(marketplace: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('keyword_products')
      .select('keywords(slug)')
      .eq('marketplace', marketplace)
      // 2026-08-30: stable sort REQUIRED for range() pagination (see getTranslatedSlugs).
      // Without it the JP sitemap undercounted non-deterministically (~1,192–1,493 instead
      // of the true 1,999). (keyword_id, asin) is unique within one marketplace.
      .order('keyword_id', { ascending: true })
      .order('asin', { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      console.error(`Error fetching ${marketplace} product slugs:`, error);
      break;
    }
    const rows = (data ?? []) as any[];
    for (const r of rows) {
      const kw = r?.keywords;
      const slug: string | undefined = Array.isArray(kw) ? kw[0]?.slug : kw?.slug;
      if (slug) slugs.add(slug.toLowerCase());
    }
    if (rows.length < page) break;
    from += page;
  }
  return slugs;
}

// Search keywords
export async function searchKeywords(query: string, limit: number = 6): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .ilike('keyword_text', `%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching keywords:', error);
    return [];
  }
  return data || [];
}

// Get all keywords for sitemap
export async function getAllKeywords() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return [] as { slug: string }[];
  }

  // Supabase default limit is 1,000 rows — paginate to get all.
  // 2026-08-25 (rerank-11): two correctness fixes for the sitemap split —
  //   (1) ORDER BY id: range() pagination WITHOUT a stable sort can skip or duplicate
  //       rows across pages (PostgREST order is otherwise unspecified). Ordering makes
  //       every call return the identical, complete set — so the sitemap INDEX chunk
  //       count and the chunk reads agree (they disagreed before → dropped URLs).
  //   (2) retry a failing page, then THROW instead of silently returning a partial list
  //       (the old `break`-on-error truncated the sitemap on any transient DB blip).
  const allKeywords: { slug: string }[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    let data: { slug: string }[] | null = null;
    let lastErr: { message?: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await supabase
        .from('keywords')
        .select('slug, id')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (!res.error) { data = res.data as { slug: string }[]; lastErr = null; break; }
      lastErr = res.error;
      console.error(`getAllKeywords page @${from} attempt ${attempt} failed:`, res.error);
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    if (lastErr) {
      // never silently truncate — a partial sitemap silently drops thousands of URLs
      throw new Error(`getAllKeywords failed at offset ${from}: ${lastErr.message ?? 'unknown'}`);
    }
    if (!data || data.length === 0) break;
    allKeywords.push(...data.map((r) => ({ slug: r.slug })));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allKeywords;
}

// Get popular keywords for homepage
export async function getPopularKeywords(limit: number = 6): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular keywords:', error);
    return [];
  }
  return data || [];
}

// ============================================
// BUILD-TIME ONLY: top keyword slugs by recent traffic (for generateStaticParams)
// ============================================
// Pre-rendering the hottest keyword pages turns repeated crawler/bot hits into
// CDN cache hits instead of cold DB renders — the exact load that exhausted the
// Disk IO budget. Intentionally BOUNDED (default 250) and English-only so the
// build cost stays tiny and predictable no matter how large the catalog grows
// (10K today → 1M later) and never spikes the shared DB during a build. The long
// tail keeps rendering on-demand via ISR (dynamicParams=true).
//
// Uses the service-role key (present in the build env) so it reads click_log
// reliably regardless of RLS, and returns [] on ANY error so a data hiccup
// degrades gracefully to on-demand rendering — it can never fail the build.
export async function getTopKeywordSlugs(limit: number = 250): Promise<string[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return [];

    const admin = createClient(url, serviceKey);
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Recent English /best landing pages. Arabic is "/ar/best/..." and is
    // excluded by the prefix — Arabic stays on-demand (it's noindex anyway).
    const { data, error } = await admin
      .from('click_log')
      .select('landing_page')
      .like('landing_page', '/best/%')
      .gte('created_at', sinceIso)
      .limit(50000);

    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      const lp = (row as { landing_page: string | null }).landing_page;
      const m = lp ? lp.match(/^\/best\/([^/?#]+)/) : null;
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([slug]) => slug);
  } catch {
    return [];
  }
}
