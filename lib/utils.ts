// ============================================
// CONFIGURATION & UTILITIES — thewinner.ae
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-03-19
// Adapted from KSP thewinner.co.il for Amazon UAE
// ============================================

// ============================================
// CONFIGURATION
// ============================================

export const CONFIG = {
  siteName: 'The Winners',
  siteTagline: 'Product Reviews',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://thewinner.ae',
  canonicalUrl: process.env.NEXT_PUBLIC_CANONICAL_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://thewinners.ae',
  amazonTag: 'twnraedirect01-21',
  amazonStoreId: 'thewinner02',
  gtmId: process.env.NEXT_PUBLIC_GTM_ID || 'GTM-MLB7SDHC',

};

// ============================================
// SCORE UTILITIES
// ============================================

// Fixed scores based on rank (same system as KSP)
export function getFixedScore(rank: number): number {
  const scores = [9.9, 9.6, 9.3, 9.1, 8.9, 8.7, 8.5, 8.4, 8.2, 8.0];
  return scores[rank - 1] || 8.0;
}

// Get score label in English
export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 9.5) return { label: 'Exceptional', color: 'text-blue-600' };
  if (score >= 9.0) return { label: 'Excellent', color: 'text-blue-600' };
  if (score >= 8.5) return { label: 'Very Good', color: 'text-blue-500' };
  return { label: 'Good', color: 'text-gray-600' };
}

// Convert 10-point score to 5 stars
export function scoreToStars(score: number): number {
  return Math.round(score / 2);
}

// Rank-based star rating (owner spec 2026-09-05): 1-2 → 5, 3-4 → 4.5, 5-7 → 4,
// 8+ → 3.5. Supports half-stars (ProductCard renders halves).
export function rankToStars(rank: number): number {
  if (rank <= 2) return 5;
  if (rank <= 4) return 4.5;
  if (rank <= 7) return 4;
  return 3.5;
}

// ============================================
// AFFILIATE URL BUILDER
// ============================================

// Resolve the visitor's Amazon marketplace domain + affiliate tag from the
// TrackingProvider session (sessionStorage). Defaults to amazon.ae + the UAE
// direct tag for SSR, pre-GEOS1 sessions, or when storage is unavailable.
// Shared by buildAffiliateUrl (product /dp link) and buildAffiliateSearchUrl
// (ML 3 search fallback) so both always route to the SAME store + tag.
function readSessionTagDomain(): { tag: string; domain: string } {
  let tag = CONFIG.amazonTag;
  let domain = 'amazon.ae';

  if (typeof window !== 'undefined') {
    try {
      const session = sessionStorage.getItem('tw_tracking_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.assigned_tag) tag = parsed.assigned_tag;
        if (parsed.amazon_domain) domain = parsed.amazon_domain;
      }
    } catch {
      // sessionStorage unavailable — use defaults
    }
  }
  return { tag, domain };
}

export function buildAffiliateUrl(
  asin: string,
  _productTitle?: string,
  gclid?: string | null,
  _fbclid?: string | null
): string {
  // Defaults match pre-GEOS1 behavior: amazon.ae + UAE direct tag.
  // Used by (a) the SSR render path (no window), (b) the catch-block fallback,
  // and (c) pre-GEOS1 sessions where amazon_domain wasn't stored.
  //
  // Once the client hydrates AND TrackingProvider's first /api/tag-assign
  // round-trip completes, sessionStorage carries both `assigned_tag` and
  // `amazon_domain`. Subsequent renders pick them up here, so non-Gulf
  // visitors see the right marketplace URL with no DOM rewrite needed.
  const { tag, domain } = readSessionTagDomain();
  return `https://www.${domain}/dp/${asin}?tag=${tag}`;
}

