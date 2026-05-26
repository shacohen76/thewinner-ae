// ============================================
// ReviewProductGallery.tsx — Static "Quick Pick" carousel for /review/* pages
// ============================================
// Created: 2026-05-26
// Purpose: Visual clone of components/ProductGallery.tsx but server-rendered
// with pre-computed affiliate URLs (passed in per product). Live
// ProductGallery uses buildAffiliateUrl() which defaults to amazon.ae in
// SSR — re-using it here would ship the wrong tag in source.
// ============================================

import Image from 'next/image';

interface GalleryProduct {
  asin: string;
  title: string;
  image_url: string | null;
  rank: number;
  /** Pre-computed Amazon URL with the program's domain + tag. */
  affiliateUrl: string;
}

interface ReviewProductGalleryProps {
  products: GalleryProduct[];
}

export default function ReviewProductGallery({ products }: ReviewProductGalleryProps) {
  if (products.length === 0) return null;

  return (
    <section className="bg-gray-50 border-t py-12">
      <div className="max-w-6xl mx-auto px-4 overflow-hidden">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
          Quick Pick
        </h2>

        <div className="carousel-scroll flex gap-4 pb-4">
          {products.map((product) => (
            <a
              key={product.asin}
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none w-64 bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl"
            >
              <div className="relative">
                <div className="absolute top-3 left-3 z-10 bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
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
