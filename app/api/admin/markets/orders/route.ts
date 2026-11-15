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
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('Bad request'); }

  const market = String(body.market ?? '').toUpperCase();
  const kind = String(body.kind ?? '');
  const from = Number(body.from_value), to = Number(body.to_value);
  const targetId = body.target_id == null ? null : String(body.target_id);
  if (!/^[A-Z]{2,3}$/.test(market) || !['seasonality', 'budget'].includes(kind) || !isFinite(from) || !isFinite(to) || from === to) {
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

  let targetName: string | null = null;
  if (kind === 'seasonality') {
    const range = num(S.seas_step_range_pts, 25) / 100, cap = 1 + num(S.seas_cap_pts, 60) / 100, floor = 1 + num(S.seas_floor_pts, -50) / 100;
    if (Math.abs(to - from) > range + 1e-9 || to > cap + 1e-9 || to < floor - 1e-9) return bad('Seasonality target outside the limits');
  } else {
    if (!targetId || !/^\d+$/.test(targetId)) return bad('Pick a campaign');
    const { data: c } = await db.from('pulse_campaigns').select('name,budget_shared').eq('customer_id', customerId).eq('campaign_id', targetId).limit(1);
    if (!c?.[0]) return bad('Campaign not found for this market', 409);
    if (c[0].budget_shared) return bad('Shared budget: change it in Google Ads', 409);
    targetName = c[0].name;
    if (to < num(S.budget_min_amount, 1) || to > num(S.budget_max_factor, 3) * from) return bad('Budget target outside the limits');
  }

  // one open order per market + kind + target (stops double clicks)
  let open = db.from('pulse_orders').select('id').eq('market', market).eq('kind', kind).in('status', ['queued', 'running']);
  open = targetId ? open.eq('target_id', targetId) : open.is('target_id', null);
  const { data: busy } = await open.limit(1);
  if (busy?.length) return bad('An order for this is already in progress', 409);

  const { data, error } = await db.from('pulse_orders').insert({
    market, customer_id: customerId, kind, target_id: kind === 'budget' ? targetId : null, target_name: targetName,
    from_value: from, to_value: to, requested_by: 'admin panel',
  }).select('*').single();
  if (error) { console.error('[admin/markets/orders] insert failed:', error.message); return bad('Could not queue the order', 500); }
  return NextResponse.json(data, { status: 201 });
}