// 2026-09-01 — "4 Stars & Up" rating filter for the search fallback.
// The fallback landing page (below) previously dumped a raw keyword search on
// the visitor's store, showing every result incl. unrated/low-quality junk =
// too many distracting options, hurting conversion vs a curated /dp page. We
// now pin Amazon's "4 Stars & Up" refinement (rh=p_72:<node>) so only well-
// rated products show. NOTE: Amazon exposes ONLY whole-star buckets via URL —
// there is no arbitrary "3.9+" cutoff — so 4-stars-&-up is the tightest quality
// gate available (errs slightly stricter than 3.9, never looser).
// The p_72 node is DIFFERENT per marketplace, so this map is required. Every
// value below was pulled live from each store's real "4 Stars & Up" refinement
// link on 2026-09-01 (all confirmed a-star-medium-4, no guesses). Domains match
// PROGRAMS[].amazonDomain in lib/geo-config.ts. If a domain is ever missing
// here, we fall back to the plain unfiltered search (prior behavior) — safe.
const RATING_NODE_4STAR: Record<string, string> = {
  'amazon.ae': '12407972031',
  'amazon.sa': '16641816031',
  'amazon.com': '1248915011',
  'amazon.ca': '11192170011',
  'amazon.com.au': '2547912051',
  'amazon.sg': '6469122051',
  'amazon.co.jp': '82363051',
  'amazon.com.br': '17833786011',
  'amazon.de': '419117031',
  'amazon.co.uk': '419153031',
  'amazon.it': '490205031',
  'amazon.es': '831280031',
  'amazon.fr': '437873031',
  'amazon.pl': '20875468031',
  'amazon.se': '20692905031',
  'amazon.ie': '94791397031',
  'amazon.com.be': '27921103031',
  'amazon.nl': '4993218031',
};

// ML 3 (2026-07-17) — never-empty geo fallback.
// When a US/UK/JP visitor lands on a keyword their storefront has NO catalog
// for, GeoCatalog keeps the AE product cards (so the page is never empty) but
// flags searchFallback: the /dp/{ae-asin} link would 404 cross-marketplace, so
// each card instead points to an Amazon SEARCH on the visitor's own store —
// a working, relevant, commission-eligible link. Reuses the SAME session
// domain+tag as buildAffiliateUrl, so store and tag always match (Associates-
// compliant). Query is the product's cleaned title (brand + type).
export function buildAffiliateSearchUrl(query: string): string {
  const { tag, domain } = readSessionTagDomain();
  return searchUrlFor(domain, tag, query);
}

// Search URL on an explicit store + tag (shared by the session-based builder above
// and the pinned-market rule below — same format, incl. the 4-star filter).
function searchUrlFor(domain: string, tag: string, query: string): string {
  const k = encodeURIComponent((query || '').trim());
  // 2026-09-01: pin "4 Stars & Up" (rh=p_72:<node>) to cut distracting junk.
  const node = RATING_NODE_4STAR[domain];
  const ratingFilter = node ? `&rh=p_72:${node}` : '';
  return `https://www.${domain}/s?k=${k}&tag=${tag}${ratingFilter}`;
}

// ============================================
// PINNED-MARKET LINKS — BR 1 (2026-09-26, owner rule)
// ============================================
// A /pt page shows the BR catalog (amazon.com.br product IDs) to EVERY visitor, but a
// visitor's session store/tag follow their own country. Owner rule for /pt links:
//   • visitor's store = amazon.com.br (Brazil)  → /dp on amazon.com.br, visitor's own tag
//     (keeps the BR tag-pool rotation / attribution exactly as today)
//   • visitor's store = amazon.es (Portugal/Spain) → SEARCH on amazon.es for the product
//     (BR product IDs often don't exist there; a search never dead-ends), visitor's tag,
//     opened in Portuguese (&language=pt_PT — owner 2026-09-26: Portugal buys on amazon.es)
//   • anyone else → /dp on amazon.com.br with the BR program's default tag
// Used at render time (ProductCard/ProductGallery) AND by TrackingProvider's link
// rewrite, so both always produce the same link. Pages without a pinned market are
// untouched (these helpers are only called when pinMarket is set).
const PIN_DOMAIN: Record<string, string> = { br: 'amazon.com.br' };
const PIN_DEFAULT_TAG: Record<string, string> = { br: 'thewinnerbr-20' }; // = PROGRAMS.br.defaultTag
const PIN_SEARCH_STORES: Record<string, string[]> = { br: ['amazon.es'] };
// Language to open the search store in (verified 2026-09-26 in a browser: amazon.es has an
// official "português - PT" UI; `&language=pt_PT` opens it in Portuguese for a new
// visitor — a visitor who already chose another language on amazon.es keeps theirs).
const PIN_SEARCH_LANGUAGE: Record<string, string> = { 'amazon.es': 'pt_PT' };

