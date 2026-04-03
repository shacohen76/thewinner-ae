// ============================================
// Tag Assignment API — /api/tag-assign
// ============================================
// Created: 2026-03-27
// Last Modified: 2026-03-27
// v1.1: Added bot filtering (Vercel bots, crawlers)
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
  return BOT_PATTERNS.some(pattern => userAgent.includes(pattern));
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || null;

    // Skip bots — don't waste tags or pollute click_log
    if (isBot(userAgent)) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
        is_bot: true,
      });
    }

    const body = await request.json();
    const { gclid, fbclid, traffic_source, landing_page } = body;

    // Skip admin pages — don't track our own dashboard visits
    if (landing_page && EXCLUDED_PAGES.some((p: string) => landing_page.startsWith(p))) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
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
