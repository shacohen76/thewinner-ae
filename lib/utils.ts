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
  amazonTag: 'twnraedirect01-21',
  amazonStoreId: 'thewinner02',
  gtmId: 'GTM-MLB7SDHC',
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

// ============================================
// AFFILIATE URL BUILDER
// ============================================

export function buildAffiliateUrl(
  asin: string,
  _productTitle?: string,
  gclid?: string | null,
  _fbclid?: string | null
): string {
  // Get rotation tag from session (set by TrackingProvider)
  let tag = CONFIG.amazonTag; // fallback
  if (typeof window !== 'undefined') {
    try {
      const session = sessionStorage.getItem('tw_tracking_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.assigned_tag) {
          tag = parsed.assigned_tag;
        }
      }
    } catch {
      // sessionStorage unavailable — use default
    }
  }

  return `https://www.amazon.ae/dp/${asin}?tag=${tag}`;
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

// Title Case: capitalize first letter of each word
export function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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