export function pinnedAffiliateUrl(
  pinMarket: string,
  asin: string,
  searchQuery: string,
  session: { tag: string; domain: string },
): string {
  const pinDomain = PIN_DOMAIN[pinMarket];
  if (!pinDomain) return `https://www.${session.domain}/dp/${asin}?tag=${session.tag}`; // unknown pin → legacy
  if (session.domain === pinDomain) return `https://www.${pinDomain}/dp/${asin}?tag=${session.tag}`;
  if ((PIN_SEARCH_STORES[pinMarket] || []).includes(session.domain)) {
    const lang = PIN_SEARCH_LANGUAGE[session.domain];
    return searchUrlFor(session.domain, session.tag, searchQuery) + (lang ? `&language=${lang}` : '');
  }
  return `https://www.${pinDomain}/dp/${asin}?tag=${PIN_DEFAULT_TAG[pinMarket]}`;
}

/** Render-time variant: reads the visitor's session store/tag (SSR → defaults). */
export function buildPinnedAffiliateUrl(pinMarket: string, asin: string, searchQuery: string): string {
  return pinnedAffiliateUrl(pinMarket, asin, searchQuery, readSessionTagDomain());
}

// ML 3 (2026-07-17): turn a scraped product title into a clean Amazon SEARCH
// query for the never-empty fallback. A full title ("Beko Turkish Coffee
// Machine, 580W, CookSense2 …, 5 Cups - TKM2341W") is far too specific and
// often returns ZERO hits on another marketplace, so we keep only the part
// before the first comma/pipe (the human product name = brand + type) and cap
// it to a few words. Result: relevant results on the visitor's own store.
export function cleanSearchQuery(title: string): string {
  if (!title) return '';
  const head = title.split(/[,|]/)[0].replace(/\s+/g, ' ').trim();
  return head.split(' ').slice(0, 7).join(' ');
}

// ============================================
// URL UTILITIES
// ============================================

// Convert keyword text to URL slug (always lowercase)
export function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

