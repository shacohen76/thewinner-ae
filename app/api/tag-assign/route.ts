// ============================================
// Tag Assignment API — /api/tag-assign
// ============================================
// Created: 2026-03-27
// Last Modified: 2026-05-21 (GEOS1)
// v1.1: Added bot filtering (Vercel bots, crawlers)
// v1.2: GEOS1 — bot/admin short-circuit responses now include amazon_domain
//       + geo_group for uniform client-side handling. Main path passes the
//       fields through automatically via assignTag(). ip_country forwarded
//       to assignTag → server-side geo derivation; client doesn't post geo.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { assignTag } from '@/lib/tracking';

// Bot user agents that should NOT get tracking sessions
const BOT_PATTERNS = [
  'vercel-screenshot', 'HeadlessChrome', 'Googlebot', 'AdsBot', 'Mediapartners-Google',
  'Google-Adwords-DisplayAds', 'pageburst',
  'bingbot', 'Baiduspider', 'YandexBot', 'facebookexternalhit', 'Twitterbot',
  'LinkedInBot', 'Slurp', 'DuckDuckBot', 'Applebot', 'AhrefsBot', 'SemrushBot',
  'MJ12bot', 'Screaming Frog', 'crawler', 'spider', 'bot/', 'Bot/', 'Bot-',
  'PetalBot', 'Bytespider', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot',
];

// Pages that should not create tracking sessions
const EXCLUDED_PAGES = ['/admin'];


function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // no UA = likely bot
  if (BOT_PATTERNS.some(pattern => userAgent.includes(pattern))) return true;
  // Spoofed DESKTOP Chrome/145 bot (GEOS2 2026-05-25). Real current Chrome is
  // 146-148 (~18% clickout rate); Chrome/145 DESKTOP traffic runs ~0.4% CR =
  // bots (Windows SEO-referrer spoof + Mac datacenter, ~1.9k rows). Real
  // Chrome/145 exists ONLY on Android (mobile lags a version; ~14% CR, carries
  // GCLIDs) — so we require NOT-Android to avoid blocking real mobile users.
  if (userAgent.includes('Chrome/145.0.0.0') && !userAgent.includes('Android')) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || null;

    // Skip bots — don't waste tags or pollute click_log.
    // Response shape includes GEOS1 fields (amazon_domain, geo_group) so the
    // client can read them uniformly — defaults to gulf since bots don't
    // need geo routing (they index cached UAE HTML anyway).
    if (isBot(userAgent)) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
        amazon_domain: 'amazon.ae',
        geo_group: 'gulf',
        is_bot: true,
      });
    }

    const body = await request.json();
    const { gclid, fbclid, traffic_source, landing_page, user_id, site } = body;

    // Skip admin pages — don't track our own dashboard visits
    if (landing_page && EXCLUDED_PAGES.some((p: string) => landing_page.startsWith(p))) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
        amazon_domain: 'amazon.ae',
        geo_group: 'gulf',
        is_admin: true,
      });
    }

    if (!traffic_source) {
      return NextResponse.json(
        { error: 'traffic_source is required' },
        { status: 400 }
      );
    }

    // Get country from Vercel geo headers
    const ipCountry = request.headers.get('x-vercel-ip-country') || null;

    const result = await assignTag({
      gclid: gclid || null,
      fbclid: fbclid || null,
      traffic_source,
      landing_page: landing_page || null,
      user_agent: userAgent,
      ip_country: ipCountry,
      user_id: user_id || null,
      site: site || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Tag assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign tag', fallback_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21' },
      { status: 500 }
    );
  }
}
