// ============================================
// GEO CONFIG — GEOS1 multi-geo routing (v2 — 13 programs)
// ============================================
// Created: 2026-05-21
// Updated: 2026-05-22 — expanded from 3 programs to 13 dedicated Amazon
//                       Associates programs. Backward-compatible: existing
//                       GeoGroup type kept (gulf/europe/international) for
//                       dashboard rollups; new GeoProgram type addresses the
//                       specific Amazon storefront per country.
//
// Two-tier model:
//   GeoGroup    — high-level bucket (3 values)         — used by Overview
//   GeoProgram  — specific Amazon Associates program   — used by routing
//
// Each country resolves to ONE program. Each program belongs to ONE group.
// Most countries inherit a group-level catch-all program:
//   - Gulf countries → 'ae'
//   - European countries without dedicated program → 'de' (catch-all)
//   - Everything else → 'us' (catch-all)
//
// Adding a new Amazon program:
//   1. Add program to GeoProgram type below
//   2. Add entry to PROGRAMS map (group, domain, tag)
//   3. Add country code(s) to COUNTRY_PROGRAM map
//   4. Optional: add display strings to COUNTRY_NAMES
//   5. INSERT inventory row in tag_pool
//
// Pure data + helpers — no side effects, no env reads, no DB. Safe to import
// from middleware / server / client.
// ============================================

// ============================================
// TYPES
// ============================================

/** High-level geo bucket — drives Overview KPI strip + 3-card dashboard. */
export type GeoGroup = 'gulf' | 'europe' | 'international';

/** Specific Amazon Associates program — drives the actual link routing. */
export type GeoProgram =
  | 'ae'   // amazon.ae       — Gulf catch-all
  | 'us'   // amazon.com      — International catch-all
  | 'ca'   // amazon.ca       — Canada
  | 'de'   // amazon.de       — Europe catch-all
  | 'uk'   // amazon.co.uk    — United Kingdom
  | 'it'   // amazon.it       — Italy
  | 'es'   // amazon.es       — Spain
  | 'fr'   // amazon.fr       — France
  | 'pl'   // amazon.pl       — Poland
  | 'se'   // amazon.se       — Sweden (note: tag uses 'sw' suffix per Amazon account)
  | 'ie'   // amazon.ie       — Ireland (note: tag uses 'ir' suffix per Amazon account)
  | 'be'   // amazon.com.be   — Belgium (note: tag uses 'bg' suffix per Amazon account)
  | 'nl'   // amazon.nl       — Netherlands
  | 'au'   // amazon.com.au   — Australia
  | 'sg'   // amazon.sg       — Singapore
  | 'br';  // amazon.com.br   — Brazil

/** All Amazon marketplace hostnames we route to. Used in TagAssignResponse,
 *  TrackingProvider, and buildAffiliateUrl. Widened in v2 from 3 to 13. */
export type AmazonDomain =
  | 'amazon.ae'
  | 'amazon.com'
  | 'amazon.ca'
  | 'amazon.de'
  | 'amazon.co.uk'
  | 'amazon.it'
  | 'amazon.es'
  | 'amazon.fr'
  | 'amazon.pl'
  | 'amazon.se'
  | 'amazon.ie'
  | 'amazon.com.be'
  | 'amazon.nl'
  | 'amazon.com.au'
  | 'amazon.sg'
  | 'amazon.com.br';

interface ProgramConfig {
  program: GeoProgram;
  /** Which 3-bucket group this program rolls up under (for dashboard). */
  group: GeoGroup;
  /** Hostname (no protocol, no www) used in affiliate link rewriting. */
  amazonDomain: AmazonDomain;
  /** Default affiliate tracking ID for this program. */
  defaultTag: string;
}

export interface GeoConfig extends ProgramConfig {
  /** Fits into footer: "...comparison site for {countryName}." */
  countryName: string;
  /** Fits into /best/ page: "Back to Top 10 X in {backToTopGeo}". */
  backToTopGeo: string;
}

// ============================================
// COOKIE — name + lifetime
// ============================================
export const GEO_COOKIE_NAME = 'tw_geo';
/** 7 days. Re-resolved every request from x-vercel-ip-country anyway. */
export const GEO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Local-dev fallback when x-vercel-ip-country header is absent. */
export const DEFAULT_COUNTRY = 'AE';

