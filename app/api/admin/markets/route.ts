// ============================================
// Admin Market Pulse API — /api/admin/markets
// ============================================
// Created: 2026-11-15 (Market Pulse panel, step 4); v1.1 (step 5): key in the x-admin-key header.
//
// One read for the admin "Markets" tab: the Postgres function
// `admin_market_pulse(p_market)` (service role only) returns settings, active
// markets (+ their Google Ads account, budget, seasonality), today's hours,
// the normal week, one market's month by day, FX, commission, job status,
// campaigns, recent orders and alerts. Every number is GROUP BY'd in the
// database; no raw rows reach the browser. All tunables (markets, thresholds,
// cadence) are rows in Supabase — this route has no market list of its own.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminAuthError } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  const denied = adminAuthError(request, 'admin/markets');
  if (denied) return denied;

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
