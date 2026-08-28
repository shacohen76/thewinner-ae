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
import { GEO_COOKIE_NAME, GEO_COOKIE_MAX_AGE_SECONDS, resolveCatalogMarket } from '@/lib/geo-config';
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

// ─── Abusive scraper / headless-automation UAs — hard-blocked (2026-08-28) ───
// Added after an overnight bot flood (Aug 27 21:00 → Aug 28 07:00 UTC, ~10K
// "direct" sessions) crawled the entire /best/ catalog from a global scatter of
// non-target countries (BR/IN/AR/MX/PK/VN…, AE only ~160). ~745 of them self-
// identified as "Lightpanda" — a headless browser purpose-built for AI-agent
// scraping — so we 403 it (and other known headless-automation UAs) at the edge
// before any page render or click_log write. NOTE: the bulk of that flood spoofed
// real desktop Chrome/Firefox UAs and can't be caught here — Vercel WAF / Bot
// Management (or the disabled geo-block) is the defense for those.
const BLOCKED_BOT_PATTERNS = [
  'Lightpanda',
  'HeadlessChrome',
  'PhantomJS',
  'python-requests',
  'Scrapy',
  'Go-http-client',
  'node-fetch',
];

function isBlockedBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BLOCKED_BOT_PATTERNS.some(p => userAgent.includes(p));
}

// INTL1 JP Phase 2 (2026-07-06): the non-English locale URL prefixes (['ar','ja'])
// derived from routing so adding a locale needs no edit here. English is the
// default and prefix-less, so its paths never start with one of these.
const LOCALIZED_PREFIXES: string[] = routing.locales.filter((l) => l !== routing.defaultLocale);

