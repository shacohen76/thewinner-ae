'use client';
// ============================================
// GeoCatalog.tsx — client-side storefront-catalog swap (JP-3, Option A)
// ============================================
// Created: 2026-07-06
//
// The /best/[slug] page SSRs the AE catalog and is ISR-cached, shared across
// ALL geos (site-speed priority #1: crawlers + AE visitors always get the fast,
// byte-identical cached HTML). This provider layers the CATALOG axis on top,
// entirely client-side — mirroring how TrackingProvider already swaps Amazon
// link domains/tags per geo:
//
//   • Read tw_geo → resolve the visitor's Amazon program (storefront).
//   • AE (or any storefront we don't have a catalog for) → do nothing; the SSR
//     AE products stand. Zero fetch, zero overhead for the default path.
//   • A catalog storefront (jp today) → fetch that storefront's product set for
//     this keyword from /api/catalog and expose it via context. ProductList and
//     ProductGallery consume it and re-render with the visitor's own catalog
//     (e.g. live amazon.co.jp products) — so a JP visitor gets working links
//     instead of AE ASINs that are 64% dead on amazon.co.jp.
//
// Language follows the URL (locale prop): on /best the swapped JP titles are the
// English overlay; on a future /ja page the same swap yields Japanese titles.
// Catalog = f(geo), language = f(URL) — the two axes stay orthogonal.
//
// Bots never receive a tw_geo cookie (middleware skips them), so this is a no-op
// for crawlers — their rendered catalog stays the cached AE HTML.
// ============================================

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getGeoProgram } from '@/lib/geo-config';

// Storefronts that actually have a swap-able catalog. Keep in sync with the
// API route's allowlist. AE is the SSR default and is never fetched here.
const CATALOG_MARKETPLACES = new Set(['jp']);

// INTL1 JP (2026-07-09): locales that PIN to a specific storefront catalog —
// "language follows URL". A /ja page shows the JP catalog to EVERY visitor,
// regardless of geo (a Japanese page should never show AE products). Non-pinned
// locales (en, ar) keep following tw_geo. Extend as native programs launch:
// pl → 'pl', pt → 'br'.
const LOCALE_CATALOG: Record<string, string> = { ja: 'jp' };

export interface SwapListItem {
  asin: string;
  title: string;
  description: string | null;
  image_url: string | null;
  wwl_points: string[] | null;
  rank: number;
  price_at_scrape: string | null;
  is_on_discount: boolean;
  discount_percentage: number | null;
  is_prime: boolean;
}
export interface SwapGalleryItem {
  asin: string;
  title: string;
  image_url: string | null;
  rank: number;
}
interface SwapValue {
  // null = "use the SSR (AE) products" — the default until/unless a swap lands.
  list: SwapListItem[] | null;
  gallery: SwapGalleryItem[] | null;
}

const GeoCatalogContext = createContext<SwapValue>({ list: null, gallery: null });

/** Consumed by ProductList / ProductGallery — returns swapped catalog or nulls. */
export function useGeoCatalog(): SwapValue {
  return useContext(GeoCatalogContext);
}

/** Resolve the visitor's Amazon program from the tw_geo cookie (pure, client). */
function readGeoProgram(): string {
  if (typeof document === 'undefined') return 'ae';
  const m = document.cookie.match(/(?:^|;\s*)tw_geo=([A-Za-z]{2})/);
  return getGeoProgram(m ? m[1] : '');
}

export default function GeoCatalogProvider({
  slug,
  locale,
  children,
}: {
  slug: string;
  locale: string;
  children: ReactNode;
}) {
  const [value, setValue] = useState<SwapValue>({ list: null, gallery: null });

  useEffect(() => {
    // A localized page pins to its language's catalog (LOCALE_CATALOG); otherwise
    // the catalog follows the visitor's geo (tw_geo) as before — so a JP-geo
    // visitor on the English /best still gets JP products.
    const program = LOCALE_CATALOG[locale] ?? readGeoProgram();
    // Default storefront (AE) or one with no catalog → keep the SSR products.
    if (program === 'ae' || !CATALOG_MARKETPLACES.has(program)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/catalog?slug=${encodeURIComponent(slug)}&mkt=${program}&locale=${encodeURIComponent(locale)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const products: any[] = Array.isArray(data?.products) ? data.products : [];
        if (cancelled) return;
        // INTL1 JP (2026-07-09): this geo has a catalog dimension (jp) but NO products
        // for this keyword. Do NOT keep the SSR AE products — their affiliate links
        // resolve to amazon.co.jp/dp/{AE-asin}, which 404 for a JP visitor (dead
        // cross-marketplace links). Show NO products instead (graceful empty state);
        // these pages are also kept out of the index by the metadata catalog gate.
        if (products.length === 0) {
          setValue({ list: [], gallery: [] });
          return;
        }

        setValue({
          list: products.map((p) => ({
            asin: p.asin,
            title: p.title,
            description: p.description ?? null,
            image_url: p.image_url ?? null,
            wwl_points: p.wwl_points ?? null,
            rank: p.rank,
            price_at_scrape: p.price_at_scrape ?? null,
            is_on_discount: p.is_on_discount || false,
            discount_percentage: p.discount_percentage || null,
            is_prime: false,
          })),
          gallery: products.map((p) => ({
            asin: p.asin,
            title: p.title,
            image_url: p.image_url ?? null,
            rank: p.rank,
          })),
        });
      } catch {
        // Any failure → keep the SSR AE products.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  return <GeoCatalogContext.Provider value={value}>{children}</GeoCatalogContext.Provider>;
}
