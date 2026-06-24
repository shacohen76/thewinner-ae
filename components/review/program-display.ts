// ============================================
// program-display.ts — Display helpers for /review/* pages
// ============================================
// Created: 2026-05-26
// Centralizes the "AE excluded" rule (AE is the original already-approved
// program — no review page generated) and the country-flag emoji + ISO
// country code per program. Keeps the rest of the review subtree thin.
//
// Why a separate file: imported by both server components (page, headers,
// footers, banners) and the LayoutShell client component. A single source
// of truth means a future new program (e.g., amazon.in → 'in') only needs
// one place updated here + the geo-config PROGRAMS map.
// ============================================

import type { GeoProgram } from '@/lib/geo-config';

/** Programs that get a /review/{program}/{topic} page. Excludes 'ae' —
 *  the original Gulf program, already approved by Amazon. */
export const REVIEW_PROGRAMS: Exclude<GeoProgram, 'ae'>[] = [
  'sa',  // Saudi Arabia (separate program in 'gulf' group, added 2026-05-27)
  'us', 'ca', 'de', 'uk', 'it', 'es', 'fr', 'pl',
  'se', 'ie', 'be', 'nl', 'au', 'sg', 'jp', 'br',
];

/** Topics rendered for every program. Both slugs MUST exist in the
 *  keywords table with products and qa_guide populated. */
export const REVIEW_TOPICS = ['jbl-speakers', 'laptops'] as const;
export type ReviewTopic = typeof REVIEW_TOPICS[number];

/** Human-readable topic label for headlines + cross-links. */
export const TOPIC_LABEL: Record<ReviewTopic, string> = {
  'jbl-speakers': 'JBL Speakers',
  'laptops': 'Laptops',
};

/** Flag emoji per program. Used by CountryBand + Header geo indicator. */
export const PROGRAM_FLAG: Record<Exclude<GeoProgram, 'ae'>, string> = {
  sa: '🇸🇦',
  us: '🇺🇸',
  ca: '🇨🇦',
  de: '🇩🇪',
  uk: '🇬🇧',
  it: '🇮🇹',
  es: '🇪🇸',
  fr: '🇫🇷',
  pl: '🇵🇱',
  se: '🇸🇪',
  ie: '🇮🇪',
  be: '🇧🇪',
  nl: '🇳🇱',
  au: '🇦🇺',
  sg: '🇸🇬',
  jp: '🇯🇵',
  br: '🇧🇷',
};

/** ISO 3166-1 alpha-2 country code per program. Used by JSON-LD
 *  areaServed and by the COUNTRY_NAMES lookup in geo-config. */
export const PROGRAM_COUNTRY_CODE: Record<Exclude<GeoProgram, 'ae'>, string> = {
  sa: 'SA',
  us: 'US',
  ca: 'CA',
  de: 'DE',
  uk: 'GB',
  it: 'IT',
  es: 'ES',
  fr: 'FR',
  pl: 'PL',
  se: 'SE',
  ie: 'IE',
  be: 'BE',
  nl: 'NL',
  au: 'AU',
  sg: 'SG',
  jp: 'JP',
  br: 'BR',
};

/** True if the given string is a valid review program key. */
export function isReviewProgram(s: string): s is Exclude<GeoProgram, 'ae'> {
  return (REVIEW_PROGRAMS as readonly string[]).includes(s);
}

/** True if the given string is a valid review topic slug. */
export function isReviewTopic(s: string): s is ReviewTopic {
  return (REVIEW_TOPICS as readonly string[]).includes(s);
}

/** The "other" topic — used for cross-link banners. */
export function otherTopic(topic: ReviewTopic): ReviewTopic {
  return topic === 'jbl-speakers' ? 'laptops' : 'jbl-speakers';
}
