// ============================================
// Tag Assignment API — /api/tag-assign
// ============================================
// Created: 2026-03-27
// Assigns a tracking tag from the rotation pool to a visitor session.
// Called once per visit from TrackingProvider.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { assignTag } from '@/lib/tracking';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { gclid, fbclid, traffic_source, landing_page } = body;

    if (!traffic_source) {
      return NextResponse.json(
        { error: 'traffic_source is required' },
        { status: 400 }
      );
    }

    // Get country from Vercel geo headers
    const ipCountry = request.headers.get('x-vercel-ip-country') || null;
    const userAgent = request.headers.get('user-agent') || null;

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
      { error: 'Failed to assign tag', fallback_tag: process.env.DEFAULT_TAG || 'thewinner_a-21' },
      { status: 500 }
    );
  }
}
