// ============================================
// ReviewProductCard.tsx — Server-rendered product card for /review/* pages
// ============================================
// Created: 2026-05-26
// Purpose: Amazon Associates review verification. Visual clone of
// components/ProductCard.tsx but fully server-rendered with a hardcoded
// affiliate URL passed in by the parent page. NO TrackingProvider
// interaction, NO GTM dataLayer push, NO sessionStorage / click-log beacon
// — so Amazon's reviewer (or their bot) sees the program-specific tag
// directly in the raw HTML source.
//
// Why a separate component instead of modifying ProductCard:
//   - ProductCard is 'use client' and calls buildAffiliateUrl() which
//     defaults to amazon.ae in SSR. Re-using it would either ship the
//     wrong tag in source or require client-side rewriting (the exact
//     thing this whole feature exists to avoid).
//   - Live ProductCard stays untouched → /best/* flow unchanged.
// ============================================

import Image from 'next/image';
import {
  getFixedScore,
  getScoreLabel,
  extractBrand,
} from '@/lib/utils';

interface ReviewProductCardProps {
  rank: number;
  asin: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  wwlPoints?: string[] | null;
  /** Pre-computed Amazon URL with program-specific domain + tag. */
  affiliateUrl: string;
}

function splitTitle(fullTitle: string): { shortTitle: string; restTitle: string | null } {
  const commaIdx = fullTitle.indexOf(',');
  if (commaIdx >= 10) {
    return {
      shortTitle: capitalizeFirst(fullTitle.substring(0, commaIdx).trim()),
      restTitle: fullTitle.substring(commaIdx + 1).trim() || null,
    };
  }
  const spacedBreak = fullTitle.match(/^(.{10,}?)\s+[-–—|]\s+([\s\S]*)/);
  if (spacedBreak) {
    return {
      shortTitle: capitalizeFirst(spacedBreak[1].trim()),
      restTitle: spacedBreak[2].trim() || null,
    };
  }
  return { shortTitle: capitalizeFirst(fullTitle), restTitle: null };
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ReviewProductCard({
  rank,
  asin,
  title,
  description,
  imageUrl,
  wwlPoints,
  affiliateUrl,
}: ReviewProductCardProps) {
  const isWinner = rank === 1;
  const score = getFixedScore(rank);
  const scoreInfo = getScoreLabel(score);
  const { shortTitle, restTitle } = splitTitle(title);
  const brand = extractBrand(title);
  const rankPadded = rank.toString().padStart(2, '0');

  const expandableText = [restTitle, description].filter(Boolean).join('\n\n');

  const displayWwl = (wwlPoints && wwlPoints.length > 0
    ? wwlPoints.slice(0, 4)
    : ['Recommended product in this category']
  ).map(capitalizeFirst);

  const renderScoreBox = (additionalClasses: string = '') => (
    <div className={`bg-gray-50 rounded-xl p-4 text-center ${additionalClasses}`}>
      <div className={`text-4xl font-bold ${scoreInfo.color}`}>{score}</div>
      <div className={`text-sm ${scoreInfo.color} font-medium`}>{scoreInfo.label}</div>
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${isWinner ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: Image + Rank + Winner Badge + Score (mobile) */}
          <div className="flex-shrink-0 lg:w-52">
            {isWinner && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md mb-3 justify-center">
                <span>🏆</span>
                <span>Our Top Pick</span>
              </div>
            )}

            <div className="flex flex-row items-start gap-4 lg:flex-col lg:items-center lg:gap-3">
              <div className="relative flex-grow lg:flex-grow-0">
                <div className="w-full lg:w-44 h-44 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={shortTitle}
                      width={176}
                      height={176}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-6xl">📦</span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-bold text-gray-400 border-2 border-gray-200 shadow">
                  {rankPadded}
                </div>
              </div>
              {renderScoreBox('lg:hidden w-28 flex-shrink-0')}
            </div>
          </div>

          {/* Center: Content */}
          <div className="flex-grow">
            <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{shortTitle}</h3>
            {brand && <div className="text-gray-500 text-sm mb-3">{brand}</div>}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded">
                DISCOUNTED TODAY
              </span>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-gray-800 mb-3">Why We Love It</h4>
              <div className="space-y-2">
                {displayWwl.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {expandableText && (
              <details className="mt-4">
                <summary className="text-blue-600 text-sm font-medium hover:underline cursor-pointer">
                  Show more
                </summary>
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <h5 className="font-bold text-gray-700 mb-2">The Details:</h5>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">{expandableText}</p>
                </div>
              </details>
            )}
          </div>

          {/* Right: Score (desktop) + Amazon + CTA */}
          <div className="flex-shrink-0 flex flex-col justify-between lg:w-36 lg:min-h-[280px]">
            {renderScoreBox('hidden lg:block w-full')}

            <div className="flex flex-col items-center gap-3 mt-4 lg:mt-0">
              <Image
                src="/amazon-badge.png"
                alt="Available at Amazon"
                width={120}
                height={48}
                className="h-10 w-auto object-contain"
              />

              {/* Hardcoded affiliate URL — server-rendered, visible in page source.
                  No onClick, no dataLayer push, no beacon — pure <a>. */}
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg text-center text-sm block"
                data-asin={asin}
              >
                Show Offer
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
