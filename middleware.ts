// ============================================
// Middleware — thewinner.ae
// ============================================
// Created: 2026-03-28
// Updated: 2026-05-21 (GEOS1 — added geo cookie for multi-geo routing)
//
// Two independent concerns, each gated by its own flag:
//
//   1. GEOS1 geo cookie (env var GEOS1_ENABLED)
//      Sets `tw_geo` cookie with the visitor's 2-letter country code so the
//      client TrackingProvider can route Amazon links to the correct regional
//      program (.ae / .de / .com) and swap the footer + back-to-top text.
//      Cookies don't affect Vercel's HTML cache key — the 24h ISR cache on
//      /best/[slug] is preserved.
//      Skipped for: (a) known bot UAs, so Googlebot indexes the cached UAE
//      HTML unchanged; (b) requests with no country header (e.g., local dev).
//      Kill switch: set GEOS1_ENABLED to anything other than 'true' (or unset
//      it) and redeploy → next request reverts to pre-GEOS1 behavior and any
//      stale cookie is cleared.
//
//   2. Geo-blocking (constant GEO_BLOCKING_ENABLED, currently false)
//      Blocks N countries with a 451. Disabled pending Amazon appeal —
//      logic kept intact for easy re-enable.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { GEO_COOKIE_NAME, GEO_COOKIE_MAX_AGE_SECONDS } from '@/lib/geo-config';

// TEMPORARILY DISABLED — geo-blocking is off pending Amazon appeal (2026-03-30).
const GEO_BLOCKING_ENABLED = false;

// Countries to block completely (only used if GEO_BLOCKING_ENABLED=true).
// NOTE: GCC countries are ALLOWED (they buy on amazon.ae):
//   AE, SA, BH, KW, OM, QA. Also ALLOWED: US, UK, EU.
const BLOCKED_COUNTRIES = new Set([
  'IN', 'BD', 'NP', 'PK', 'IR', 'RU', 'CN', 'LK', 'VN', 'BR', 'MU', 'MX', 'ID',
]);

// Search engine / legitimate bot UA patterns. Used by BOTH:
//   - geo-blocking bypass (never block crawlers)
//   - GEOS1 geo-cookie skip (don't influence crawler-rendered indexing)
const ALLOWED_BOT_PATTERNS = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot',
  'DuckDuckBot', 'Applebot', 'facebookexternalhit',
  'Twitterbot', 'LinkedInBot', 'Slurp', 'AhrefsBot',
  'SemrushBot', 'AdsBot-Google', 'Mediapartners-Google',
  'Google-Adwords', 'GPTBot', 'ChatGPT-User', 'ClaudeBot',
  'PerplexityBot', 'PetalBot', 'Bytespider',
];

function isSearchBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return ALLOWED_BOT_PATTERNS.some(p => userAgent.includes(p));
}

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = isSearchBot(userAgent);

  // Default pass-through; we mutate cookies on it or replace it with 451.
  const response = NextResponse.next();

  // ─── GEOS1 geo cookie ───────────────────────────────────────────────────
  const geos1Enabled = process.env.GEOS1_ENABLED === 'true';

  if (geos1Enabled && !isBot && country) {
    // Set/refresh the geo cookie. Re-issued on every request — cheap, and
    // guarantees the cookie tracks the visitor's current IP geo (handles
    // VPN flips / traveling users automatically within one navigation).
    response.cookies.set({
      name: GEO_COOKIE_NAME,
      value: country,
      maxAge: GEO_COOKIE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:', // false only on local http dev
      httpOnly: false, // client TrackingProvider needs to read this
    });
  } else if (!geos1Enabled && request.cookies.has(GEO_COOKIE_NAME)) {
    // Kill-switch hygiene: if GEOS1 was enabled and is now disabled, clear
    // any stale geo cookie so consumer code reverts to default (Gulf) behavior.
    response.cookies.delete(GEO_COOKIE_NAME);
  }

  // ─── Geo-blocking (legacy, disabled) ────────────────────────────────────
  if (!GEO_BLOCKING_ENABLED) {
    return response;
  }
  if (isBot) {
    return response; // bots bypass geo-block
  }
  if (BLOCKED_COUNTRIES.has(country)) {
    return new NextResponse(
      'This website is not available in your region.',
      {
        status: 451, // Unavailable For Legal Reasons (commonly used for geo-blocks)
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
          'X-Blocked-Country': country,
        },
      }
    );
  }

  return response;
}

// Apply to all routes except static assets and Next.js internals.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|icon|apple-touch|robots.txt|sitemap.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
