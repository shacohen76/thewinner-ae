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
// 2026-07-14 (ML 2.5): 'us' added — US-geo visitors on /best now swap in the US
// catalog (amazon.com products + thewinnerusa-20 links via TrackingProvider).
// 2026-07-16 (ML 2.6): 'uk' added — GB-geo visitors swap in the UK catalog
// (amazon.co.uk products + thewinneruk-21 links). UK canary of the EN-fleet rollout.
const CATALOG_MARKETPLACES = new Set(['jp', 'us', 'uk']);

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
  // ML 3 (2026-07-17): true when we are SHOWING the AE fallback catalog to a
  // NON-AE visitor because their store has no NATIVE product for this keyword.
  // Consumers keep the AE cards but render Amazon SEARCH links (the AE /dp/{asin}
  // would 404 on the visitor's marketplace). Never true for AE.
  searchFallback: boolean;
  // ML 3 (2026-07-17): the English keyword (deslugified slug — slugs are always
  // English). On a LOCALIZED page the product title is Arabic/Japanese, which is
  // a poor search query on most stores; consumers use this English keyword
  // instead so the fallback search returns relevant results. English pages keep
  // using the per-product title.
  keywordEn: string;
}

const GeoCatalogContext = createContext<SwapValue>({ list: null, gallery: null, searchFallback: false, keywordEn: '' });

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
  // English keyword for fallback search queries (slugs are always English).
  const keywordEn = slug.replace(/-/g, ' ').trim();
  const [value, setValue] = useState<SwapValue>({ list: null, gallery: null, searchFallback: false, keywordEn });

  useEffect(() => {
    // A localized page pins to its language's catalog (LOCALE_CATALOG); otherwise
    // the catalog follows the visitor's geo (tw_geo) as before — so a JP-geo
    // visitor on the English /best still gets JP products.
    const program = LOCALE_CATALOG[locale] ?? readGeoProgram();

    // AE is the SSR catalog itself — its /dp links are native/valid. Keep as-is.
    if (program === 'ae') return;

    // ML 3 (2026-07-17): UNIVERSAL never-empty/never-dead default. Any non-AE
    // program that has NO swap-able catalog (de/fr/sa/ca/au/sg/… and any newly
    // launched program not yet in CATALOG_MARKETPLACES) would otherwise show AE
    // cards whose /dp/{ae-asin} links 404 on the visitor's store. Show the AE
    // cards with SEARCH links instead — never empty, never a dead link. No fetch.
    if (!CATALOG_MARKETPLACES.has(program)) {
      setValue({ list: null, gallery: null, searchFallback: true, keywordEn });
      return;
    }

    // Catalog program (us/uk/jp, …) → fetch its catalog; empty → search fallback
    // (handled below), products present → native swap.
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
        // This storefront (us/uk/jp) has a catalog dimension but NO products for
        // this keyword.
        // ML 3 (2026-07-17) — CHANGED from showing an empty page. Previously we
        // set {list: [], gallery: []} → ProductList rendered the empty state,
        // which left ~88% of keywords blank for us/uk/jp visitors ("we can't
        // afford empty listings"). Now we KEEP the SSR AE products (list/gallery
        // stay null → consumers fall back to the AE catalog) and flag
        // searchFallback so each card links to an Amazon SEARCH on the visitor's
        // own store instead of the dead /dp/{AE-asin} cross-marketplace link.
        // The metadata catalog gate still keeps these pages out of the index.
        if (products.length === 0) {
          setValue({ list: null, gallery: null, searchFallback: true, keywordEn });
          return;
        }

        setValue({
          searchFallback: false,
          keywordEn,
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
  }, [slug, locale, keywordEn]);

  return <GeoCatalogContext.Provider value={value}>{children}</GeoCatalogContext.Provider>;
}
