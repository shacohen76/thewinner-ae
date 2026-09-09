// Shopee affiliate link retrieval (SEA-gated, fails-closed). Added 2026-09-09.
// Reads the `shopee_links` table (RLS: only status='active' rows are visible to anon).
// Used by app/[locale]/best/[market]/[slug]/page.tsx to render a "Also on Shopee"
// CTA in parallel to Amazon for SEA visitors (market === 'sg'). Never throws.
import { supabase } from './supabase';

export type ShopeeLink = {
  page_slug: string;
  market: string;
  asin: string | null;            // null = page-level hero; set = tied to one ProductCard
  shopee_offer_id: string | null;
  shop_name: string | null;
  short_link: string;             // https://s.shopee.sg/...
  sub_id: string | null;
  price_sgd: number | null;
  sold: string | null;
  status: string;
};

export type ShopeeForPage = {
  hero?: ShopeeLink;                    // shown once (banner) when no per-product link
  byAsin: Record<string, ShopeeLink>;   // per-product links keyed by our ASIN
};

const EMPTY: ShopeeForPage = { byAsin: {} };

/**
 * Fetch active Shopee links for a page. SEA-only; any error → EMPTY so the page
 * renders normally with no Shopee UI. Callers should treat an empty result as
 * "no Shopee button".
 */
export async function getShopeeForPage(
  pageSlug: string,
  market: string,
): Promise<ShopeeForPage> {
  if (market !== 'sg') return EMPTY; // SEA program bucket only
  try {
    const { data, error } = await supabase
      .from('shopee_links')
      .select(
        'page_slug, market, asin, shopee_offer_id, shop_name, short_link, sub_id, price_sgd, sold, status',
      )
      .eq('page_slug', pageSlug)
      .eq('market', market)
      .eq('status', 'active'); // RLS also enforces this
    if (error || !data) return EMPTY;
    const out: ShopeeForPage = { byAsin: {} };
    for (const r of data as ShopeeLink[]) {
      if (r.asin) out.byAsin[r.asin] = r;
      else out.hero = r;
    }
    return out;
  } catch {
    return EMPTY;
  }
}
