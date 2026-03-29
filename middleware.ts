// ============================================
// Geo-Blocking Middleware — thewinner.ae
// ============================================
// Created: 2026-03-28
// Blocks traffic from specified countries at the edge level.
// Uses Vercel's x-vercel-ip-country header (automatic, no external service).
// Blocked visitors get a simple text response — no page load, no resources consumed.
// 
// IMPORTANT: Does NOT block search engine crawlers — they come from
// various countries but should always be allowed through for SEO.
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// Countries to block completely
// NOTE: GCC countries are ALLOWED (they buy on amazon.ae):
//   AE (UAE), SA (Saudi), BH (Bahrain), KW (Kuwait), OM (Oman), QA (Qatar)
// Also ALLOWED: US, UK, EU (potential future affiliate programs)
const BLOCKED_COUNTRIES = new Set([
  'IN',  // India
  'BD',  // Bangladesh
  'NP',  // Nepal
  'PK',  // Pakistan
  'IR',  // Iran
  'RU',  // Russia
  'CN',  // China
]);

// Known search engine and legitimate bot user-agent patterns
// These should NEVER be blocked regardless of country
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
  return ALLOWED_BOT_PATTERNS.some(pattern => userAgent.includes(pattern));
}

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  const userAgent = request.headers.get('user-agent') || '';

  // Always allow search engine bots through (regardless of country)
  if (isSearchBot(userAgent)) {
    return NextResponse.next();
  }

  // Block traffic from specified countries
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

  return NextResponse.next();
}

// Apply to all routes except static assets and Next.js internals
export const config = {
  matcher: [
    // Match all routes except static files, images, and Next.js internals
    '/((?!_next/static|_next/image|favicon|icon|apple-touch|robots.txt|sitemap.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
