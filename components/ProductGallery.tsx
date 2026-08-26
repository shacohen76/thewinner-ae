'use client';
// ============================================
// ProductGallery.tsx — Quick pick horizontal carousel
// Created: 2026-03-19
// Adapted from KSP: English LTR, Amazon links
// ============================================

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { buildAffiliateUrl, buildAffiliateSearchUrl, cleanSearchQuery } from '@/lib/utils';

interface Product {
  asin: string;
  title: string;
  image_url: string | null;
  rank: number;
}

interface ProductGalleryProps {
  products: Product[];
  // 2026-08-26 (feat/per-geo-static-best): catalog chosen server-side (params.market)
  // — `products` is already the per-geo set (retired the client GeoCatalog swap).
  // ML 3 (2026-07-17): searchFallback → AE cards shown to a non-AE market whose store
  // lacks this keyword; link to an Amazon search on their store instead of a dead
  // /dp/{AE-asin}. keywordEn = the English query for localized pages.
  searchFallback?: boolean;
  keywordEn?: string;
}

export default function ProductGallery({ products, searchFallback, keywordEn }: ProductGalleryProps) {
  const locale = useLocale();
  // INTL1 JP Phase 2 (2026-07-06): localize the carousel heading (was hardcoded
  // English "Quick Pick", which leaked onto /ar and /ja). English value in
  // messages is byte-exact, so en output is unchanged.
  const t = useTranslations('BestPage');

  if (products.length === 0) return null;

  return (
    <section className="bg-gray-50 border-t py-12">
      <div className="max-w-6xl mx-auto px-4 overflow-hidden">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
          {t('quickPick')}
        </h2>

        <div className="carousel-scroll flex gap-4 pb-4">
          {products.map((product) => (
            <a
              key={product.asin}
              href={searchFallback
                ? buildAffiliateSearchUrl(locale === 'en' ? cleanSearchQuery(product.title) : (keywordEn || cleanSearchQuery(product.title)))
                : buildAffiliateUrl(product.asin, product.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none w-64 bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl"
            >
              <div className="relative">
                <div className="absolute top-3 start-3 z-10 bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                  #{product.rank}
                </div>

                <div className="h-48 bg-gray-50 flex items-center justify-center p-4">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.title}
                      width={160}
                      height={160}
                      className="object-contain max-h-40"
                      unoptimized
                    />
                  ) : (
                    <div className="text-6xl">📦</div>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 h-10 mb-3">
                  {product.title}
                </h3>

                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-2 rounded-lg text-sm font-medium">
                  View Details
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
