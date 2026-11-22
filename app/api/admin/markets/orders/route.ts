// ============================================
// Admin Market Pulse ORDERS — /api/admin/markets/orders  (2026-11-15, phase 2)
// ============================================
// POST: the owner's click + confirm in the Markets tab = the GO for ONE Google Ads change (owner 11-15).
//       This route only QUEUES it (one pulse_orders row). The worker executor re-reads the live value,
//       re-checks every guard, writes Google Ads, reads the value back and closes the row.
// GET:  recent orders (48 h) — the tab polls this while an order is pending, for the feedback line.
// Guards here = shape + the same limits as the executor (pulse_settings rows); the executor is the final check.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminAuthError } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : v == null ? d : Number(v));
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function GET(request: NextRequest) {
  const denied = adminAuthError(request, 'admin/markets/orders');
  if (denied) return denied;
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const { data, error } = await sb().from('pulse_orders').select('*').gte('requested_at', since)
    .order('requested_at', { ascending: false }).limit(50);
  if (error) return bad('Orders read failed', 500);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const denied = adminAuthError(request, 'admin/markets/orders');
  if (denied) return denied;
  // local design preview (env set only in the git-ignored .env.development.local): never queue a real Google Ads change
  if (process.env.PULSE_PREVIEW_READONLY === '1') return bad('Preview mode: orders are off here', 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('Bad request'); }

  const market = String(body.market ?? '').toUpperCase();
  const kind = String(body.kind ?? '');
  const from = Number(body.from_value), to = Number(body.to_value);
  const targetId = body.target_id == null ? null : String(body.target_id);
  const KINDS = ['seasonality', 'budget', 'campaign_target', 'strategy_target', 'strategy_max_cpc'];
  if (!/^[A-Z]{2,3}$/.test(market) || !KINDS.includes(kind) || !isFinite(from) || !isFinite(to) || from === to) {
    return bad('Bad order');
  }

  const db = sb();
  const { data: srows } = await db.from('pulse_settings').select('key,value');
  const S = Object.fromEntries((srows ?? []).map(r => [r.key, r.value]));
  if (S.orders_enabled === false) return bad('Orders are switched off (orders_enabled)', 409);

  // the market's own, non-ignored Google Ads account (newest)
  const { data: acc } = await db.from('pulse_accounts').select('customer_id').eq('market', market).eq('ignored', false)
    .order('last_seen_at', { ascending: false }).limit(1);
  const customerId = acc?.[0]?.customer_id;
  if (!customerId) return bad(`${market} has no own Google Ads account`, 409);

  let targetName: string | null = null, targetType: string | null = null;
  const roasOk = (f: number, t: number) => Math.abs(t - f) <= num(S.troas_step_pts, 50) / 100 + 1e-9 && t >= num(S.troas_min, 0.05) - 1e-9;
  const cpaOk = (f: number, t: number) => Math.abs(t - f) <= num(S.bid_step_pct, 0.5) * f + 1e-9 && t >= num(S.bid_min_amount, 0.01) - 1e-9;
  if (kind === 'seasonality') {
    const range = num(S.seas_step_range_pts, 25) / 100, cap = 1 + num(S.seas_cap_pts, 60) / 100, floor = 1 + num(S.seas_floor_pts, -50) / 100;
    if (Math.abs(to - from) > range + 1e-9 || to > cap + 1e-9 || to < floor - 1e-9) return bad('Seasonality target outside the limits');
    // owner 11-15: Google Ads does not take exactly 0% (×1.000) — use ±0.1% or more
    if (Math.abs(to - 1) < 0.0005) return bad('Exactly 0% is not allowed; use +0.1% / −0.1% or more');
  } else if (kind === 'budget' || kind === 'campaign_target') {
    if (!targetId || !/^\d+$/.test(targetId)) return bad('Pick a campaign');
    const { data: c } = await db.from('pulse_campaigns').select('name,budget_shared,bid_type,strategy_id')
      .eq('customer_id', customerId).eq('campaign_id', targetId).limit(1);
    if (!c?.[0]) return bad('Campaign not found for this market', 409);
    targetName = c[0].name;
    if (kind === 'budget') {
      if (c[0].budget_shared) return bad('Shared budget: change it in Google Ads', 409);
      if (to < num(S.budget_min_amount, 1) || to > num(S.budget_max_factor, 3) * from) return bad('Budget target outside the limits');
    } else {
      if (c[0].strategy_id) return bad('This campaign uses a shared strategy: change the strategy', 409);
      targetType = c[0].bid_type;
      const roas = ['MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS'].includes(targetType ?? ''), cpa = ['MAXIMIZE_CONVERSIONS', 'TARGET_CPA'].includes(targetType ?? '');
      if (!roas && !cpa) return bad('This campaign has no bid target to change', 409);
      if (!(roas ? roasOk(from, to) : cpaOk(from, to))) return bad('Bid target outside the limits');
    }
  } else {
    if (!targetId || !/^\d+$/.test(targetId)) return bad('Pick a strategy');
    const { data: s } = await db.from('pulse_bid_strategies').select('name,strategy_type,target_kind,max_cpc')
      .eq('customer_id', customerId).eq('strategy_id', targetId).limit(1);
    if (!s?.[0]) return bad('Strategy not found for this market', 409);
    targetName = s[0].name; targetType = s[0].strategy_type;
    if (kind === 'strategy_max_cpc') {
      if (s[0].max_cpc == null) return bad('No bid limit on this strategy', 409);
      if (!cpaOk(from, to)) return bad('Max CPC outside the limits');
    } else if (!(s[0].target_kind === 'troas' ? roasOk(from, to) : cpaOk(from, to))) return bad('Strategy target outside the limits');
  }

  // one open order per market + kind + target (stops double clicks)
  let open = db.from('pulse_orders').select('id').eq('market', market).eq('kind', kind).in('status', ['queued', 'running']);
  open = kind !== 'seasonality' && targetId ? open.eq('target_id', targetId) : open.is('target_id', null);
  const { data: busy } = await open.limit(1);
  if (busy?.length) return bad('An order for this is already in progress', 409);

  const { data, error } = await db.from('pulse_orders').insert({
    market, customer_id: customerId, kind, target_id: kind === 'seasonality' ? null : targetId, target_name: targetName, target_type: targetType,
    from_value: from, to_value: to, requested_by: 'admin panel',
  }).select('*').single();
  if (error) { console.error('[admin/markets/orders] insert failed:', error.message); return bad('Could not queue the order', 500); }
  return NextResponse.json(data, { status: 201 });
}
