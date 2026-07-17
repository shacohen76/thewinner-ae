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
// 2026-07-14 (ML 2.5): 'us' added — US catalog live in Supabase (marketplace='us',
// 200-kw pilot, English content + WWL). Keep in sync with GeoCatalog.tsx.
// 2026-07-16 (ML 2.6): 'uk' added — UK canary of the EN-fleet rollout complete:
// 27,920 memberships / 1,998 kw / 22,461 ASINs / 100% WWL (amazon.co.uk catalog).
const CATALOG_MARKETPLACES = new Set(['jp', 'us', 'uk']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const slug = (sp.get('slug') || '').toLowerCase();
  const mkt = (sp.get('mkt') || '').toLowerCase();
  const locale = sp.get('locale') || 'en';

  // Guard: no slug, or a marketplace with no catalog → empty (client keeps SSR AE).
  if (!slug || !CATALOG_MARKETPLACES.has(mkt)) {
    return NextResponse.json({ products: [] });
  }

  // ML 3 (2026-07-17): getKeywordBySlug / getProductsForKeyword now THROW on a
  // persistent DB error (so the SSR /best page never caches an empty listing).
  // This route must stay resilient instead: catch and return an UNCACHED empty so
  // the client keeps the AE cards + search-fallback (working links) and recovers on
  // the next request — never a cached-empty catalog response.
  try {
    const keyword = await getKeywordBySlug(slug);
    if (!keyword) {
      // Genuine miss — cacheable empty.
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
  } catch (e) {
    console.error('catalog route read failed:', e);
    return NextResponse.json(
      { products: [] },
      { headers: { 'Cache-Control': 'no-store' } }, // transient error — do NOT cache
    );
  }
}
