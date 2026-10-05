// ============================================
// Junk DIRECT traffic — "no-track" rule (single source of truth)
// ============================================
// Created: 2026-10-05 (owner: junk visitors must not get a user id; NO blocking;
//          only OBVIOUS junk — "if there's doubt, we leave it").
//
// Data behind it (click_log, Sep-Oct 2026): "direct" = 12,089 sessions/30d with a
// 1.27% clickout rate (gads: 36.7%). The junk is crawlers rendering one /best page
// per fresh session — China (Chrome/99.0.4844.51), a US Linux crawler
// (X11 + Chrome/147.0.0.0, ~5.5K/14d) and SG rotating old Chrome builds. Every
// real desktop buyer runs a current Chrome (150+ in Oct-2026); 0 of ~13K direct
// sessions on Chrome <140 ever clicked out. Real direct buyers are mostly mobile.
//
// What the flag does (nothing here BLOCKS — the page renders normally):
//   - middleware sets the NO_TRACK_COOKIE on the visitor's landing request
//   - layout skips loading GTM/GA4 → no GA4 user is created
//   - TrackingProvider still gets the correct geo tag + Amazon domain for the
//     links, but /api/tag-assign writes NO click_log row and no user_id is minted
//   - if the visitor ever clicks out, the session IS created at that moment
//     (safety net — a real buyer's click is never lost)
//
// The rule is deliberately narrow. A visit is "obvious junk" ONLY if it is
// direct (no referrer), carries no ad/campaign id, and ONE of:
//   1. country is known and is NOT one of our program countries
//   2. desktop Chrome/Edge older than STALE_DESKTOP_CHROME_BELOW (≥1 year stale)
//   3. a known zero-clickout crawler UA (JUNK_CRAWLER_UA_SIGNATURES)
// Mobile visitors in program countries, unknown countries and current browsers
// are always left alone. Search/social/AI crawlers are excluded by the caller.
// ============================================

import { isProgramCountry } from '@/lib/geo-config';

/** Cookie set by middleware when the landing visit is obvious junk. Read by the
 *  layout (GTM skip), TrackingProvider and /api/tag-assign. Session cookie. */
export const NO_TRACK_COOKIE = 'tw_nt';

/** Desktop Chrome majors below this are ≥1 year stale (Chrome 140 = Sep-2025).
 *  Fixed on purpose: as time passes the rule only gets MORE conservative relative
 *  to current Chrome, never less. */
export const STALE_DESKTOP_CHROME_BELOW = 140;

/** Exact crawler UA fragments with thousands of direct sessions and ZERO
 *  clickouts in click_log. Each entry is ANDed (all parts must match). */
export const JUNK_CRAWLER_UA_SIGNATURES: string[][] = [
  // US Linux crawler, first seen 2026-06-18: 8,148 direct sessions, 0 clickouts.
  ['X11; Linux x86_64', 'Chrome/147.0.0.0'],
];

/** URL params that mean the visit came from a campaign/ad → never junk. */
export const CAMPAIGN_PARAMS = [
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_sub',
];

function isMobileUA(ua: string): boolean {
  return /mobile|android|iphone|ipad/i.test(ua);
}

function chromeMajor(ua: string): number | null {
  const m = ua.match(/Chrome\/(\d+)\./);
  return m ? parseInt(m[1], 10) : null;
}

export type JunkReason = 'non_program_country' | 'stale_desktop_chrome' | 'crawler_signature';

/**
 * Decide whether a DIRECT, campaign-less landing visit is obvious junk.
 * Caller is responsible for: direct (no external referrer), no campaign params,
 * not an allowed search/social crawler. Returns the reason, or null = keep tracking.
 */
export function obviousJunkReason(
  country: string | null | undefined,
  userAgent: string | null | undefined,
): JunkReason | null {
  const ua = userAgent || '';
  if (country && !isProgramCountry(country)) return 'non_program_country';
  if (!isMobileUA(ua)) {
    const major = chromeMajor(ua);
    if (major !== null && major < STALE_DESKTOP_CHROME_BELOW) return 'stale_desktop_chrome';
  }
  if (JUNK_CRAWLER_UA_SIGNATURES.some(parts => parts.every(p => ua.includes(p)))) {
    return 'crawler_signature';
  }
  return null;
}
