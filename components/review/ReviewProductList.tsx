// ============================================
// ReviewProductList.tsx — Static product list for /review/* pages
// ============================================
// Created: 2026-05-26
// Purpose: Visual clone of components/ProductList.tsx but server-rendered
// with no sort controls and no Share button — Amazon-review pages must be
// deterministic in source order (no client-side state).
// ============================================

import ReviewProductCard from './ReviewProductCard';

interface Product {
  asin: string;
  title: string;
  description: string | null;
  image_url: string | null;
  wwl_points: string[] | null;
  rank: number;
  /** Pre-computed Amazon URL with the program's domain + tag. */
  affiliateUrl: string;
}

interface ReviewProductListProps {
  products: Product[];
}

export default function ReviewProductList({ products }: ReviewProductListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No products yet</h3>
        <p className="text-gray-500">We&apos;re working on adding products to this category</p>
      </div>
    );
  }

  // Always rank order; no client-side sorting on review pages.
  const sortedProducts = [...products].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6">
      {sortedProducts.map((product) => (
        <ReviewProductCard
          key={product.asin}
          rank={product.rank}
          asin={product.asin}
          title={product.title}
          description={product.description}
          imageUrl={product.image_url}
          wwlPoints={product.wwl_points}
          affiliateUrl={product.affiliateUrl}
        />
      ))}
    </div>
  );
}
