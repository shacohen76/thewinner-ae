'use client';
// ============================================
// ProductCard.tsx — Product comparison card
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-03-27
// v1.3: CTA changed from button+window.open to <a> tag for reliable tracking
// ============================================

declare global {
  interface Window {
    dataLayer: any[];
  }
}

import Image from 'next/image';
import { useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  getFixedScore,
  getScoreLabel,
  scoreToStars,
  buildAffiliateUrl,
  buildAffiliateSearchUrl,
  cleanSearchQuery,
  extractBrand,
  formatNumber,
  getTrackingParams
} from '@/lib/utils';
import { splitTitle } from '@/lib/title-split';
import { logAsinClickBeacon } from '@/components/TrackingProvider';

interface ProductCardProps {
  rank: number;
  asin: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  wwlPoints?: string[] | null;
  bulletPoints?: string[] | null;   // 2026-08-28: product feature specs (Creators API) → "…for Nerds"
  isPrime?: boolean;
  reviewCount?: number;
  // 2026-08-26 (feat/per-geo-static-best): passed down from the server page (was
  // read from the retired GeoCatalog context). searchFallback → this AE card is
  // shown to a non-AE market lacking the keyword, so link to an Amazon SEARCH on the
  // visitor's store; keywordEn = English query used on localized (ar/ja) pages.
  searchFallback?: boolean;
  keywordEn?: string;
}

// Title splitting (headline + "Show more" tail) now lives in the locale-aware
// @/lib/title-split → splitTitle(title, locale). English output is byte-identical
// to the previous inline rule; Arabic ('ar') uses the validated Arabic splitter.

// Capitalize first letter of a string (English WWL points; no-op on Arabic)
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Map getScoreLabel()'s English label → message key. utils.ts stays the single
// source of the score thresholds; this only routes the label through the locale
// dictionary. Unknown labels fall back to the raw English (never breaks).
const SCORE_LABEL_KEYS: Record<string, string> = {
  Exceptional: 'exceptional',
  Excellent: 'excellent',
  'Very Good': 'veryGood',
  Good: 'good',
};

// Rank-based WWL fallback (2026-08-28) — shown ONLY when a product has no generated
// wwl_points. 3 points per position (rank 1..15). PLACEHOLDER COPY — reword + i18n later
// (owner will finalize wording). Rank >15 or missing falls back to t('defaultWwl').
const FALLBACK_WWL_BY_RANK: Record<number, string[]> = {
  1:  ['Our top pick', 'Loved by buyers', 'Great all-rounder'],
  2:  ['A close runner-up', 'Strong value', 'A shopper favorite'],
  3:  ['A solid choice', 'Nicely balanced', 'Well reviewed'],
  4:  ['Reliable pick', 'Good for the price', 'Consistently rated'],
  5:  ['A dependable option', 'Fair value', 'A safe bet'],
  6:  ['Worth a look', 'Good everyday value', 'Well liked'],
  7:  ['A capable pick', 'Fair price', 'Practical choice'],
  8:  ['Decent option', 'Reasonable value', 'Popular pick'],
  9:  ['Budget-friendly', 'Covers the basics', 'Easy on the wallet'],
  10: ['Honorable mention', 'A handy backup', 'Nice for the price'],
  11: ['A backup pick', 'Does the basics', 'Value-minded'],
  12: ['Still in the running', 'Simple and handy', 'Value pick'],
  13: ['A no-frills option', 'Gets it done', 'Easy pick'],
  14: ['Budget alternative', 'Simple and cheap', 'Price-focused pick'],
  15: ['A value option', 'Keeps it simple', 'Most budget pick'],
};

