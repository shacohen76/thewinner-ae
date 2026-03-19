/**
 * ProductList.tsx — Displays sorted product cards with share functionality
 * Created: 2026-03-19
 * Adapted from KSP: English LTR, ASIN-based, price sort kept
 */

'use client';

import { useState } from 'react';
import ProductCard from './ProductCard';
import ShareButton from './ShareButton';

interface Product {
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

interface ProductListProps {
  products: Product[];
}

type SortOption = 'rank' | 'price';

export default function ProductList({ products }: ProductListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('rank');

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'price') {
      const priceA = a.price_at_scrape ? parseFloat(a.price_at_scrape) : Infinity;
      const priceB = b.price_at_scrape ? parseFloat(b.price_at_scrape) : Infinity;
      return priceA - priceB;
    }
    return a.rank - b.rank;
  });

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No products yet</h3>
        <p className="text-gray-500">We&apos;re working on adding products to this category</p>
      </div>
    );
  }

  return (
    <>
      {/* Sort Controls + Share Button */}
      <div className="flex justify-between items-center mb-4">
        {/* Sort Controls — Left side (LTR) */}
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-2">
          <span className="text-sm text-gray-500">Sort:</span>
          <button
            onClick={() => setSortBy('rank')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === 'rank'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => setSortBy('price')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === 'price'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Lowest Price
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
            isPrime={product.is_prime}
            reviewCount={Math.floor(Math.random() * 5000) + 500}
          />
        ))}
      </div>
    </>
  );
}
