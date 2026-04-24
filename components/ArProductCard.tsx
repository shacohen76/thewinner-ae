'use client'

import Image from 'next/image'
import { buildAffiliateUrl, extractBrand } from '@/lib/utils'
import { logAsinClickBeacon } from '@/components/TrackingProvider'

declare global {
  interface Window {
    dataLayer: any[];
  }
}

interface ArProductCardProps {
  product: {
    asin: string
    title_ar: string
    title_en: string
    brand: string | null
    image_url: string
    wwl_points_ar: string[]
    rank: number
  }
  rank: number
  ctaText: string
}

// Score labels in Arabic
function getScoreLabel(rank: number): { label: string; color: string } {
  if (rank === 1) return { label: 'استثنائي', color: 'bg-orange-500' }
  if (rank <= 3) return { label: 'ممتاز', color: 'bg-orange-400' }
  if (rank <= 6) return { label: 'جيد جداً', color: 'bg-yellow-500' }
  return { label: 'جيد', color: 'bg-yellow-400' }
}

// Generate fake review count (same approach as English site)
function getReviewCount(asin: string): number {
  let hash = 0
  for (let i = 0; i < asin.length; i++) {
    hash = ((hash << 5) - hash) + asin.charCodeAt(i)
    hash |= 0
  }
  return 500 + Math.abs(hash % 4500)
}

export default function ArProductCard({ product, rank, ctaText }: ArProductCardProps) {
  const score = getScoreLabel(rank)
  const reviewCount = getReviewCount(product.asin)
  const brand = extractBrand(product.title_en || '')
  const baseUrl = buildAffiliateUrl(product.asin, product.title_en)
  const amazonUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'language=ar_AE'

  const handleClick = () => {
    // Push to dataLayer for GTM (same as English ProductCard)
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'affiliate_click',
        product_id: product.asin,
        product_title: product.title_en,
        product_rank: rank,
        product_brand: brand,
      })
    }

    // Log ASIN click for reconciliation (fire-and-forget)
    logAsinClickBeacon(product.asin)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* Rank Badge + Image */}
        <div className="relative flex-shrink-0 p-4 flex items-center justify-center md:w-56">
          {/* Rank number */}
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
            {rank}
          </div>
          
          {/* Product image */}
          <div className="w-40 h-40 relative">
            <Image
              src={product.image_url}
              alt={product.title_ar}
              fill
              className="object-contain"
              sizes="160px"
              unoptimized // Amazon CDN images
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-5 border-t md:border-t-0 md:border-r border-gray-100">
          {/* Score badge */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`${score.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>
              {score.label}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="text-yellow-400">★</span>
              <span>{reviewCount.toLocaleString()} تقييم</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 leading-relaxed line-clamp-2">
            {product.title_ar}
          </h2>

          {/* WWL Points */}
          <div className="space-y-1.5 mb-4">
            {product.wwl_points_ar.map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          {/* Discount badge + CTA */}
          <div className="flex items-center gap-3 mt-auto">
            <span className="bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full border border-red-100">
              خصم اليوم
            </span>
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={handleClick}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              <span>{ctaText}</span>
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>

          {/* Amazon badge */}
          <div className="mt-3 text-xs text-gray-400">
            متوفر على Amazon.ae
          </div>
        </div>
      </div>
    </div>
  )
}
