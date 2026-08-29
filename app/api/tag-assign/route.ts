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
import { SPOOFED_BROWSER_BOT_UAS } from '@/lib/bot-signatures';

// Bot user agents that should NOT get tracking sessions.
// Crawler/automation patterns live here; the SPOOFED-browser signatures (junk
// bots that mimic a real Chrome/Firefox UA) are shared with the admin analytics
// reads via lib/bot-signatures.ts so the ingest guard and the panel can never
// drift out of sync — that drift is exactly what let the Aug-2026 wave inflate
// the dashboard (the rollup only knew the old 'Chrome/145' signature).
const BOT_PATTERNS = [
  'vercel-screenshot', 'HeadlessChrome', 'Googlebot', 'AdsBot', 'Mediapartners-Google',
  'Google-Adwords-DisplayAds', 'pageburst',
  'bingbot', 'Baiduspider', 'YandexBot', 'facebookexternalhit', 'Twitterbot',
  'LinkedInBot', 'Slurp', 'DuckDuckBot', 'Applebot', 'AhrefsBot', 'SemrushBot',
  'MJ12bot', 'Screaming Frog', 'crawler', 'spider', 'bot/', 'Bot/', 'Bot-',
  'PetalBot', 'Bytespider', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot',
  // Spoofed-browser junk bots — frozen residential-proxy UA pool. See
  // lib/bot-signatures.ts for the full rationale + how to add signatures.
  ...SPOOFED_BROWSER_BOT_UAS,
];

// Pages that should not create tracking sessions
const EXCLUDED_PAGES = ['/admin'];


function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // no UA = likely bot
  return BOT_PATTERNS.some(pattern => userAgent.includes(pattern));
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

    // Get country + ASN from Vercel geo headers.
    // SG-BOT Phase 0 (2026-05-27): as_name / as_number captured for
    // observability so we can identify the new SG bot wave's hosting infra
    // and write a precise filter from data instead of guesses. NO filtering
    // here. See AMZ_AFF/Docs_MD/SG_BOT_FILTER_ROADMAP.md.
    const ipCountry = request.headers.get('x-vercel-ip-country') || null;
    const asName = request.headers.get('x-vercel-ip-as-name') || null;
    const asNumberRaw = request.headers.get('x-vercel-ip-as-number');
    const asNumber = asNumberRaw ? parseInt(asNumberRaw, 10) : null;

    const result = await assignTag({
      gclid: gclid || null,
      fbclid: fbclid || null,
      traffic_source,
      landing_page: landing_page || null,
      user_agent: userAgent,
      ip_country: ipCountry,
      user_id: user_id || null,
      site: site || null,
      as_name: asName,
      as_number: Number.isFinite(asNumber as number) ? asNumber : null,
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