// Format number with commas (English style)
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// ============================================
// DATE UTILITIES
// ============================================

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Get current year
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Get current month name in English
export function getCurrentMonth(): string {
  return ENGLISH_MONTHS[new Date().getMonth()];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate dynamic sub-headline with current month/year
export function generateSubHeadline(keyword: string): string {
  const month = getCurrentMonth();
  const year = getCurrentYear();
  return `${toTitleCase(keyword)} — Reviews, Recommendations & Updated Buying Guide ${month} ${year}`;
}

// ============================================
// TEXT UTILITIES
// ============================================

// Strip invisible characters that some Amazon product titles carry from scraping.
// Removes zero-width & bidirectional control marks (U+200B/C/D zero-width, U+200E/F
// LRM/RLM, U+FEFF BOM) — pure invisible cruft — and converts non-breaking spaces
// (U+00A0) to a normal space (deleting them would fuse words, e.g. "KV7083 Silver").
// Trims the ends. Pre-existing internal multi-spaces are left as-is to keep the change
// scoped to titles that actually carry a bad char. Applied at the data layer so English
// and Arabic both render clean and the title splitter operates on normalized text.
// (INTL1 Phase 2C, slice 1 — user-approved global cleanup, 2026-05-31.)
export function sanitizeProductTitle(title: string): string {
  if (!title) return title;
  return title
    .replace(/[​‌‍‎‏﻿]/g, '')
    .replace(/ /g, ' ')
    .trim();
}

// Title Case: capitalize first letter of each word
export function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Display-only title case that PRESERVES model/brand tokens (Q10V, JBL, 4K, iPhone).
// Used to render raw keyword_text in the search dropdown — NEVER mutates stored data,
// so it has no effect on DB uniqueness/dedup. (2026-09-05)
export function smartTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map(w => {
      if (!w) return w;
      // keep tokens with a digit, all-caps (len>1), or internal caps (model/brand)
      if (/\d/.test(w) || (w.length > 1 && w === w.toUpperCase()) || /[A-Z]/.test(w.slice(1))) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// ============================================
// BRAND EXTRACTION
// ============================================

// Extract brand name from product title
export function extractBrand(title: string): string {
  if (!title) return '';

  // Amazon titles typically start with brand name
  const firstWord = title.split(/\s+/)[0];

  // Known brands (expandable)
  const knownBrands = [
    'Apple', 'Samsung', 'Sony', 'LG', 'JBL', 'Bose', 'Xiaomi', 'Anker',
    'Dyson', 'Philips', 'Braun', 'Panasonic', 'Nikon', 'Canon', 'Dell',
    'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Logitech', 'Razer',
    'Marshall', 'Harman', 'Bosch', 'Siemens', 'Electrolux', 'Whirlpool',
  ];

  for (const brand of knownBrands) {
    if (title.startsWith(brand) || title.toLowerCase().startsWith(brand.toLowerCase())) {
      return brand;
    }
  }

  // Fallback: first word if it looks like a brand (starts with uppercase, not a generic word)
  const genericWords = ['the', 'a', 'an', 'best', 'new', 'top', 'premium', 'professional', 'portable', 'wireless', 'digital'];
  if (firstWord && !genericWords.includes(firstWord.toLowerCase()) && /^[A-Z]/.test(firstWord)) {
    return firstWord;
  }

  return '';
}

// ============================================
// SEO UTILITIES
// ============================================

// Generate English headline: "10 Best {Keyword} Of {Year}"
export function generateEnglishHeadline(keyword: string, year: number): string {
  return `10 Best ${toTitleCase(keyword)} Of ${year}`;
}

export function generatePageTitle(keyword: string): string {
  return `10 Best ${toTitleCase(keyword)} Of ${getCurrentYear()} | ${CONFIG.siteName}`;
}

export function generatePageDescription(keyword: string): string {
  return `${toTitleCase(keyword)} — Top rated in category! We picked the best models with the most value for your money. Comprehensive and objective comparison.`;
}

export function generateCategoryTitle(category: string): string {
  return `${category} — ${CONFIG.siteName} | Product Comparison`;
}

// ============================================
// TRACKING UTILITIES
// ============================================

/**
 * Initialize tracking — captures gclid/fbclid from URL to localStorage
 * Called by TrackingProvider on every page load
 */
export function initTracking(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);

  const gclid = params.get('gclid');
  const fbclid = params.get('fbclid');

  // Only save if present in URL (don't overwrite with null)
  if (gclid) {
    localStorage.setItem('gclid', gclid);
    localStorage.setItem('gclid_timestamp', Date.now().toString());
  }
  if (fbclid) {
    localStorage.setItem('fbclid', fbclid);
    localStorage.setItem('fbclid_timestamp', Date.now().toString());
  }
}

/**
 * Get tracking params from localStorage
 * Returns null if not found or expired (30 days)
 */
export function getTrackingParams(): { gclid: string | null; fbclid: string | null } {
  if (typeof window === 'undefined') {
    return { gclid: null, fbclid: null };
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let gclid: string | null = localStorage.getItem('gclid');
  const gclidTimestamp = localStorage.getItem('gclid_timestamp');
  if (gclid && gclidTimestamp) {
    if (now - parseInt(gclidTimestamp) > THIRTY_DAYS_MS) {
      localStorage.removeItem('gclid');
      localStorage.removeItem('gclid_timestamp');
      gclid = null;
    }
  }

  let fbclid: string | null = localStorage.getItem('fbclid');
  const fbclidTimestamp = localStorage.getItem('fbclid_timestamp');
  if (fbclid && fbclidTimestamp) {
    if (now - parseInt(fbclidTimestamp) > THIRTY_DAYS_MS) {
      localStorage.removeItem('fbclid');
      localStorage.removeItem('fbclid_timestamp');
      fbclid = null;
    }
  }

  return { gclid, fbclid };
}