export default function ProductCard({
  rank,
  asin,
  title,
  description,
  imageUrl,
  wwlPoints,
  bulletPoints,
  isPrime = false,
  reviewCount = 0,
  searchFallback = false,
  keywordEn = '',
}: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const locale = useLocale();
  const t = useTranslations('ProductCard');

  const isWinner = rank === 1;
  const score = getFixedScore(rank);
  const scoreInfo = getScoreLabel(score);
  const scoreLabelKey = SCORE_LABEL_KEYS[scoreInfo.label];
  const scoreLabel = scoreLabelKey ? t(`scoreLabels.${scoreLabelKey}`) : scoreInfo.label;
  const { shortTitle, restTitle } = splitTitle(title, locale);
  const brand = extractBrand(title);
  const stars = scoreToStars(score);
  const rankPadded = rank.toString().padStart(2, '0');
  // 2026-08-26 (SSR restore): deterministic 1-9 seeded by ASIN. Was Math.random(),
  // harmless while the page client-rendered, but now that the page renders
  // server-side the server and client would pick different numbers -> hydration
  // mismatch on the winner card. Seeding by ASIN keeps SSR and client identical.
  const interestedCount = useMemo(() => {
    let h = 0;
    for (let i = 0; i < asin.length; i++) h = (Math.imul(h, 31) + asin.charCodeAt(i)) | 0;
    return (Math.abs(h) % 9) + 1;
  }, [asin]);

  // Combine restTitle and description for the expandable section
  const expandableText = [restTitle, description].filter(Boolean).join('\n\n');
  // 2026-08-28: product feature specs (Creators API) → "The Fun Details - For Nerds"
  const displayBullets = (bulletPoints ?? []).filter(Boolean).slice(0, 3);

  const handleCtaClick = () => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'affiliate_click',
        product_id: asin,
        product_title: title,
        product_rank: rank,
        product_brand: brand,
      });
    }

    // Log ASIN click for reconciliation (fire-and-forget)
    logAsinClickBeacon(asin);
  };

  // Build Amazon URL — TrackingProvider rewrites the tag dynamically.
  // ML 3 (2026-07-17): in the never-empty geo fallback (us/uk/jp visitor on a
  // keyword their store lacks), these AE cards' /dp/{asin} would 404 on the
  // visitor's marketplace. searchFallback → link to an Amazon SEARCH on their
  // store instead (brand + product name), which resolves + earns commission.
  // searchFallback/keywordEn are now props from the server page (2026-08-26,
  // feat/per-geo-static-best; was the retired GeoCatalog React context).
  // English pages search the specific product title; localized pages (ar/ja)
  // search the English keyword instead — the Arabic/Japanese title is a poor
  // query on most stores. (ML 3, 2026-07-17)
  const searchText = locale === 'en' ? cleanSearchQuery(title) : (keywordEn || cleanSearchQuery(title));
  const amazonUrl = searchFallback
    ? buildAffiliateSearchUrl(searchText)
    : buildAffiliateUrl(asin, title);

  // WWL points; when a product has none, fall back to the rank-based placeholder set
  // (3 points for this position), else the single generic default. (2026-08-28)
  const displayWwl = (wwlPoints && wwlPoints.length > 0
    ? wwlPoints.slice(0, 4)
    : (FALLBACK_WWL_BY_RANK[rank] ?? [t('defaultWwl')])
  ).map(capitalizeFirst);

  // ── Score Box (single source of truth, rendered in 2 responsive slots) ──
  const renderScoreBox = (additionalClasses: string = '') => (
    <div className={`bg-gray-50 rounded-xl p-4 text-center ${additionalClasses}`}>
      <div className={`text-4xl font-bold ${scoreInfo.color}`}>{score}</div>
      <div className={`text-sm ${scoreInfo.color} font-medium`}>{scoreLabel}</div>

      {/* Stars — TEMPORARILY HIDDEN (restore: remove 'hidden' class) */}
      <div className="hidden flex justify-center mt-2">
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

      {/* Review count — TEMPORARILY HIDDEN (restore: remove 'hidden' class) */}
      {reviewCount > 0 && (
        <div className="hidden text-xs text-gray-400 mt-1">
          ({formatNumber(reviewCount)} reviews)
        </div>
      )}

      {isWinner && (
        <div className="text-xs text-orange-500 font-medium mt-2">
          {t('interested', { count: interestedCount })}
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
                <span>{t('topPick')}</span>
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
                <div className="absolute -bottom-2 -end-2 w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-bold text-gray-400 border-2 border-gray-200 shadow">
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
                {t('discounted')}
              </span>
              {isPrime && (
                <span className="border border-blue-500 text-blue-600 text-xs font-medium px-3 py-1 rounded">
                  Prime
                </span>
              )}
            </div>

            {/* WWL Section */}
            <div className="mb-4">
              <h4 className="font-bold text-gray-800 mb-3">{t('whyWeLoveIt')}</h4>
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

            {/* Expand Button — shows rest of title + description + "…for Nerds" specs */}
            {(expandableText || displayBullets.length > 0) && (
              <>
                <button
                id="read-more"
                  onClick={() => setExpanded(!expanded)}
                  className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {expanded ? t('showLess') : t('showMore')}
                  <span>{expanded ? '∧' : '∨'}</span>
                </button>

                {expanded && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    {expandableText && (
                      <>
                        <h5 className="font-bold text-gray-700 mb-2">{t('details')}</h5>
                        <p className="text-gray-600 leading-relaxed whitespace-pre-line">{expandableText}</p>
                      </>
                    )}
                    {displayBullets.length > 0 && (
                      <div className={expandableText ? 'mt-4' : ''}>
                        {/* i18n later (owner 2026-08-28) */}
                        <h5 className="font-bold text-gray-700 mb-2">The Fun Details - For Nerds</h5>
                        <ol className="list-decimal pl-5 space-y-1 text-gray-600 leading-relaxed">
                          {displayBullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ol>
                      </div>
                    )}
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
              {/* Official Amazon Badge */}
              <Image
                src="/amazon-badge.png"
                alt="Available at Amazon"
                width={120}
                height={48}
                className="h-10 w-auto object-contain"
              />

              {/* CTA Button — native <a> tag for reliable tracking + no popup blocker */}
              <a
               id="show-offer"
                href={amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCtaClick}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg text-center text-sm block"
              >
                {t('showOffer')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