// ============================================
// PROGRAMS — one config per Amazon Associates account
// ============================================
const PROGRAMS: Record<GeoProgram, ProgramConfig> = {
  // Gulf — only program with a rotation pool (handled in lib/tracking.ts).
  // defaultTag is the static fallback for non-gads Gulf traffic; gads
  // visitors get a rotated tag from the pool.
  ae: { program: 'ae', group: 'gulf',          amazonDomain: 'amazon.ae',      defaultTag: 'twnraedirect01-21' },

  // International programs — single static tag each.
  us: { program: 'us', group: 'international', amazonDomain: 'amazon.com',     defaultTag: 'thewinnerusa-20' },
  // 2026-05-27: Canada tag rotated thewinnerca-20 → thewinnerca2-20 after
  // the first store was rejected and a new Amazon Associates Canada store
  // was approved. Old tag is no longer valid — Amazon will not credit
  // commissions to it. Any pre-rotation click_log rows / sessions stay on
  // the old tag for historical record but won't earn.
  ca: { program: 'ca', group: 'international', amazonDomain: 'amazon.ca',      defaultTag: 'thewinnerca2-20' },
  au: { program: 'au', group: 'international', amazonDomain: 'amazon.com.au',  defaultTag: 'thewinnerau-22' },
  sg: { program: 'sg', group: 'international', amazonDomain: 'amazon.sg',      defaultTag: 'thewinnersg-22' },
  br: { program: 'br', group: 'international', amazonDomain: 'amazon.com.br',  defaultTag: 'thewinnerbr-20' },

  // European programs — single static tag each.
  de: { program: 'de', group: 'europe',        amazonDomain: 'amazon.de',      defaultTag: 'thewinnerde-21' },
  uk: { program: 'uk', group: 'europe',        amazonDomain: 'amazon.co.uk',   defaultTag: 'thewinneruk-21' },
  it: { program: 'it', group: 'europe',        amazonDomain: 'amazon.it',      defaultTag: 'thewinnerit-21' },
  es: { program: 'es', group: 'europe',        amazonDomain: 'amazon.es',      defaultTag: 'thewinneres-21' },
  fr: { program: 'fr', group: 'europe',        amazonDomain: 'amazon.fr',      defaultTag: 'thewinnerfr-21' },
  pl: { program: 'pl', group: 'europe',        amazonDomain: 'amazon.pl',      defaultTag: 'thewinnerpl-21' },
  // Sweden tag uses 'sw' suffix (legacy from Amazon store creation) — intentional.
  se: { program: 'se', group: 'europe',        amazonDomain: 'amazon.se',      defaultTag: 'thewinnersw-21' },
  // Ireland ('ir') + Belgium ('bg') tags carry legacy suffixes from Amazon
  // store creation — same pattern as Sweden's 'sw'. Program keys stay ISO
  // ('ie','be'); only the tag string carries the legacy suffix. Added 2026-05-25.
  ie: { program: 'ie', group: 'europe',        amazonDomain: 'amazon.ie',      defaultTag: 'thewinnerir-21' },
  be: { program: 'be', group: 'europe',        amazonDomain: 'amazon.com.be',  defaultTag: 'thewinnerbg-21' },
  nl: { program: 'nl', group: 'europe',        amazonDomain: 'amazon.nl',      defaultTag: 'thewinnernl-21' },
};

// ============================================
// COUNTRY → PROGRAM mapping
// ============================================
// Each country code maps to exactly one program. Countries not listed
// fall back to 'us' (amazon.com catch-all) — handled in getProgram().
const COUNTRY_PROGRAM: Record<string, GeoProgram> = {
  // ── Gulf → ae ───────────────────────────────────────────
  AE: 'ae', SA: 'ae', BH: 'ae', KW: 'ae', OM: 'ae', QA: 'ae',

  // ── Dedicated European programs ─────────────────────────
  GB: 'uk',
  DE: 'de',
  IT: 'it',
  ES: 'es',
  FR: 'fr',
  PL: 'pl',
  SE: 'se',
  IE: 'ie',   // amazon.ie     — dedicated program added 2026-05-25
  BE: 'be',   // amazon.com.be — dedicated program added 2026-05-25
  NL: 'nl',   // amazon.nl     — dedicated program added 2026-05-25

  // ── European neighbours routed to their closest dedicated store ─
  // (Amazon ships these from the mapped store with the best experience:
  //  language / currency / shipping cost / customs — verified per store.)
  PT: 'es',   // Portugal → amazon.es (de-facto PT store: free 2-day + Prime)
  AD: 'es',   // Andorra  → amazon.es
  LU: 'fr',   // Luxembourg → amazon.fr (larger catalog; FR/DE language)
  MC: 'fr',   // Monaco   → amazon.fr

  // ── European catch-all → de (amazon.de ships, EUR pricing) ─
  // NOTE: Nordics (DK/FI/NO) stay here — amazon.se does NOT ship outside
  // Sweden (verified 2026-05-25), so amazon.de is their best option.
  FI: 'de', DK: 'de', NO: 'de', CH: 'de', AT: 'de',
  RO: 'de', GR: 'de', CZ: 'de', HU: 'de', HR: 'de',
  BG: 'de', SK: 'de', SI: 'de', LT: 'de', LV: 'de', EE: 'de',
  MT: 'de', CY: 'de', IS: 'de', TR: 'de', UA: 'de', RS: 'de',
  AL: 'de',   // Albania (Balkans) → amazon.de

  // ── Dedicated International programs ────────────────────
  CA: 'ca',
  AU: 'au',
  SG: 'sg',
  BR: 'br',
  NZ: 'au',   // New Zealand → amazon.com.au (Oceania Global Store)

  // ── Southeast Asia → amazon.sg regional hub ─────────────
  // amazon.sg ships across SEA (faster/cheaper than the amazon.com catch-all).
  MY: 'sg', PH: 'sg', TH: 'sg', ID: 'sg', VN: 'sg', BN: 'sg',

  // All other countries → 'us' (default, see getProgram fallback).
  // Kept on 'us' deliberately: rest of South America (BR store is domestic-
  // only), East Asia (KR/JP/TW/HK — no dedicated program), South Asia,
  // Africa, non-Gulf Middle East, MX — amazon.com Global ships to all.
};

