// ============================================
// Catalog API — /api/catalog
// ============================================
// Created: 2026-07-06 (JP-3 render-by-catalog)
//
// Returns the product set for a keyword IN A SPECIFIC STOREFRONT CATALOG
// (marketplace). This is the server half of Option A: the /best page SSR stays
// the AE catalog (cached, byte-identical for crawlers + AE visitors), and the
// client GeoCatalog provider calls this route to swap in the visitor's own
// storefront catalog (e.g. JP → live amazon.co.jp products) after hydration.
//
// ── 2026-08-25 (rerank-11 caching fix) ──────────────────────────────────────
// BUG THIS FIXES: the previous version cached the Supabase read in Next's Data
// Cache implicitly (no tag, no revalidate) and layered a 1-DAY CDN header on top
// (s-maxage=86400). So after a rerank/migrate updated keyword_products.rank, the
// non-AE pages kept serving the OLD list — and because Vercel's Data Cache PERSISTS
// ACROSS DEPLOYMENTS, even a full redeploy did not clear it. Symptom: fixed ranks in
// the DB, but /api/catalog?mkt=us still returned the stale order for up to a day.
// FIX: wrap the read in a TAGGED cache (`catalog:<slug>`) with a 1h revalidate
// fallback, and shorten the CDN header to 60s. amz_revalidate_v1.py → /api/revalidate
// now purges `catalog:<slug>` on demand (see revalidate/route.ts), so a migrate
// propagates to every market within seconds instead of a day.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getKeywordBySlug, getProductsForKeyword } from '@/lib/supabase';

// Only marketplaces that actually HAVE a catalog to swap in. AE is the SSR
// default (never fetched here). Keep in sync with GeoCatalog.tsx.
const CATALOG_MARKETPLACES = new Set(['jp', 'us', 'uk', 'ca', 'ie', 'au', 'sg']);

// Tagged, revalidatable read. Tag `catalog:<slug>` lets /api/revalidate purge every
// (mkt, locale) variant of a slug in one call. A throw (persistent DB error) is NOT
// cached — it propagates to the caller's catch below, which returns an uncached empty.
function readCatalog(slug: string, locale: string, mkt: string) {
  return unstable_cache(
    async () => {
      const keyword = await getKeywordBySlug(slug);
      if (!keyword) return { products: [] }; // genuine miss — cacheable empty
      const products = await getProductsForKeyword(keyword.id, locale, mkt);
      return { products };
    },
    ['catalog', slug, mkt, locale], // cache key
    { tags: [`catalog:${slug}`], revalidate: 3600 },
  )();
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const slug = (sp.get('slug') || '').toLowerCase();
  const mkt = (sp.get('mkt') || '').toLowerCase();
  const locale = sp.get('locale') || 'en';

  // Guard: no slug, or a marketplace with no catalog → empty (client keeps SSR AE).
  if (!slug || !CATALOG_MARKETPLACES.has(mkt)) {
    return NextResponse.json({ products: [] });
  }

  try {
    const data = await readCatalog(slug, locale, mkt);
    return NextResponse.json(data, {
      headers: {
        // Short edge cache for speed; on-demand freshness comes from the tagged Next
        // cache above (purged by /api/revalidate). 60s bounds worst-case edge staleness.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('catalog route read failed:', e);
    return NextResponse.json(
      { products: [] },
      { headers: { 'Cache-Control': 'no-store' } }, // transient error — do NOT cache
    );
  }
}
