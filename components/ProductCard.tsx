'use client';
// ============================================
// ProductCard.tsx — Product comparison card
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-03-20
// v1.1: Title split at comma, capitalize WWL, default discount text,
//       Amazon logo SVG with smile, nicer button shape like KSP
// ============================================

declare global {
  interface Window {
    dataLayer: any[];
  }
}

import Image from 'next/image';
import { useState, useMemo } from 'react';
import {
  getFixedScore,
  getScoreLabel,
  scoreToStars,
  buildAffiliateUrl,
  extractBrand,
  formatNumber,
  getTrackingParams
} from '@/lib/utils';

interface ProductCardProps {
  rank: number;
  asin: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  wwlPoints?: string[] | null;
  isPrime?: boolean;
  reviewCount?: number;
}

// Split title at first comma, dash, or pipe — short title + rest for "Show more"
function splitTitle(fullTitle: string): { shortTitle: string; restTitle: string | null } {
  const breakMatch = fullTitle.match(/^([^,|\-–—]+)[,|\-–—]\s*(.*)/s);
  if (breakMatch && breakMatch[1].trim().length >= 10) {
    return {
      shortTitle: capitalizeFirst(breakMatch[1].trim()),
      restTitle: breakMatch[2].trim() || null,
    };
  }
  return { shortTitle: capitalizeFirst(fullTitle), restTitle: null };
}

// Capitalize first letter of a string
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ProductCard({
  rank,
  asin,
  title,
  description,
  imageUrl,
  wwlPoints,
  isPrime = false,
  reviewCount = 0,
}: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isWinner = rank === 1;
  const score = getFixedScore(rank);
  const scoreInfo = getScoreLabel(score);
  const { shortTitle, restTitle } = splitTitle(title);
  const brand = extractBrand(title);
  const stars = scoreToStars(score);
  const rankPadded = rank.toString().padStart(2, '0');
  const interestedCount = useMemo(() => Math.floor(Math.random() * 9) + 1, []);

  // Combine restTitle and description for the expandable section
  const expandableText = [restTitle, description].filter(Boolean).join('\n\n');

  const handleCtaClick = () => {
    const { gclid, fbclid } = getTrackingParams();
    const url = buildAffiliateUrl(asin, title, gclid, fbclid);

    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'affiliate_click',
        product_id: asin,
        product_title: title,
        product_rank: rank,
        product_brand: brand,
      });
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Default WWL points if none provided — capitalize first letter of each
  const displayWwl = (wwlPoints && wwlPoints.length > 0
    ? wwlPoints.slice(0, 4)
    : ['Recommended product in this category']
  ).map(capitalizeFirst);

  // ── Score Box (single source of truth, rendered in 2 responsive slots) ──
  const renderScoreBox = (additionalClasses: string = '') => (
    <div className={`bg-gray-50 rounded-xl p-4 text-center ${additionalClasses}`}>
      <div className={`text-4xl font-bold ${scoreInfo.color}`}>{score}</div>
      <div className={`text-sm ${scoreInfo.color} font-medium`}>{scoreInfo.label}</div>

      {/* Stars */}
      <div className="flex justify-center mt-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= stars ? 'text-amber-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {reviewCount > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          ({formatNumber(reviewCount)} reviews)
        </div>
      )}

      {isWinner && (
        <div className="text-xs text-orange-500 font-medium mt-2">
          🔥 {interestedCount} interested
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${isWinner ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left Side: Image + Rank + Winner Badge + Score (mobile) */}
          <div className="flex-shrink-0 lg:w-52">
            {isWinner && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md mb-3 justify-center">
                <span>🏆</span>
                <span>Our Top Pick</span>
              </div>
            )}

            {/* Mobile: Image + Score side by side | Desktop: Image only */}
            <div className="flex flex-row items-start gap-4 lg:flex-col lg:items-center lg:gap-3">

              {/* Product Image */}
              <div className="relative flex-grow lg:flex-grow-0">
                <div className="w-full lg:w-44 h-44 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={shortTitle}
                      width={176}
                      height={176}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80">📦</text></svg>';
                      }}
                    />
                  ) : (
                    <span className="text-6xl">📦</span>
                  )}
                </div>

                {/* Rank Badge */}
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-bold text-gray-400 border-2 border-gray-200 shadow">
                  {rankPadded}
                </div>
              </div>

              {/* Score Box — MOBILE ONLY */}
              {renderScoreBox('lg:hidden w-28 flex-shrink-0')}
            </div>
          </div>

          {/* Center: Content */}
          <div className="flex-grow">
            {/* Short Title & Brand */}
            <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{shortTitle}</h3>
            {brand && <div className="text-gray-500 text-sm mb-3">{brand}</div>}

            {/* Discount & Prime Badges — always default text */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded">
                Extra Discount Today
              </span>
              {isPrime && (
                <span className="border border-blue-500 text-blue-600 text-xs font-medium px-3 py-1 rounded">
                  Prime
                </span>
              )}
            </div>

            {/* WWL Section */}
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

            {/* Expand Button — shows rest of title + description */}
            {expandableText && (
              <>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {expanded ? 'Show less' : 'Show more'}
                  <span>{expanded ? '∧' : '∨'}</span>
                </button>

                {expanded && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <h5 className="font-bold text-gray-700 mb-2">Full Description:</h5>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{expandableText}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Side: Score Box (desktop) + Amazon + CTA */}
          <div className="flex-shrink-0 flex flex-col justify-between lg:w-36 lg:min-h-[280px]">
            {/* Score Box — DESKTOP ONLY */}
            {renderScoreBox('hidden lg:block w-full')}

            {/* Amazon Logo + CTA Button */}
            <div className="flex flex-col items-center gap-3 mt-4 lg:mt-0">
              {/* Amazon Logo — with recognizable smile/arrow */}
              <svg viewBox="0 0 160 50" className="h-8" xmlns="http://www.w3.org/2000/svg">
                <text
                  x="80"
                  y="28"
                  fontFamily="Arial, sans-serif"
                  fontSize="26"
                  fontWeight="bold"
                  fill="#232F3E"
                  textAnchor="middle"
                  letterSpacing="-0.5"
                >
                  Amazon
                </text>
                {/* The smile/arrow underneath */}
                <path
                  d="M38 36 Q80 48 122 36"
                  fill="none"
                  stroke="#FF9900"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Arrow tip */}
                <path
                  d="M116 32 L122 36 L116 39"
                  fill="none"
                  stroke="#FF9900"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* CTA Button — rounded-xl like KSP style */}
              <button
                onClick={handleCtaClick}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg text-center text-sm"
              >
                Show Me The Offer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
