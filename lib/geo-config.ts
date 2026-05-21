// ============================================
// GEO CONFIG — GEOS1 multi-geo routing
// ============================================
// Created: 2026-05-21
//
// Single source of truth for geo → Amazon program mapping.
// Routes non-Gulf visitors to the correct Amazon regional program so
// their clicks generate affiliate commissions:
//
//   Gulf countries (GCC)  → amazon.ae  (existing tag logic, unchanged)
//   European countries    → amazon.de  (tag: thewinnerde-21)
//   Everywhere else       → amazon.com (tag: thewinnerusa-20)
//
// This file is PURE DATA + helpers — no side effects, no DB calls,
// no env reads. Safe to import from middleware, server components,
// client components, and API routes.
//
// Imported by:
//   middleware.ts                       (set geo cookie)
//   lib/tracking.ts (assignTag)         (pick tag + domain)
//   app/api/tag-assign/route.ts         (pass-through)
//   components/TrackingProvider.tsx     (rewrite links + text swap)
//   lib/utils.ts (buildAffiliateUrl)    (SSR fallback URL)
//   components/Footer.tsx               (tagline swap)
//   app/best/[slug]/page.tsx            (Back-to-Top swap)
//
// Adding a new country:
//   1. Decide group (gulf/europe/international) by where they realistically
//      buy from. Europe-group = amazon.de ships at reasonable price.
//   2. Add the code to GULF_SET or EUROPE_SET if not international.
//   3. Add display strings to COUNTRY_NAMES (otherwise NAME_FALLBACK is used).
// ============================================

export type GeoGroup = 'gulf' | 'europe' | 'international';

export interface GeoConfig {
  group: GeoGroup;
  /** Amazon marketplace hostname for affiliate links (no protocol, no www). */
  amazonDomain: 'amazon.ae' | 'amazon.de' | 'amazon.com';
  /** Default affiliate tag for static (non-gads) traffic in this geo.
   *  Gulf rotates through the gads pool for gads traffic — this is only
   *  the static-source default for Gulf. Non-Gulf uses this for all sources. */
  defaultTag: string;
  /** Fits into footer: "...comparison site for {countryName}." */
  countryName: string;
  /** Fits into /best/ page: "Back to Top 10 X in {backToTopGeo}". */
  backToTopGeo: string;
}

// ============================================
// COOKIE — name + lifetime
// ============================================
// Middleware writes; TrackingProvider + server components read.
// NOT httpOnly — client TrackingProvider needs to read it for link rewriting.
// SameSite=Lax + Secure are set at the cookie write site (middleware).
export const GEO_COOKIE_NAME = 'tw_geo';
/** 7 days. Re-resolved on every request anyway via x-vercel-ip-country;
 *  cookie is just the client-readable mirror so TrackingProvider can see it
 *  without an extra API round-trip. */
export const GEO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// Local-dev fallback when x-vercel-ip-country header is absent.
// AE keeps local dev behaving like today's production default (Gulf).
export const DEFAULT_COUNTRY = 'AE';

// ============================================
// GROUP DEFAULTS (per Amazon program)
// ============================================
// `defaultTag` here is the STATIC tag for the geo. Gulf gads traffic still
// rotates through the pool via existing assignTag() logic — Gulf's defaultTag
// below is only used as a final fallback inside that flow.
const GROUP_DEFAULTS: Record<GeoGroup, Omit<GeoConfig, 'countryName' | 'backToTopGeo'>> = {
  gulf: {
    group: 'gulf',
    amazonDomain: 'amazon.ae',
    defaultTag: 'twnraedirect01-21', // matches CONFIG.amazonTag fallback
  },
  europe: {
    group: 'europe',
    amazonDomain: 'amazon.de',
    defaultTag: 'thewinnerde-21',
  },
  international: {
    group: 'international',
    amazonDomain: 'amazon.com',
    defaultTag: 'thewinnerusa-20',
  },
};

// ============================================
// GROUP MEMBERSHIP
// ============================================
// Gulf — GCC countries; Amazon.ae ships, paying in AED.
const GULF_SET = new Set<string>([
  'AE', 'SA', 'BH', 'KW', 'OM', 'QA',
]);

