/**
 * ProductList.tsx — Displays sorted product cards with share functionality
 * Created: 2026-03-19
 * Adapted from KSP: English LTR, ASIN-based, price sort kept
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ProductCard from './ProductCard';
import ShareButton from './ShareButton';

interface Product {
  asin: string;
  title: string;
  description: string | null;
  image_url: string | null;
  wwl_points: string[] | null;
  bullet_points: string[] | null;   // 2026-08-28: feature specs (Creators API) → "…for Nerds"
  rank: number;
  price_at_scrape: string | null;
  is_on_discount: boolean;
  discount_percentage: number | null;
  is_prime: boolean;
}

interface ProductListProps {
  products: Product[];
  // 2026-08-26 (feat/per-geo-static-best): the per-geo catalog is now chosen
  // server-side (params.market), so `products` is already the correct set — the
  // client GeoCatalog swap is retired. searchFallback/keywordEn come down as props
  // (were React context) and thread to each card's Amazon link decision.
  searchFallback?: boolean;
  keywordEn?: string;
}

// 2026-08-26 (SSR restore): deterministic fake "review count" (500-5500) seeded by
// ASIN. Was Math.floor(Math.random()*5000)+500 at the call site, which mismatched
// between server and client once the page began server-rendering (React #425
// hydration text mismatch). Stable per product keeps SSR and client identical.
function seededReviewCount(asin: string): number {
  let h = 0;
  for (let i = 0; i < asin.length; i++) h = (Math.imul(h, 31) + asin.charCodeAt(i)) | 0;
  return 500 + (Math.abs(h) % 5001); // 500..5500
}

type SortOption = 'rank' | 'price';

export default function ProductList({ products, searchFallback, keywordEn }: ProductListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const t = useTranslations('ProductList');

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'price') {
      const priceA = a.price_at_scrape ? parseFloat(a.price_at_scrape) : Infinity;
      const priceB = b.price_at_scrape ? parseFloat(b.price_at_scrape) : Infinity;
      return priceA - priceB;
    }
    return a.rank - b.rank;
  });

  // 2026-09-05: the red "discounted" badge is limited to the two top-ranked cards
  // + the single cheapest one (max 3 of ~10), so the deal signal stays credible.
  // Everything else shows a neutral "great everyday price" badge.
  const dealAsins = new Set<string>(
    products.filter((p) => p.rank === 1 || p.rank === 2).map((p) => p.asin),
  );
  const pricedProducts = products.filter(
    (p) => p.price_at_scrape != null && !Number.isNaN(parseFloat(p.price_at_scrape)),
  );
  if (pricedProducts.length > 0) {
    const cheapest = pricedProducts.reduce((lo, p) =>
      parseFloat(p.price_at_scrape!) < parseFloat(lo.price_at_scrape!) ? p : lo,
    );
    dealAsins.add(cheapest.asin);
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('emptyTitle')}</h3>
        <p className="text-gray-500">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Sort Controls + Share Button */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        {/* Sort Controls — Left side (LTR) */}
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-2">
          <span className="text-sm text-gray-500">{t('sort')}</span>
          <button
            onClick={() => setSortBy('rank')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === 'rank'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('recommended')}
          </button>
          <button
            onClick={() => setSortBy('price')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === 'price'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('lowestPrice')}
          </button>
        </div>

        {/* Share Button — Right side (LTR) */}
        <ShareButton />
      </div>

      {/* Products */}
      <div className="space-y-6">
        {sortedProducts.map((product) => (
          <ProductCard
            key={product.asin}
            rank={product.rank}
            asin={product.asin}
            title={product.title}
            description={product.description}
            imageUrl={product.image_url}
            wwlPoints={product.wwl_points}
            bulletPoints={product.bullet_points}
            isPrime={product.is_prime}
            searchFallback={searchFallback}
            keywordEn={keywordEn}
            reviewCount={seededReviewCount(product.asin)}
            showDeal={dealAsins.has(product.asin)}
          />
        ))}
      </div>
    </>
  );
}
