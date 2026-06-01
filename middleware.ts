// ============================================
// Middleware — thewinner.ae
// ============================================
// Created: 2026-03-28
// Updated: 2026-05-21 (GEOS1 — added geo cookie for multi-geo routing)
// Updated: 2026-05-30 (INTL1 Phase 1 — composed next-intl locale routing in)
//
// THREE concerns, run in a deliberate order:
//
//   0. INTL1 locale routing (next-intl)
//      createMiddleware(routing) maps URLs to the [locale] app tree. With
//      localePrefix 'as-needed' + defaultLocale 'en', it REWRITES "/" → "/en"
//      internally (no redirect, no visible prefix), so English URLs are
//      byte-identical. It OWNS the response object — we take the response it
//      returns and then layer the GEOS1 cookie onto it, rather than starting
//      from NextResponse.next(). (A 451 geo-block, if ever enabled, short-
//      circuits BEFORE next-intl so a blocked visitor never reaches a page.)
//
//   1. GEOS1 geo cookie (env var GEOS1_ENABLED)
//      Sets `tw_geo` with the visitor's 2-letter country so the client
//      TrackingProvider routes Amazon links to the right regional program and
//      swaps footer/back-to-top text. Cookies don't affect Vercel's HTML cache
//      key — the 24h ISR cache on /best/[slug] is preserved. Skipped for known
//      bots and for requests with no country header (local dev). Kill switch:
//      set GEOS1_ENABLED to anything but 'true' and redeploy → the next request
//      reverts to pre-GEOS1 behavior and clears any stale cookie.
//
//   2. Geo-blocking (constant GEO_BLOCKING_ENABLED, currently false)
//      Blocks N countries with a 451. Disabled pending Amazon appeal — logic
//      kept intact for easy re-enable.
//
// NOTE on matcher: /api is now EXCLUDED so next-intl never rewrites API routes.
// The geo cookie is still delivered to the browser by page navigations, and the
// browser keeps sending it to /api, so API handlers still see tw_geo.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { GEO_COOKIE_NAME, GEO_COOKIE_MAX_AGE_SECONDS } from '@/lib/geo-config';
import { routing } from '@/i18n/routing';

// next-intl locale router. Produces the (rewritten) response we mutate below.
const intlMiddleware = createMiddleware(routing);

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

  // ─── Geo-blocking (legacy, disabled) — short-circuits before routing ─────
  // A blocked visitor must never reach a rendered page, so this runs first.
  if (GEO_BLOCKING_ENABLED && !isBot && BLOCKED_COUNTRIES.has(country)) {
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

  // ─── INTL1 Phase 2C: restrict the /ar tree to the curated Arabic set ──────
  // /admin + /review are English-only with exactly ONE route (no localization,
  // ever) → permanent 308 to the prefix-less English path. /blog IS Arabic-
  // bound but only in Phase 4 (roadmap §4.9) → temporary 307 until then.
  // Stripping the leading "/ar" yields the English (prefix-less) equivalent.
  // English URLs never start with "/ar", so they are untouched. The redirect
  // runs BEFORE next-intl so these paths never resolve an /ar page.
  const arPath = request.nextUrl.pathname;
  const enOnlyForever =
    arPath === '/ar/admin' || arPath.startsWith('/ar/admin/') ||
    arPath === '/ar/review' || arPath.startsWith('/ar/review/');
  const arDeferred = arPath === '/ar/blog' || arPath.startsWith('/ar/blog/');
  if (enOnlyForever || arDeferred) {
    const url = request.nextUrl.clone();
    url.pathname = arPath.replace(/^\/ar/, '') || '/';
    return NextResponse.redirect(url, enOnlyForever ? 308 : 307);
  }

  // ─── INTL1 locale routing ────────────────────────────────────────────────
  // Let next-intl build the response (handles the "/" → "/en" rewrite). We
  // then attach the geo cookie to THIS response so both concerns coexist.
  const response = intlMiddleware(request);

  // ─── INTL1 Phase 2: Arabic subtree is NOINDEX (private preview) ──────────
  // The whole /ar/* tree is half-built during Phase 2 (English content in an
  // RTL shell until the Arabic data path lands). We keep it OUT of search until
  // Phase 3 flips indexing on deliberately. Setting X-Robots-Tag here — at the
  // edge, on the ORIGINAL request path — is override-proof: it noindexes every
  // /ar page regardless of that page's own metadata (e.g. /review sets
  // robots:index, which would otherwise win). English is prefix-less ("/",
  // "/best/…"), so its pathname NEVER starts with "/ar" → English is untouched.
  const path = request.nextUrl.pathname;
  if (path === '/ar' || path.startsWith('/ar/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

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

  return response;
}

// Apply to all routes except API, static assets and Next.js internals.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon|icon|apple-touch|robots.txt|sitemap.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