// Europe — EU + EEA + UK + near-Europe where amazon.de ships at reasonable
// price. UK currently routed here until a separate amazon.co.uk account opens.
const EUROPE_SET = new Set<string>([
  'DE', 'GB', 'FR', 'NL', 'SE', 'FI', 'DK', 'NO', 'BE', 'CH', 'AT',
  'IT', 'ES', 'PT', 'PL', 'RO', 'GR', 'IE', 'CZ', 'HU', 'HR', 'BG',
  'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'IS', 'TR', 'UA', 'RS',
]);

// Everything else → international (amazon.com).

// ============================================
// COUNTRY DISPLAY NAMES
// ============================================
// `countryName` slots into "...site for {X}." (footer tagline).
// `backToTopGeo` slots into "...Top 10 Y in {X}" (back-to-top anchor).
// Two columns because some phrasings differ — e.g., "site for the UAE" reads
// well in the footer, but "Top 10 X in the UAE" reads less natural than
// "...in United Arab Emirates".
const COUNTRY_NAMES: Record<string, { countryName: string; backToTopGeo: string }> = {
  // ── Gulf ────────────────────────────────────────────────
  AE: { countryName: 'the UAE',              backToTopGeo: 'United Arab Emirates' },
  SA: { countryName: 'Saudi Arabia',         backToTopGeo: 'Saudi Arabia' },
  BH: { countryName: 'Bahrain',              backToTopGeo: 'Bahrain' },
  KW: { countryName: 'Kuwait',               backToTopGeo: 'Kuwait' },
  OM: { countryName: 'Oman',                 backToTopGeo: 'Oman' },
  QA: { countryName: 'Qatar',                backToTopGeo: 'Qatar' },

  // ── Europe ──────────────────────────────────────────────
  DE: { countryName: 'Germany',              backToTopGeo: 'Germany' },
  GB: { countryName: 'the United Kingdom',   backToTopGeo: 'the United Kingdom' },
  FR: { countryName: 'France',               backToTopGeo: 'France' },
  NL: { countryName: 'the Netherlands',      backToTopGeo: 'the Netherlands' },
  SE: { countryName: 'Sweden',               backToTopGeo: 'Sweden' },
  FI: { countryName: 'Finland',              backToTopGeo: 'Finland' },
  DK: { countryName: 'Denmark',              backToTopGeo: 'Denmark' },
  NO: { countryName: 'Norway',               backToTopGeo: 'Norway' },
  BE: { countryName: 'Belgium',              backToTopGeo: 'Belgium' },
  CH: { countryName: 'Switzerland',          backToTopGeo: 'Switzerland' },
  AT: { countryName: 'Austria',              backToTopGeo: 'Austria' },
  IT: { countryName: 'Italy',                backToTopGeo: 'Italy' },
  ES: { countryName: 'Spain',                backToTopGeo: 'Spain' },
  PT: { countryName: 'Portugal',             backToTopGeo: 'Portugal' },
  PL: { countryName: 'Poland',               backToTopGeo: 'Poland' },
  RO: { countryName: 'Romania',              backToTopGeo: 'Romania' },
  GR: { countryName: 'Greece',               backToTopGeo: 'Greece' },
  IE: { countryName: 'Ireland',              backToTopGeo: 'Ireland' },
  CZ: { countryName: 'the Czech Republic',   backToTopGeo: 'the Czech Republic' },
  HU: { countryName: 'Hungary',              backToTopGeo: 'Hungary' },
  HR: { countryName: 'Croatia',              backToTopGeo: 'Croatia' },
  BG: { countryName: 'Bulgaria',             backToTopGeo: 'Bulgaria' },
  SK: { countryName: 'Slovakia',             backToTopGeo: 'Slovakia' },
  SI: { countryName: 'Slovenia',             backToTopGeo: 'Slovenia' },
  LT: { countryName: 'Lithuania',            backToTopGeo: 'Lithuania' },
  LV: { countryName: 'Latvia',               backToTopGeo: 'Latvia' },
  EE: { countryName: 'Estonia',              backToTopGeo: 'Estonia' },
  LU: { countryName: 'Luxembourg',           backToTopGeo: 'Luxembourg' },
  MT: { countryName: 'Malta',                backToTopGeo: 'Malta' },
  CY: { countryName: 'Cyprus',               backToTopGeo: 'Cyprus' },
  IS: { countryName: 'Iceland',              backToTopGeo: 'Iceland' },
  TR: { countryName: 'Turkey',               backToTopGeo: 'Turkey' },
  UA: { countryName: 'Ukraine',              backToTopGeo: 'Ukraine' },
  RS: { countryName: 'Serbia',               backToTopGeo: 'Serbia' },

  // ── International (top traffic + likely-relevant markets) ──
  US: { countryName: 'the United States',    backToTopGeo: 'the United States' },
  CA: { countryName: 'Canada',               backToTopGeo: 'Canada' },
  MX: { countryName: 'Mexico',               backToTopGeo: 'Mexico' },
  BR: { countryName: 'Brazil',               backToTopGeo: 'Brazil' },
  AU: { countryName: 'Australia',            backToTopGeo: 'Australia' },
  NZ: { countryName: 'New Zealand',          backToTopGeo: 'New Zealand' },
  IN: { countryName: 'India',                backToTopGeo: 'India' },
  JP: { countryName: 'Japan',                backToTopGeo: 'Japan' },
  SG: { countryName: 'Singapore',            backToTopGeo: 'Singapore' },
  PH: { countryName: 'the Philippines',      backToTopGeo: 'the Philippines' },
  IL: { countryName: 'Israel',               backToTopGeo: 'Israel' },
  HK: { countryName: 'Hong Kong',            backToTopGeo: 'Hong Kong' },
  TW: { countryName: 'Taiwan',               backToTopGeo: 'Taiwan' },
  KR: { countryName: 'South Korea',          backToTopGeo: 'South Korea' },
  TH: { countryName: 'Thailand',             backToTopGeo: 'Thailand' },
  MY: { countryName: 'Malaysia',             backToTopGeo: 'Malaysia' },
  ID: { countryName: 'Indonesia',            backToTopGeo: 'Indonesia' },
  VN: { countryName: 'Vietnam',              backToTopGeo: 'Vietnam' },
  PK: { countryName: 'Pakistan',             backToTopGeo: 'Pakistan' },
  BD: { countryName: 'Bangladesh',           backToTopGeo: 'Bangladesh' },
  NG: { countryName: 'Nigeria',              backToTopGeo: 'Nigeria' },
  ZA: { countryName: 'South Africa',         backToTopGeo: 'South Africa' },
  EG: { countryName: 'Egypt',                backToTopGeo: 'Egypt' },
};

