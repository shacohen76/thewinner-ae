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
// Why an API (not per-geo SSR): keeps the cached HTML single + AE-identical
// (site-speed priority #1). Response is deterministic per (slug, mkt, locale)
// so it is CDN-cacheable — a JP visitor's fetch is served from the edge.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getKeywordBySlug, getProductsForKeyword } from '@/lib/supabase';

// Only marketplaces that actually HAVE a catalog to swap in. AE is the SSR
// default (never fetched here). Extend as JP-6 generalizes to us/uk/de.
const CATALOG_MARKETPLACES = new Set(['jp']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const slug = (sp.get('slug') || '').toLowerCase();
  const mkt = (sp.get('mkt') || '').toLowerCase();
  const locale = sp.get('locale') || 'en';

  // Guard: no slug, or a marketplace with no catalog → empty (client keeps SSR AE).
  if (!slug || !CATALOG_MARKETPLACES.has(mkt)) {
    return NextResponse.json({ products: [] });
  }

  const keyword = await getKeywordBySlug(slug);
  if (!keyword) {
    return NextResponse.json({ products: [] });
  }

  const products = await getProductsForKeyword(keyword.id, locale, mkt);

  return NextResponse.json(
    { products },
    {
      headers: {
        // Deterministic per (slug, mkt, locale) → cache at the edge. SWR keeps it
        // warm; a catalog update (new scrape → migrate) shows within the window.
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