// ─── per-geo static /best (2026-08-26, feat/per-geo-static-best) ─────────────
// The market segment (ae|us|uk|ca|ie|au|sg|jp) is INTERNAL — injected by the
// interceptor's rewrite so Next caches one static variant per (locale×market×slug).
// It must never be a public/crawlable URL (duplicate content), so a request that
// arrives WITH one is 308'd back to the canonical market-less path. Group $1 = the
// "/best" (or "/ar/best") prefix, group $2 = the trailing "/" or end.
const BEST_MARKET_LEAK_RE = /^(\/(?:ar\/|ja\/)?best)\/(?:ae|us|uk|ca|ie|au|sg|jp)(\/|$)/;
// A PUBLIC /best request = exactly one segment after "best" (the slug), optional
// locale prefix, not already market-segmented. Group $1 = ar|ja (undefined for en),
// group $2 = slug.
const BEST_PUBLIC_RE = /^\/(?:(ar|ja)\/)?best\/([^/]+)\/?$/;

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = isSearchBot(userAgent);

  // ─── Abusive-scraper hard block (2026-08-28) ─────────────────────────────
  // Runs FIRST so a known headless-automation UA (Lightpanda et al.) is 403'd
  // before any redirect, rewrite, render, or client-side click_log write. Cheap
  // edge short-circuit. The `!isBot` guard makes the ALLOWED search/social/AI
  // crawler list authoritative: a UA on that list is NEVER blocked, even if a
  // blocked substring ever appeared inside it — so Googlebot et al. are safe by
  // construction, not just because today's tokens happen not to overlap.
  if (isBlockedBot(userAgent) && !isBot) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  // ─── 301 the legacy mirror thewinner.ae → canonical thewinners.ae (2026-08-26) ──
  // thewinner.ae is a duplicate mirror that already rel=canonical'd + hreflang'd to
  // thewinners.ae. A 301 is STRONGER than a canonical (Google obeys it) and permanently
  // consolidates all crawl/link signals onto the one canonical domain. Both domains run
  // this same code (separate Vercel projects), so we detect the mirror by Host and
  // permanent-redirect every path (query preserved). Applies to bots too — that's how
  // Google migrates the signals. Runs FIRST so a mirror hit never reaches geo/locale.
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'thewinner.ae' || host === 'www.thewinner.ae') {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.hostname = 'thewinners.ae';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // ─── per-geo static /best: strip a leaked internal market segment (2026-08-26) ──
  // The /best interceptor below rewrites the public /best/<slug> to an INTERNAL
  // /<locale>/best/<market>/<slug>. Internally-rewritten requests never carry the
  // market in request.nextUrl.pathname, so a market segment HERE means the URL was
  // requested directly from the outside (crawler, hand-typed, stale link). 308 it
  // back to the canonical market-less path so the per-market paths never index.
  // Runs before any rewrite so these never resolve a page.
  if (BEST_MARKET_LEAK_RE.test(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.replace(BEST_MARKET_LEAK_RE, '$1$2');
    return NextResponse.redirect(url, 308);
  }

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

  // ─── INTL1 Phase 2C: restrict a localized tree to the curated best-page set ──
  // /admin + /review are English-only with exactly ONE route (no localization,
  // ever) → permanent 308 to the prefix-less English path. /blog IS localization-
  // bound but only in Phase 4 (roadmap §4.9) → temporary 307 until then.
  // Stripping the leading "/<locale>" yields the English (prefix-less) equivalent.
  // English URLs never start with a locale prefix, so they are untouched. The
  // redirect runs BEFORE next-intl so these paths never resolve a localized page.
  // INTL1 JP Phase 2 (2026-07-06): applies to every non-English prefix (ar, ja, …).
  const reqPath = request.nextUrl.pathname;
  const localeSeg = reqPath.split('/')[1];
  if (LOCALIZED_PREFIXES.includes(localeSeg)) {
    const rest = reqPath.slice(localeSeg.length + 1); // strip "/<locale>" → "/admin" | "" | …
    const enOnlyForever =
      rest === '/admin' || rest.startsWith('/admin/') ||
      rest === '/review' || rest.startsWith('/review/');
    const deferred = rest === '/blog' || rest.startsWith('/blog/');
    if (enOnlyForever || deferred) {
      const url = request.nextUrl.clone();
      url.pathname = rest || '/';
      return NextResponse.redirect(url, enOnlyForever ? 308 : 307);
    }
  }

  // ─── per-geo static /best interceptor (2026-08-26, feat/per-geo-static-best) ──
  // Kill the client-side catalog "flicker": instead of SSRing ONE shared AE catalog
  // and swapping the visitor's market in after hydration (retired GeoCatalog), we
  // REWRITE the public /best/<slug> to an INTERNAL /<locale>/best/<market>/<slug>.
  // Next then caches one STATIC ISR variant per (locale × market × slug), so the
  // visitor gets their own catalog in the first byte. The market lives ONLY in the
  // rewrite target — the public URL stays /best/<slug> (canonical); the guard above
  // 308s away any market that leaks into a public URL.
  //
  // We bypass intlMiddleware for these paths and rewrite by hand, adding the
  // /<locale> prefix ourselves (mirroring next-intl's "/"→"/en" rewrite). The
  // [locale] route param + the layout's setRequestLocale(locale) still resolve
  // next-intl messages (these pages are statically rendered, where setRequestLocale
  // — not a middleware header — is the supported locale source). The GEOS1 cookie
  // is attached to THIS response, identical to the normal flow below.
  const bestMatch = request.nextUrl.pathname.match(BEST_PUBLIC_RE);
  if (bestMatch) {
    const locale = LOCALIZED_PREFIXES.includes(bestMatch[1]) ? bestMatch[1] : routing.defaultLocale;
    const slug = bestMatch[2];
    const market = resolveCatalogMarket(country, locale, isBot);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/best/${market}/${slug}`;
    const response = NextResponse.rewrite(url);

    // GEOS1 geo cookie — same policy as the normal flow below.
    const geos1Enabled = process.env.GEOS1_ENABLED === 'true';
    if (geos1Enabled && !isBot && country) {
      response.cookies.set({
        name: GEO_COOKIE_NAME,
        value: country,
        maxAge: GEO_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        httpOnly: false,
      });
    } else if (!geos1Enabled && request.cookies.has(GEO_COOKIE_NAME)) {
      response.cookies.delete(GEO_COOKIE_NAME);
    }

    return response;
  }

  // ─── INTL1 locale routing ────────────────────────────────────────────────
  // Let next-intl build the response (handles the "/" → "/en" rewrite). We
  // then attach the geo cookie to THIS response so both concerns coexist.
  const response = intlMiddleware(request);

  // ─── INTL1 Phase 4: localized subtree NOINDEX, EXCEPT /<locale>/best/* ─────
  // Indexing is now DB-driven (no baked allowlist): a /<locale>/best/<slug> page
  // decides its own robots in generateMetadata — INDEX if the keyword has a
  // translation (noun + BYG) in that locale, else NOINDEX — so translating a page
  // (push to DB) makes it indexable automatically, no deploy. We therefore let
  // /<locale>/best/* through here (no edge header → the page's own robots meta is
  // authoritative) and blanket-noindex the rest of the localized tree (home,
  // category, about, …) which are not indexing targets. English is prefix-less,
  // so its pathname never starts with a locale prefix → English untouched.
  // INTL1 JP Phase 2 (2026-07-06): generalized from ar-only to every non-English prefix.
  const path = request.nextUrl.pathname;
  const seg = path.split('/')[1];
  if (LOCALIZED_PREFIXES.includes(seg)) {
    const isLocalizedBestPage = new RegExp(`^/${seg}/best/[^/]+/?$`).test(path);
    if (!isLocalizedBestPage) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
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
    // 2026-08-25: exclude the `sitemap` PREFIX (not just sitemap.xml) so generateSitemaps'
    // child routes /sitemap/0.xml, /sitemap/1.xml … are NOT rewritten by next-intl (that
    // rewrite → /en/sitemap/0.xml → 404 broke the split sitemap in prod).
    '/((?!api|_next/static|_next/image|favicon|icon|apple-touch|robots.txt|sitemap|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