// ============================================
// COUNTRY DISPLAY NAMES (footer + back-to-top swap text)
// ============================================
// Schema unchanged from v1.
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
  AD: { countryName: 'Andorra',              backToTopGeo: 'Andorra' },
  MC: { countryName: 'Monaco',               backToTopGeo: 'Monaco' },
  AL: { countryName: 'Albania',              backToTopGeo: 'Albania' },

  // ── International ──────────────────────────────────────
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
  BN: { countryName: 'Brunei',               backToTopGeo: 'Brunei' },
  PK: { countryName: 'Pakistan',             backToTopGeo: 'Pakistan' },
  BD: { countryName: 'Bangladesh',           backToTopGeo: 'Bangladesh' },
  NG: { countryName: 'Nigeria',              backToTopGeo: 'Nigeria' },
  ZA: { countryName: 'South Africa',         backToTopGeo: 'South Africa' },
  EG: { countryName: 'Egypt',                backToTopGeo: 'Egypt' },
};

const NAME_FALLBACK = { countryName: 'your country', backToTopGeo: 'your region' };

// ============================================
// PUBLIC API
// ============================================

/** Resolve a country code to its Amazon program. Unknown codes default to
 *  'us' (amazon.com catch-all). Case-insensitive, null/empty → 'us'. */
export function getGeoProgram(countryCode: string | null | undefined): GeoProgram {
  const cc = (countryCode || '').toUpperCase();
  return COUNTRY_PROGRAM[cc] || 'us';
}

/** Resolve a country code to its high-level geo group (gulf/europe/international).
 *  Derived from the program. */
export function getGeoGroup(countryCode: string | null | undefined): GeoGroup {
  return PROGRAMS[getGeoProgram(countryCode)].group;
}

/** Full geo config — program + group + domain + tag + display strings.
 *  Always returns a valid config. Unknown countries get 'us' program with
 *  generic 'your country' / 'your region' fallback names. */
export function getGeoConfig(countryCode: string | null | undefined): GeoConfig {
  const cc = (countryCode || '').toUpperCase();
  const programCfg = PROGRAMS[getGeoProgram(cc)];
  const names = COUNTRY_NAMES[cc] || NAME_FALLBACK;
  return {
    ...programCfg,
    countryName: names.countryName,
    backToTopGeo: names.backToTopGeo,
  };
}

/** True if the code has explicit display strings (vs falling back to generic). */
export function isKnownCountry(countryCode: string | null | undefined): boolean {
  const cc = (countryCode || '').toUpperCase();
  return cc in COUNTRY_NAMES;
}

/** Listing helper — used by admin dashboard to enumerate every program for
 *  the By-Program panel. Returns programs in the order: ae, dedicated EU,
 *  de catch-all, dedicated International, us catch-all. */
export const ALL_PROGRAMS: GeoProgram[] = [
  'ae',                                  // Gulf
  'uk', 'it', 'es', 'fr', 'pl', 'se', 'ie', 'be', 'nl',  // dedicated EU
  'de',                                  // EU catch-all
  'ca', 'au', 'sg', 'br',                // dedicated INTL
  'us',                                  // INTL catch-all
];

/** Public read-only view of a program's config. Used by admin dashboard. */
export function getProgramConfig(program: GeoProgram): ProgramConfig {
  return PROGRAMS[program];
}
