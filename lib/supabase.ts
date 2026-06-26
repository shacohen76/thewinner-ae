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

// ============================================
// DATABASE TYPES
// ============================================

export interface Product {
  asin: string;
  title: string;
  brand: string | null;
  image_url: string | null;
  product_url: string | null;
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

// Get keywords by category (subcat slug) — single FK join query
export async function getKeywordsByCategory(categorySlug: string): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from('keywords')
    .select('*, categories!inner(slug)')
    .eq('categories.slug', categorySlug)
    .order('keyword_text');

  if (error) {
    console.error('Error fetching keywords:', error);
    return [];
  }
  return data || [];
}

// Get keyword by slug
export async function getKeywordBySlug(slug: string): Promise<Keyword | null> {
  // Slugs are always lowercase
  const normalizedSlug = slug.toLowerCase();

  const { data, error } = await supabase
    .from('keywords')
    .select('id, keyword_text, slug, category_id, qa_guide, validation_status, scraped_at')
    .eq('slug', normalizedSlug)
    .single();

  if (error) {
    console.error('Error fetching keyword:', error);
    return null;
  }
  return data;
}

// Get products for a keyword
// LIMIT: Returns max 10 products, ordered by rank
// Buffer system: Scraper links 15 → Website shows 10 → Room for OOS/removals
export async function getProductsForKeyword(
  keywordId: number,
  locale: string = 'en',
): Promise<(Product & KeywordProduct)[]> {
  const { data, error } = await supabase
    .from('keyword_products')
    .select('*, products(*)')
    .eq('keyword_id', keywordId)
    .order('rank')
    .limit(15); // Fetch 15 (buffer), will filter to 10

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  // Filter out OOS products, then take top 10 (English titles, sanitized).
  const products = (data || [])
    .filter(item => item.products && !item.products.is_out_of_stock)
    .slice(0, 10)
    .map(item => ({
      ...item.products,
      ...item,
      title: sanitizeProductTitle(item.products?.title ?? ''),
      products: undefined
    }));

  // INTL1 Phase 2C: for non-English locales, overlay translated product fields
  // from product_translations (one shared table, `locale` column):
  //   • title       ← Creators API Arabic listing (slice 3)
  //   • wwl_points   ← our LLM translation (slice 4)
  // Per-FIELD fallback: keep the English value when a localized one is missing
  // (a product may have an Arabic title but no Arabic WWL yet, or vice-versa).
  // English path ('en') is untouched — it never runs this extra query.
  if (locale !== 'en' && products.length > 0) {
    const asins = products.map(p => p.asin).filter(Boolean);
    const { data: translations, error: tErr } = await supabase
      .from('product_translations')
      .select('asin, title, wwl_points')
      .eq('locale', locale)
      .in('asin', asins);

    if (tErr) {
      console.error('Error fetching product translations:', tErr);
    } else if (translations && translations.length > 0) {
      const byAsin = new Map(translations.map(t => [t.asin, t]));
      for (const p of products) {
        const tr = byAsin.get(p.asin);
        if (!tr) continue;
        const localizedTitle = sanitizeProductTitle(tr.title ?? '');
        if (localizedTitle) p.title = localizedTitle;
        if (Array.isArray(tr.wwl_points) && tr.wwl_points.length > 0) {
          p.wwl_points = tr.wwl_points;
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

// INTL1 (DB-driven auto-index): the set of /best slugs READY to index = those
// with an Arabic noun AND a non-empty Arabic BYG. This REPLACES the baked
// allowlist — the sitemap includes, and the /ar/best page sets robots:index
// for, exactly these slugs. So a page indexes automatically once its noun+BYG
// are published (Stage 1 + Stage 2), no deploy. Lowercased to match URL slugs.
export async function getArTranslatedSlugs(): Promise<Set<string>> {
  const slugs = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('keyword_translations')
      .select('qa_guide, keywords(slug)')
      .eq('locale', 'ar')
      .range(from, from + page - 1);
    if (error) {
      console.error('Error fetching ar translated slugs:', error);
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

  // Supabase default limit is 1,000 rows — paginate to get all
  const allKeywords: { slug: string }[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('keywords')
      .select('slug')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching keywords (sitemap pagination):', error);
      break;
    }

    if (!data || data.length === 0) break;
    allKeywords.push(...data);
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
