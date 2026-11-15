// ============================================
// Admin Market Pulse API — /api/admin/markets
// ============================================
// Created: 2026-11-15 (Market Pulse panel, step 4)
//
// One read for the admin "Markets" tab: the Postgres function
// `admin_market_pulse(p_market)` (service role only) returns settings, active
// markets (+ their Google Ads account, budget, seasonality), today's hours,
// the normal week, one market's month by day, FX, commission and job status.
// Every number is GROUP BY'd in the database; no raw rows reach the browser.
// All tunables (markets, thresholds, cadence) are rows in Supabase — this
// route has no market list of its own.
//
// Auth: same as /api/admin/tracking — ADMIN_PASSWORD must be set; no fallback
// (fails closed with 503), constant-time compare.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin/markets] ADMIN_PASSWORD is not set — refusing request');
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 });
  }
  const given = Buffer.from(request.nextUrl.searchParams.get('key') ?? '', 'utf8');
  const expected = Buffer.from(adminPassword, 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional: one market's month-by-day view. Market codes are 2–3 capital letters (pulse_markets check).
  const raw = (request.nextUrl.searchParams.get('market') || '').toUpperCase();
  const market = /^[A-Z]{2,3}$/.test(raw) ? raw : null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.rpc('admin_market_pulse', { p_market: market });
  if (error) {
    console.error('[admin/markets] admin_market_pulse failed:', error.message);
    return NextResponse.json({ error: 'Market pulse read failed' }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