// Generic fallback for country codes not in COUNTRY_NAMES.
// Group is still resolved correctly via GULF_SET / EUROPE_SET — this only
// affects the display strings.
const NAME_FALLBACK = { countryName: 'your country', backToTopGeo: 'your region' };

// ============================================
// PUBLIC API
// ============================================

/** Resolve a 2-letter country code to a geo group. Case-insensitive,
 *  null/empty defaults to 'international'. */
export function getGeoGroup(countryCode: string | null | undefined): GeoGroup {
  const cc = (countryCode || '').toUpperCase();
  if (GULF_SET.has(cc)) return 'gulf';
  if (EUROPE_SET.has(cc)) return 'europe';
  return 'international';
}

/** Full geo config (group + Amazon domain + tag + display strings).
 *  Always returns a valid config — unknown codes get international defaults
 *  with the generic 'your country'/'your region' fallback names. */
export function getGeoConfig(countryCode: string | null | undefined): GeoConfig {
  const cc = (countryCode || '').toUpperCase();
  const group = getGeoGroup(cc);
  const names = COUNTRY_NAMES[cc] || NAME_FALLBACK;
  return {
    ...GROUP_DEFAULTS[group],
    countryName: names.countryName,
    backToTopGeo: names.backToTopGeo,
  };
}

/** True when the code is a known country in COUNTRY_NAMES (has display strings).
 *  Useful for analytics — distinguishes "we have proper text for them" from
 *  "fell back to generic". */
export function isKnownCountry(countryCode: string | null | undefined): boolean {
  const cc = (countryCode || '').toUpperCase();
  return cc in COUNTRY_NAMES;
}
