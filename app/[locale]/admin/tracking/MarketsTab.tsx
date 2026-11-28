'use client';
// ============================================
// Admin "Markets" tab — Market Pulse panel v2 (2026-11-15, owner-approved mockup v0.4)
// ============================================
// One readable ROW per market (problems first), sticky filter (region / market chips / hide asleep, saved per
// device), detail opens INLINE under the row, markets without their own Google Ads account show as placeholders
// (they link themselves when an account with the market code in its name appears — no code change).
// Orders (phase 2): seasonality stepper (±1 / ±5 points, live target) and per-campaign budget stepper (nominal,
// account currency). The owner's click + confirm = the GO for that ONE change (owner 11-15); the worker executor
// re-checks the guards, writes Google Ads, reads the value back; this tab shows done / failed with the reason.
// Data: /api/admin/markets (admin_market_pulse RPC, GROUP BY in DB) + /api/admin/markets/orders.
// Everything tunable = Supabase rows (pulse_markets / pulse_settings / pulse_fx). No market list here.
// Clock = each market's Google Ads ACCOUNT time zone (or the row's overrides.time_zone until an account exists).
// ============================================
import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

type Json = Record<string, unknown>;
interface Mkt {
  market: string; label: string; region: string; tz: string; customer_id: string | null; account_name: string | null;
  acct_currency: string | null; budget_today: number | null; budget_date: string | null; seasonality: number | null;
  currency: string | null; comm_rate: number | null; amazon_program: string | null; overrides: Json | null;
}
interface Hour { market: string; local_date: string; local_hour: number; gads_cost: number | null; gads_clicks: number | null;
  gads_conv: number | null; visitors: number | null; clickouts: number | null; amz_items: number | null;
  amz_revenue: number | null; amz_earnings: number | null }
type Day = Omit<Hour, 'market' | 'local_hour'>;
interface Base { market: string; local_hour: number; normal: number | null; normal_cost?: number | null }
interface Camp { customer_id: string; campaign_id: string; market: string; name: string | null; budget_amount: number | null;
  budget_shared: boolean; spend_today: number | null; spend_date: string | null; updated_at: string;
  bid_type: string | null; bid_target: number | null; strategy_id: string | null }
interface Strat { customer_id: string; strategy_id: string; market: string; name: string | null; strategy_type: string | null;
  target_kind: 'troas' | 'tcpa' | null; target_value: number | null; max_cpc: number | null; campaign_count: number | null; updated_at: string }
type OrderKind = 'seasonality' | 'budget' | 'campaign_target' | 'strategy_target' | 'strategy_max_cpc';
interface Order { id: number; market: string; kind: OrderKind; target_id: string | null; target_name: string | null; target_type: string | null;
  from_value: number; to_value: number; status: 'queued' | 'running' | 'done' | 'failed' | 'expired'; requested_at: string;
  done_at: string | null; read_back: number | null; message: string | null }
interface Alert { market: string; rule: string; message: string; sent_at: string }
interface Status { market: string; job_last_run: string | null; job_last_error: string | null; amazon_last_read: string | null;
  // job v1.3: Amazon's own "today" report (by date, all tags of the program), exact
  amz_today_date?: string | null; amz_today_items?: number | null; amz_today_revenue?: number | null; amz_today_read_at?: string | null }
interface Pulse {
  generated_at: string; settings: Json; markets: Mkt[]; unmatched_accounts: { customer_id: string; account_name: string | null }[];
  today: Hour[]; baseline: Base[]; month: Day[]; fx: { currency: string; to_ils: number }[]; comm_actual: { program: string; rate: number | null }[];
  amazon_mtd?: { market: string; items: number | null; revenue: number | null; earnings: number | null; last_new_order: string | null }[];
  status?: Status[]; campaigns?: Camp[]; bid_strategies?: Strat[]; orders?: Order[]; alerts?: Alert[];
  campaign_daily?: CampDay[];   // job v1.4: last 3 days for all markets; the month for ?market=
}
// job v1.4: Google Ads per campaign per account day; conv = the "Clickouts" conversion
interface CampDay { customer_id: string; campaign_id: string; local_date: string; market: string; name: string | null;
  cost: number | null; clicks: number | null; conv: number | null }
// Round 2 (owner 11-21): ONE period switch for the whole tab. Today = live (admin_market_pulse); the rest come from
// admin_market_pulse_range(31) = per market per day for the last 31 account days + yesterday by hour + campaign days.
type Per = 'today' | 'yday' | '3' | '7' | '14' | '30' | 'month';
const PERS: [Per, string][] = [['today', 'Today'], ['yday', 'Yesterday'], ['3', '3 days'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['month', 'Month']];
const PER_LABEL = Object.fromEntries(PERS) as Record<Per, string>;
interface Range { generated_at: string; days_back: number; days: (Day & { market: string })[]; yesterday: Hour[]; campaign_daily: CampDay[] }
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const perFrom = (today: string, per: Per) => per === 'today' ? today : per === 'yday' ? addDays(today, -1)
  : per === 'month' ? today.slice(0, 8) + '01' : addDays(today, 1 - Number(per));
const perTo = (today: string, per: Per) => (per === 'yday' ? addDays(today, -1) : today);
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
// Avg. CPC / cost per clickout / clickout rate (owner 11-15: same as the Google Ads columns)
const ratio = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !b ? null : a / b);
const ROAS_TYPES = ['MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS'], CPA_TYPES = ['MAXIMIZE_CONVERSIONS', 'TARGET_CPA'];
const roasTxt = (v: number | null | undefined) => (v == null ? '—' : Math.round(v * 100) + '%');
const cur2 = (c: string | null | undefined, v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + sym(c).trim() + Math.abs(v).toFixed(2));

const REG: Record<string, { label: string; color: string }> = {
  gulf: { label: 'Gulf', color: '#6ee7b7' }, europe: { label: 'Europe', color: '#93c5fd' },
  americas: { label: 'Americas', color: '#d8b4fe' }, apac: { label: 'Asia-Pacific', color: '#fcd34d' }, other: { label: 'Other', color: '#c3cbe0' },
};
const SYM: Record<string, string> = { ILS: '₪', USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', JPY: '¥', BRL: 'R$', SGD: 'S$' };
const sym = (c: string | null | undefined) => (c ? SYM[c] ?? c + ' ' : '');
const n0 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));
const n1 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1));
const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%');
const money = (c: string | null | undefined, v: number | null | undefined) =>
  v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + sym(c) + n0(Math.abs(v));
const signed = (c: string | null | undefined, v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + money(c, v));
// percent, whole numbers — except the ±0.1% stop around zero (owner 11-15: Google Ads takes no exact 0%;
// the decimal is ONLY for passing 0, everything else is rounded): ×1.001 = "+0.1%", ×1.17 = "+17%"
const sp = (v: number) => {
  const a = Math.abs(v);
  const t = a > 0 && a < 1 ? (Math.round(a * 10) / 10).toFixed(1) : String(Math.round(a));
  return (v < 0 && t !== '0' ? '−' : '+') + t + '%';
};
const pad = (n: number) => String(n).padStart(2, '0');
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : v == null || v === '' ? d : Number(v));
const IL = 'Asia/Jerusalem';
function localNow(tz: string) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '0';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, h: Number(g('hour')) % 24, m: Number(g('minute')) };
}
const ageH = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 3.6e6 : null);
const agoTxt = (h: number | null) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min ago` : `${h.toFixed(1)} h ago`);
const ilTime = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: IL, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—');

type St = 'flowing' | 'stuck' | 'watch' | 'waking' | 'asleep';
const ST_LABEL: Record<St, string> = { flowing: 'Flowing', stuck: 'Stuck', watch: 'Watch quality', waking: 'Waking', asleep: 'Asleep' };
const ST_CLS: Record<St, string> = {
  stuck: 'bg-red-400/15 text-red-400', watch: 'bg-amber-400/15 text-amber-400', flowing: 'bg-emerald-400/15 text-emerald-400',
  waking: 'bg-slate-400/15 text-slate-300', asleep: 'bg-slate-400/15 text-slate-400',
};
const ST_DOT: Record<St, string> = { stuck: '#f87171', watch: '#fbbf24', flowing: '#34d399', waking: '#94a0bd', asleep: '#94a0bd' };

interface HourRow { h: number; vis: number | null; norm: number; outs: number | null; cost: number | null; clicks: number | null;
  conv: number | null; items: number | null; rev: number | null; earn: number | null; now: boolean; fut: boolean; lag: boolean }

function derive(m: Mkt, P: Pulse) {
  const S = (k: string, d: number) => num((m.overrides as Json | null)?.[k] ?? P.settings[k], d);
  const L = localNow(m.tz);
  const byH = new Map(P.today.filter(r => r.market === m.market).map(r => [r.local_hour, r]));
  const bH = new Map(P.baseline.filter(b => b.market === m.market).map(b => [b.local_hour, b]));
  const lagH = S('amazon_lag_h', 3);
  // Earnings: Amazon's today report has none, so ≈ revenue × commission % (pulse_markets.comm_rate row);
  // cells that still carry a real amz_earnings value (older by-tag rows) keep it.
  const comm = m.comm_rate == null ? null : num(m.comm_rate, 0);
  const estEarn = (r: Hour | undefined) => (r?.amz_earnings != null ? num(r.amz_earnings, 0) : comm == null ? 0 : num(r?.amz_revenue, 0) * comm);
  const hours: HourRow[] = Array.from({ length: 24 }, (_, h) => {
    const r = byH.get(h); const fut = h > L.h;
    return { h, fut, now: h === L.h, lag: !fut && h > L.h - lagH, vis: fut ? null : r?.visitors ?? 0, outs: fut ? null : r?.clickouts ?? 0,
      norm: num(bH.get(h)?.normal, 0), cost: fut || !m.customer_id ? null : num(r?.gads_cost, 0), clicks: fut ? null : num(r?.gads_clicks, 0),
      conv: fut ? null : num(r?.gads_conv, 0), items: fut ? null : num(r?.amz_items, 0), rev: fut ? null : num(r?.amz_revenue, 0),
      earn: fut ? null : estEarn(r) };
  });
  const sum = (k: keyof HourRow) => hours.reduce((a, x) => a + (typeof x[k] === 'number' ? (x[k] as number) : 0), 0);
  const hasAcct = !!m.customer_id;
  const spend = hasAcct ? sum('cost') : null;
  const budget = hasAcct && m.budget_date === L.date ? num(m.budget_today, 0) : null;
  const used = budget && spend != null ? spend / budget : null;
  const nc = (h: number) => num(bH.get(h)?.normal_cost, 0);
  const totC = Array.from({ length: 24 }, (_, h) => nc(h)).reduce((a, b) => a + b, 0);
  let by = 0; for (let h = 0; h < L.h; h++) by += nc(h); by += nc(L.h) * L.m / 60;
  const normBy = totC > 0 ? by / totC : null;
  const w = 1 - L.m / 60, prev = hours[L.h - 1];
  const v60 = Math.round((hours[L.h].vis ?? 0) + (prev ? (prev.vis ?? 0) * w : 0));
  const o60 = Math.round((hours[L.h].outs ?? 0) + (prev ? (prev.outs ?? 0) * w : 0));
  const n60 = Math.round((hours[L.h].norm * L.m / 60 + (prev ? prev.norm * w : 0)) * 10) / 10;
  const c60 = v60 ? o60 / v60 : null;
  let st: St = 'flowing';
  if (L.h >= S('night_from', 23) || L.h < S('waking_from', 7)) st = 'asleep';
  else if (L.h < S('judge_from', 9)) st = 'waking';
  else if (n60 >= S('stuck_min_normal', 2) && v60 < S('stuck_ratio', 0.5) * n60) st = 'stuck';
  else if (v60 >= S('watch_min_visitors', 3) && c60 != null && c60 < S('watch_clickout', 0.2)) st = 'watch';
  const fx = (c: string | null) => P.fx.find(f => f.currency === c)?.to_ils ?? null;
  const fxA = fx(m.currency), fxAcc = fx(m.acct_currency ?? 'ILS');
  const toAcct = (v: number | null) => (v == null || fxA == null || fxAcc == null ? null : (v * fxA) / fxAcc);
  const status = P.status?.find(s => s.market === m.market) ?? null;
  const readAge = ageH(status?.amazon_last_read);
  // Round 2 (owner 11-21 "cost and revenue are not aligned by day"): Amazon is paired with the SAME date as the cost.
  // The job writes Amazon's day into that day's cells (a late order goes to Amazon's own day), so the cells of date D
  // = Amazon's total for D. Amazon's own today report is used only when its date IS the account's today.
  // When Amazon is still on the previous day, today shows "not in yet" and that day's pair stays under Yesterday.
  const tday = status?.amz_today_read_at ? { date: status.amz_today_date ?? null, items: num(status.amz_today_items, 0), rev: num(status.amz_today_revenue, 0) } : null;
  const same = !!tday && tday.date === L.date;
  const items = same ? tday!.items : sum('items'), rev = same ? tday!.rev : sum('rev');
  const earn = same ? (comm == null ? 0 : tday!.rev * comm) : sum('earn');
  const amzNotIn = tday?.date && tday.date < L.date ? L.date : null;      // Amazon's report has not reached the account's today yet
  const amzDay = tday?.date && tday.date !== L.date ? tday.date : null;   // Amazon's day ≠ the account's day
  // fresh campaigns only (written by the job's latest pass over this account)
  const cs = (P.campaigns ?? []).filter(c => c.market === m.market && c.customer_id === m.customer_id);
  const newest = cs.reduce((a, c) => Math.max(a, new Date(c.updated_at).getTime()), 0);
  const campaigns = cs.filter(c => newest - new Date(c.updated_at).getTime() < 30 * 60e3);
  const ss = (P.bid_strategies ?? []).filter(s => s.market === m.market && s.customer_id === m.customer_id);
  const newestS = ss.reduce((a, s) => Math.max(a, new Date(s.updated_at).getTime()), 0);
  const strategies = ss.filter(s => newestS - new Date(s.updated_at).getTime() < 90 * 60e3);
  const ahead = S('budget_ahead_pts', 0.2);
  const rank = used != null && used >= 1 ? 0.5 : used != null && normBy != null && used - normBy > ahead ? 2 : { stuck: 0, watch: 1, flowing: 3, waking: 4, asleep: 5 }[st];
  return {
    m, L, hours, hasAcct, spend, budget, used, normBy, ahead, v60, o60, n60, c60, st, fxA, toAcct, rank,
    // today, account day: site (our click log, ad visits only) is the main number; Google Ads' own stats beside it
    clicks: hasAcct ? sum('clicks') : null, conv: hasAcct ? sum('conv') : null,
    cpc: hasAcct ? ratio(spend, sum('clicks')) : null, cpoSite: hasAcct ? ratio(spend, sum('outs')) : null,
    cpoAds: hasAcct ? ratio(spend, sum('conv')) : null, crSite: ratio(sum('outs'), sum('vis')), crAds: hasAcct ? ratio(sum('conv'), sum('clicks')) : null,
    vis: sum('vis'), outs: sum('outs'), items, rev, earn, earnAcct: hasAcct && comm != null ? toAcct(earn) : null,
    earnIls: fxA == null || comm == null ? null : earn * fxA, revIls: fxA == null ? null : rev * fxA, commUnset: comm == null, amzDay, amzNotIn, tday, comm, fxAcc,
    spendIls: spend == null || fxAcc == null ? null : spend * fxAcc, budgetIls: budget == null || fxAcc == null ? null : budget * fxAcc,
    amzNote: typeof (m.overrides as Json | null)?.amazon_note === 'string' ? String((m.overrides as Json).amazon_note) : null,
    net: hasAcct && comm != null && spend != null && toAcct(earn) != null ? (toAcct(earn) as number) - spend : null,
    normT: Math.round(hours.slice(0, L.h).reduce((a, x) => a + x.norm, 0) + hours[L.h].norm * L.m / 60),
    amzStale: readAge == null || readAge > lagH, readAge, lagH, status, campaigns, strategies,
    act: P.comm_actual.find(c => c.program === m.amazon_program)?.rate ?? null,
    mtd: P.amazon_mtd?.find(a => a.market === m.market) ?? null,
    judgeCo: S('watch_clickout', 0.2), stuckRatio: S('stuck_ratio', 0.5), stuckMin: S('stuck_min_normal', 2),
  };
}
type D = ReturnType<typeof derive>;
const barColor = (x: D) => (x.used == null ? '#3b82f6' : x.used >= 1 ? '#f87171' : x.normBy != null && x.used - x.normBy > x.ahead ? '#fbbf24' : '#3b82f6');

function Bar({ x, big }: { x: D; big?: boolean }) {
  if (x.used == null) return null;
  return (
    <div className={`relative rounded-full bg-[#2a3657] ${big ? 'h-3' : 'h-2'}`} role="img" aria-label={`Budget ${pct(x.used)} used, normally ${pct(x.normBy)} by now`}>
      <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(x.used, 1) * 100}%`, background: barColor(x) }} />
      {x.normBy != null && <span className="absolute -top-1 -bottom-1 w-0.5 -ml-px rounded bg-slate-100" style={{ left: `${x.normBy * 100}%` }} />}
    </div>
  );
}
function Pace({ x }: { x: D }) {
  if (!x.n60) return null;
  const max = Math.max(x.v60, x.n60 * 1.6, 1);
  return (
    <div className="relative h-1.5 rounded-full bg-[#2a3657]" aria-hidden>
      <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(x.v60 / max) * 100}%`, background: x.st === 'stuck' ? '#f87171' : '#3b82f6' }} />
      <span className="absolute -top-1 -bottom-1 w-0.5 -ml-px rounded bg-slate-100" style={{ left: `${(x.n60 / max) * 100}%` }} />
    </div>
  );
}
const K = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-semibold uppercase tracking-wide text-[#94a0bd]">{children}</span>;

function why(x: D) {
  if (x.st === 'stuck' && x.used != null && x.used >= 0.9) return <><b>Stuck:</b> {x.v60} visitors in 60 min vs {n1(x.n60)} normal, and <b>{pct(x.used)} of today&apos;s budget is used</b>. The limit looks like the budget.</>;
  if (x.st === 'stuck') return <><b>Stuck:</b> {x.v60} visitors in 60 min vs {n1(x.n60)} normal at this local hour.{x.used != null ? ` Budget ${pct(x.used)} used, so the budget is not the limit.` : ''}</>;
  if (x.st === 'watch') return <><b>Watch quality:</b> visitors at normal pace, only {pct(x.c60)} click out in 60 min.</>;
  if (x.st === 'waking') return <><b>Morning ramp:</b> judged later in the local morning.</>;
  if (x.st === 'asleep') return <><b>Local night:</b> nothing to judge.</>;
  return <><b>Flowing:</b> normal pace for this hour, clickout {pct(x.c60)}. Today so far {n0(x.vis)} visitors vs {n0(x.normT)} normal by now.</>;
}

function Chart({ x }: { x: D }) {
  const W = 720, top = 8, bh = 110, sy = top + bh + 10, sh = 16, L = 30, H = 170;
  const mx = Math.max(1, ...x.hours.map(h => Math.max(h.norm, h.vis ?? 0)));
  const slot = (W - L - 6) / 24, bw = slot * 0.62, Y = (v: number) => top + bh - (v / mx) * bh;
  const step = mx > 10 ? Math.ceil(mx / 3 / 5) * 5 : Math.max(1, Math.ceil(mx / 3));
  const grid: number[] = []; for (let v = step; v <= mx; v += step) grid.push(v);
  return (
    <svg className="block w-full h-auto" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Ad visitors per local hour vs normal, with clickout rate">
      <line x1={L} x2={W - 6} y1={top + bh} y2={top + bh} stroke="#33416a" />
      {grid.map(v => <g key={v}><line x1={L} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="#24304d" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="#94a0bd">{v}</text></g>)}
      {x.hours.map(h => {
        const cx = L + h.h * slot + slot / 2;
        const low = !h.now && h.vis != null && h.norm >= x.stuckMin && h.vis < x.stuckRatio * h.norm;
        const c = h.vis ? (h.outs ?? 0) / h.vis : null;
        const col = c == null ? '#24304d' : c < x.judgeCo ? '#f87171' : c < 0.35 ? '#fbbf24' : '#34d399';
        return (
          <g key={h.h}>
            {h.now && <rect x={L + h.h * slot} y={top} width={slot} height={sy + sh - top} fill="rgba(250,204,21,.08)" />}
            {h.vis != null && <rect x={cx - bw / 2} y={Y(h.vis)} width={bw} height={top + bh - Y(h.vis)} rx="2" fill={low ? '#f87171' : '#3b82f6'} opacity={h.now ? 0.6 : 0.92} />}
            <line x1={cx - slot / 2 + 2} x2={cx + slot / 2 - 2} y1={Y(h.norm)} y2={Y(h.norm)} stroke="#e8edf7" strokeWidth="1.5" strokeDasharray="3 2" />
            <rect x={L + h.h * slot + 1} y={sy} width={slot - 2} height={sh} rx="3" fill={col} opacity={c == null ? 1 : 0.9} />
            {h.h % 3 === 0 && <text x={cx} y={sy + sh + 15} textAnchor="middle" fontSize="12" fill="#c3cbe0">{pad(h.h)}</text>}
          </g>
        );
      })}
      <text x={L - 6} y={sy + 12} textAnchor="end" fontSize="11" fill="#94a0bd">CO</text>
    </svg>
  );
}

// one market's numbers for the chosen period. Today = the live derive(); the rest = range data (account days).
// Board money is in ₪ for every market (owner 11-21 "normalize to ILS"); per-click ratios stay in the account currency.
interface PV { per: Per; from: string; to: string; ready: boolean; spend: number | null; spendIls: number | null; budgetIls: number | null;
  used: number | null; normBy: number | null; vis: number; outs: number; clicks: number | null; conv: number | null; items: number; rev: number;
  earnIls: number | null; netIls: number | null; cpc: number | null; cpoSite: number | null; cpoAds: number | null; crSite: number | null;
  crAds: number | null; notIn: string | null; nDays: number }
type RowSrc = Day & { market: string; local_hour?: number };
function pview(x: D, per: Per, R: Range | null): PV {
  const from = perFrom(x.L.date, per), to = perTo(x.L.date, per);
  const nDays = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  if (per === 'today') return { per, from, to, ready: true, spend: x.spend, spendIls: x.spendIls, budgetIls: x.budgetIls, used: x.used, normBy: x.normBy,
    vis: x.vis, outs: x.outs, clicks: x.clicks, conv: x.conv, items: x.items, rev: x.rev, earnIls: x.earnIls,
    netIls: x.hasAcct && x.earnIls != null && x.spendIls != null ? x.earnIls - x.spendIls : null,
    cpc: x.cpc, cpoSite: x.cpoSite, cpoAds: x.cpoAds, crSite: x.crSite, crAds: x.crAds, notIn: x.amzNotIn, nDays };
  const rows: RowSrc[] = !R ? [] : per === 'yday' ? (R.yesterday as RowSrc[]).filter(r => r.market === x.m.market)
    : R.days.filter(r => r.market === x.m.market && r.local_date >= from && r.local_date <= to);
  const s = (k: keyof Day) => rows.reduce((a, r) => a + num((r as unknown as Json)[k], 0), 0);
  const earn = rows.reduce((a, r) => a + (r.amz_earnings != null ? num(r.amz_earnings, 0) : x.comm == null ? 0 : num(r.amz_revenue, 0) * x.comm), 0);
  const spend = x.hasAcct ? s('gads_cost') : null, clicks = x.hasAcct ? s('gads_clicks') : null, conv = x.hasAcct ? s('gads_conv') : null;
  const vis = s('visitors'), outs = s('clickouts');
  const spendIls = spend == null || x.fxAcc == null ? null : spend * x.fxAcc;
  const earnIls = x.fxA == null || x.comm == null ? null : earn * x.fxA;
  return { per, from, to, ready: !!R, spend, spendIls, budgetIls: null, used: null, normBy: null, vis, outs, clicks, conv,
    items: s('amz_items'), rev: s('amz_revenue'), earnIls, netIls: x.hasAcct && earnIls != null && spendIls != null ? earnIls - spendIls : null,
    cpc: ratio(spend, clicks), cpoSite: ratio(spend, outs), cpoAds: ratio(spend, conv), crSite: ratio(outs, vis), crAds: ratio(conv, clicks),
    notIn: x.tday?.date && x.tday.date < to ? to : null, nDays };
}
const ils = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + '₪' + n0(Math.abs(v)));
const ilsS = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + '₪' + n0(Math.abs(v)));
const netCls = (v: number | null | undefined) => (v == null ? 'text-white' : v >= 0 ? 'text-emerald-400' : 'text-red-400');
const BOARD = 'lg:grid-cols-[minmax(150px,1.25fr)_112px_1.25fr_1.25fr_.85fr_1fr_.7fr_1.15fr_24px]';

// one confirm request. key = the stepper key to reset after a successful queue.
interface Ask { x: D; kind: OrderKind; from: number; to: number; targetId?: string; name?: string; unit: 'pts' | 'money' | 'roas';
  title: string; moves?: string[]; key: string }

export default function MarketsTab({ adminKey }: { adminKey: string }) {
  const [P, setP] = useState<Pulse | null>(null);
  const [R, setR] = useState<Range | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [V, setV] = useState({ reg: 'all', prob: true, sleep: false, only: null as string | null, open: null as string | null, dt: 'today' });
  const [per, setPer] = useState<Per>('today');   // owner 11-21: a reload always opens on Today (not saved)
  const [steps, setSteps] = useState<Record<string, number>>({});     // stepper values: `${market}:${kind}:${id}`
  const [sel, setSel] = useState<Record<string, string | null>>({});  // open campaign (c:<id>) or strategy (s:<id>) per market
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toast, setToast] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout>>();
  const rootRef = useRef<HTMLDivElement>(null), barRef = useRef<HTMLDivElement>(null);
  const hdr = useMemo(() => ({ 'x-admin-key': adminKey }), [adminKey]);

  useEffect(() => { try {
    const s = JSON.parse(localStorage.getItem('mp_view') || '{}');
    setV(v => ({ ...v, ...s, dt: s.dt === 'camps' ? 'camps' : 'today', only: typeof s.only === 'string' ? s.only : null }));
  } catch { /* storage off */ } }, []);
  const saveV = (n: typeof V) => { setV(n); try { localStorage.setItem('mp_view', JSON.stringify(n)); } catch { /* storage off */ } };
  const say = (t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 4000); };

  // the table header sticks right under the sticky filter bar (owner 11-21: header must not scroll away)
  useEffect(() => {
    const b = barRef.current, r = rootRef.current;
    if (!b || !r || typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(() => r.style.setProperty('--mp-top', `${b.offsetHeight}px`));
    o.observe(b); return () => o.disconnect();
  }, [P]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/markets', { headers: hdr, cache: 'no-store' });
      if (!res.ok) { setErr(res.status === 401 ? 'Wrong password' : `Load failed (${res.status})`); setLoading(false); return; }
      const j: Pulse = await res.json();
      setP(j); setErr(''); setOrders(j.orders ?? []);
    } catch { setErr('Load failed'); }
    setLoading(false);
  }, [hdr]);
  const [rErr, setRErr] = useState('');
  const loadR = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/markets?range=31', { headers: hdr, cache: 'no-store' });
      if (!res.ok) { setRErr(`Past days not available yet (${res.status})`); return; }
      setR(await res.json()); setRErr('');
    } catch { setRErr('Past days: load failed'); }
  }, [hdr]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (per !== 'today' && !R) loadR(); }, [per, R, loadR]);
  const refreshSec = P ? Math.max(60, num(P.settings.panel_refresh_sec, 300)) : 300;
  useEffect(() => { const t = setInterval(() => { load(); if (per !== 'today') loadR(); }, refreshSec * 1000); return () => clearInterval(t); }, [load, loadR, refreshSec, per]);

  // while an order is open, poll its status every 4 s (light read), then refresh the panel once
  const pending = orders.some(o => o.status === 'queued' || o.status === 'running');
  useEffect(() => {
    if (!pending) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      try {
        const r = await fetch('/api/admin/markets/orders', { headers: hdr, cache: 'no-store' });
        if (r.ok) {
          const list: Order[] = await r.json();
          setOrders(prev => {
            for (const o of list) {
              const p = prev.find(q => q.id === o.id);
              if (p && (p.status === 'queued' || p.status === 'running') && o.status !== p.status && o.status !== 'running') {
                say(o.status === 'done' ? `✓ ${o.market} — done, read back from Google Ads` : `✗ ${o.market} — not applied: see the orders box`);
                if (o.status === 'done') setTimeout(() => load(), 500);
              }
            }
            return list;
          });
        }
      } catch { /* next tick */ }
      if (n > 60) clearInterval(t);
    }, 4000);
    return () => clearInterval(t);
  }, [pending, hdr, load]);

  const data = useMemo(() => (P ? P.markets.map(m => derive(m, P)) : []), [P]);
  const pvs = useMemo(() => new Map(data.map(x => [x.m.market, pview(x, per, R)])), [data, per, R]);
  if (err && !P) return <p className="text-red-400 text-sm">{err}</p>;
  if (!P) return <p className="text-gray-400 text-sm">Loading markets…</p>;

  const S = (k: string, d: number) => num(P.settings[k], d);
  const inView = (x: D) => (V.only ? x.m.market === V.only : V.reg === 'all' || x.m.region === V.reg);
  const shown = (() => {
    let a = data.filter(x => inView(x) && !(V.sleep && !V.only && x.st === 'asleep'));
    if (V.prob) a = a.slice().sort((p, q) => p.rank - q.rank || (q.spendIls ?? 0) - (p.spendIls ?? 0));
    return a;
  })();
  const lastRun = (P.status ?? []).map(s => s.job_last_run).filter(Boolean).sort().pop() ?? null;
  const errs = (P.status ?? []).filter(s => s.job_last_error);
  const pv = (x: D) => pvs.get(x.m.market) as PV;
  const totSpend = data.reduce((a, x) => a + (pv(x).spendIls ?? 0), 0), totBudget = data.reduce((a, x) => a + (pv(x).budgetIls ?? 0), 0);
  const totEarn = data.reduce((a, x) => a + (pv(x).earnIls ?? 0), 0);
  const stuck = data.filter(x => x.st === 'stuck').map(x => x.m.market), watch = data.filter(x => x.st === 'watch').map(x => x.m.market);
  const bfDays = Math.ceil((new Date('2026-11-27T00:00:00+02:00').getTime() - Date.now()) / 864e5);
  const regions = ['all', ...Object.keys(REG).filter(r => data.some(x => x.m.region === r))];
  const isToday = per === 'today', waitR = !isToday && !R;
  const pl = PER_LABEL[per].toLowerCase();

  async function confirm() {
    if (!ask) return;
    const a = ask; setAsk(null);
    try {
      const r = await fetch('/api/admin/markets/orders', {
        method: 'POST', headers: { ...hdr, 'content-type': 'application/json' },
        body: JSON.stringify({ market: a.x.m.market, kind: a.kind, target_id: a.targetId ?? null, from_value: a.from, to_value: a.to }),
      });
      const j = await r.json();
      if (!r.ok) { say(`✗ ${a.x.m.market}: ${j.error ?? 'not queued'}`); return; }
      setOrders(o => [j as Order, ...o]);
      setSteps(s => ({ ...s, [a.key]: 0 }));
      say(`${a.x.m.market}: sent — waiting for the worker`);
    } catch { say(`✗ ${a.x.m.market}: could not reach the server`); }
  }

  const seg = (on: boolean) => `px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold whitespace-nowrap ${on ? 'bg-blue-500/20 text-white ring-1 ring-blue-500' : 'text-[#c3cbe0]'}`;
  return (
    <div ref={rootRef} className={`${inter.className} flex flex-col gap-3 sm:gap-4 text-[15px] leading-normal text-[#e8edf7] [font-feature-settings:'tnum']`}>
      {/* sticky filter bar */}
      <div ref={barRef} className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2 sm:py-2.5 bg-[#0b1020]/95 backdrop-blur border-b border-[#24304d] flex flex-wrap gap-2 sm:gap-2.5 items-center">
        <div className="flex gap-0.5 bg-[#121a2e] border border-[#33416a] rounded-xl p-1 overflow-x-auto max-w-full" role="group" aria-label="Period">
          {PERS.map(([k, l]) => <button key={k} type="button" aria-pressed={per === k} onClick={() => setPer(k)} className={seg(per === k)}>{l}</button>)}
        </div>
        <div className="flex gap-0.5 bg-[#121a2e] border border-[#33416a] rounded-xl p-1 overflow-x-auto max-w-full" role="group" aria-label="Region">
          {regions.map(r => (
            <button key={r} type="button" aria-pressed={!V.only && V.reg === r} onClick={() => saveV({ ...V, reg: r, only: null })} className={seg(!V.only && V.reg === r)}>
              {r === 'all' ? 'All' : REG[r].label}
            </button>
          ))}
        </div>
        {([['prob', 'Problems first'], ['sleep', 'Hide asleep']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={V[k]} onClick={() => saveV({ ...V, [k]: !V[k] })}
            className={`hidden sm:flex items-center gap-2 text-sm rounded-xl px-3 py-1.5 border ${V[k] ? 'border-blue-500 text-white' : 'border-[#33416a] text-[#c3cbe0]'} bg-[#121a2e]`}>
            <i className={`relative w-[30px] h-[18px] rounded-full ${V[k] ? 'bg-blue-500' : 'bg-[#2a3657]'}`}>
              <i className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${V[k] ? 'left-[14px] bg-white' : 'left-0.5 bg-[#94a0bd]'}`} />
            </i>{l}
          </button>
        ))}
        <span className="ml-auto text-[12px] sm:text-[13px] text-[#94a0bd] whitespace-nowrap">
          Israel <b className="text-[#e8edf7]">{ilTime(new Date().toISOString())}</b> · job <b className={errs.length ? 'text-amber-400' : 'text-[#e8edf7]'}>{agoTxt(ageH(lastRun))}</b>
          {errs.length > 0 && <span className="hidden sm:inline"> · errors {errs.map(e => e.market).join(' ')}</span>}
          <span className="hidden md:inline"> · <b className="text-[#e8edf7]">{bfDays > 0 ? `Black Friday in ${bfDays} days` : 'Black Friday week'}</b></span>
          <button type="button" onClick={() => { load(); if (!isToday) loadR(); }} disabled={loading}
            className="ml-2 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50">{loading ? '…' : 'Refresh'}</button>
        </span>
        <div className="flex gap-1.5 overflow-x-auto basis-full pb-0.5" role="group" aria-label="Show one market">
          {data.map(x => {
            const one = V.only === x.m.market, on = inView(x);
            return (
              <button key={x.m.market} type="button" aria-pressed={one} title={one ? 'Show all again' : `Show only ${x.m.label}`}
                onClick={() => saveV({ ...V, only: one ? null : x.m.market, open: one ? V.open : x.m.market })}
                className={`flex-none flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold border ${one ? 'border-blue-500 bg-blue-500/20 text-white' : on ? 'border-[#c3cbe0] bg-[#1a2440] text-white' : 'border-[#33416a] bg-[#121a2e] text-[#94a0bd]'}`}>
                <b className="w-2 h-2 rounded-full" style={{ background: ST_DOT[x.st] }} />{x.m.market}
              </button>
            );
          })}
        </div>
      </div>

      {rErr && !isToday && <p className="text-[13px] text-amber-400 m-0">{rErr}. Today works as before.</p>}

      {/* KPIs — one row on every screen (owner 11-21) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {[
          [`Spend ${pl}`, ils(totSpend), isToday && totBudget ? `${pct(totSpend / totBudget)} of ${ils(totBudget)} budget` : 'all accounts, in ₪', '', 'Spend'],
          [`Commission ${pl} ≈`, `≈${ils(totEarn)}`, data.some(x => x.commUnset)
            ? `Commission % missing: ${data.filter(x => x.commUnset).map(x => x.m.market).join(' ')} (not counted)`
            : "Amazon's own report, all tags · revenue × comm % × FX", 'text-emerald-400', 'Comm ≈'],
          ['Needs a push', stuck.join(' ') || 'none', 'visitors under half of normal', stuck.length ? 'text-red-400' : '', 'Push'],
          ['Watch quality', watch.join(' ') || 'none', "land but don't click out", watch.length ? 'text-amber-400' : '', 'Quality'],
        ].map(([k, v, s, c, short], i) => (
          <div key={i} className="bg-[#121a2e] border border-[#24304d] rounded-xl sm:rounded-2xl px-2 py-1.5 sm:px-4 sm:py-3.5 flex flex-col gap-0.5 sm:gap-1 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#94a0bd] truncate"><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{k}</span></span>
            <span className={`text-[15px] sm:text-[28px] font-extrabold leading-tight text-white truncate ${c}`}>{waitR && i < 2 ? '…' : v}</span>
            <span className="hidden sm:block text-[13px] text-[#94a0bd]">{s}</span>
          </div>
        ))}
      </div>

      {/* board */}
      <div className="bg-[#121a2e] border border-[#24304d] rounded-2xl" role="list">
        <div className={`hidden lg:grid ${BOARD} gap-3.5 items-center px-4 h-10 bg-[#1a2440] border-b border-[#24304d] rounded-t-2xl`}>
          {['Market', 'Status', `Spend ${pl}`, `Amazon ${pl}`, 'Net ≈', isToday ? 'Visitors 60 min' : 'Visitors', isToday ? 'Clickout' : 'Clickout rate', 'Cost / clickout', ''].map((h, i) => <K key={i}>{h}</K>)}
        </div>
        <div className="lg:hidden grid grid-cols-[minmax(58px,.8fr)_1fr_1fr_1fr] gap-2 px-3 py-1.5 bg-[#1a2440] border-b border-[#24304d] rounded-t-2xl">
          {['Market', 'Spend', 'Comm ≈', 'Net'].map(h => <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-[#94a0bd]">{h}</span>)}
        </div>
        {!shown.length && <div className="px-4 py-5 text-[#94a0bd]">No market matches the filter. Pick a region or tap a market chip above.</div>}
        {shown.map(x => {
          const open = V.open === x.m.market, ac = x.m.acct_currency, p = pv(x);
          const amzWarn = x.amzNote ? x.amzNote : p.notIn ? `Amazon not in yet for ${dm(p.notIn)}` : isToday && x.amzStale ? 'Amazon read old' : null;
          const sub = 'text-[13px] text-[#94a0bd] whitespace-nowrap truncate';
          return (
            <div key={x.m.market} role="listitem" className="border-t border-[#24304d] first:border-t-0">
              <button type="button" aria-expanded={open} onClick={() => saveV({ ...V, open: open ? null : x.m.market })}
                className={`w-full text-left hover:bg-white/[.025] ${open ? 'bg-[#1a2440]' : ''}`}>
                {/* phone: ONE line per market (owner 11-21) */}
                <div className="lg:hidden grid grid-cols-[minmax(58px,.8fr)_1fr_1fr_1fr] gap-2 items-center px-3 py-2">
                  <span className="flex items-center gap-1.5"><b className="w-2 h-2 rounded-full flex-none" style={{ background: ST_DOT[x.st] }} /><span className="text-[16px] font-extrabold text-white">{x.m.market}</span></span>
                  <span className="text-[15px] font-bold text-white whitespace-nowrap">{x.hasAcct ? (waitR ? '…' : ils(p.spendIls)) : '—'}</span>
                  <span className={`text-[15px] font-bold whitespace-nowrap ${x.commUnset || (amzWarn && p.notIn) ? 'text-amber-400' : 'text-emerald-400'}`}>{waitR ? '…' : x.commUnset ? '% missing' : p.earnIls == null ? '—' : '≈' + ils(p.earnIls)}</span>
                  <span className={`text-[15px] font-bold whitespace-nowrap ${netCls(p.netIls)}`}>{waitR ? '…' : ilsS(p.netIls)}</span>
                </div>
                {/* phone, 2nd line (owner 11-28): visitors like the desktop column — Today: last 60 min vs normal + pace bar */}
                <div className="lg:hidden flex items-center gap-2 px-3 pb-2 -mt-1 text-[13px] text-[#94a0bd] min-w-0">
                  {isToday ? <>
                    <span className="whitespace-nowrap">60 min <b className="text-[14px] text-white">{x.v60}</b> visitors / {n1(x.n60)} normal</span>
                    <span className="flex-1 min-w-[32px]"><Pace x={x} /></span>
                    <span className="whitespace-nowrap">CO <b className={`text-[14px] ${x.c60 != null && x.c60 < x.judgeCo && x.v60 >= 3 ? 'text-red-400' : 'text-white'}`}>{pct(x.c60)}</b></span>
                  </> : <span className="truncate">{waitR ? '…' : <><b className="text-[14px] text-white">{n0(p.vis)}</b> visitors · {n0(p.outs)} clickouts · rate <b className="text-[14px] text-white">{pct(p.crSite)}</b></>}</span>}
                </div>
                {/* desktop */}
                <div className={`hidden lg:grid ${BOARD} gap-x-3.5 items-center px-4 py-2 min-h-[66px]`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl font-extrabold text-white w-[42px] flex-none">{x.m.market}</span>
                    <span className="flex flex-col min-w-0"><span className="text-sm font-semibold truncate">{x.m.label}</span><span className="text-[13px] text-[#94a0bd]">{pad(x.L.h)}:{pad(x.L.m)} local</span></span>
                  </div>
                  <span className={`justify-self-start text-[13px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap ${ST_CLS[x.st]}`}>{ST_LABEL[x.st]}</span>
                  {/* Spend: the money big, budget % small (owner 11-21) */}
                  <div className="flex flex-col gap-1 min-w-0">
                    {!x.hasAcct ? <span className="text-[13px] text-[#94a0bd] border border-dashed border-[#33416a] rounded-lg px-2 py-0.5 self-start whitespace-nowrap">no own Google Ads account</span>
                      : waitR ? <span className={sub}>loading…</span> : <>
                        <span className="text-[19px] font-extrabold text-white whitespace-nowrap leading-tight" title={ac !== 'ILS' ? `${money(ac, p.spend)} in the account currency` : undefined}>{ils(p.spendIls)}</span>
                        {isToday ? <><span className={sub} title={`normal by now ${pct(x.normBy)} (the white mark on the bar)`}>{pct(x.used)} of {ils(x.budgetIls)} · norm {pct(x.normBy)}</span><Bar x={x} /></>
                          : <span className={sub}>{p.nDays > 1 ? `≈${ils((p.spendIls ?? 0) / p.nDays)} a day` : dm(p.from)}</span>}
                      </>}
                  </div>
                  {/* Amazon: commission first and bold; items + revenue + assumption small (owner 11-21) */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {waitR ? <span className={sub}>loading…</span> : <>
                      {x.commUnset ? <span className="text-[15px] font-extrabold text-amber-400 whitespace-nowrap leading-tight" title={`No commission % on the ${x.m.market} market row (pulse_markets.comm_rate)`}>Commission % missing</span>
                        : <span className="text-[19px] font-extrabold text-emerald-400 whitespace-nowrap leading-tight">{p.earnIls == null ? '—' : '≈' + ils(p.earnIls)}</span>}
                      <span className={sub}>{n0(p.items)} items · {money(x.m.currency, p.rev)}</span>
                      {amzWarn ? <span className="text-[12px] font-semibold text-amber-400 truncate">{amzWarn}</span>
                        : <span className="text-[12px] text-[#7d89a8] truncate">× {x.comm != null ? (x.comm * 100).toFixed(1) + '%' : '?'} × FX</span>}
                    </>}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0"><span className={`text-[19px] font-extrabold leading-tight ${netCls(p.netIls)}`}>{waitR ? '…' : ilsS(p.netIls)}</span><span className={sub}>comm − spend</span></div>
                  <div className="flex flex-col gap-1 min-w-0">
                    {isToday ? <><span className="text-[17px] font-bold text-white whitespace-nowrap">{x.v60} <small className="text-[13px] font-medium text-[#94a0bd]">/ {n1(x.n60)} normal</small></span><Pace x={x} /></>
                      : <><span className="text-[17px] font-bold text-white">{waitR ? '…' : n0(p.vis)}</span><span className={sub}>{n0(p.outs)} clickouts</span></>}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    {isToday ? <><span className={`text-[17px] font-bold whitespace-nowrap ${x.c60 != null && x.c60 < x.judgeCo && x.v60 >= 3 ? 'text-red-400' : 'text-white'}`}>{pct(x.c60)}</span><span className={sub}>60 min</span></>
                      : <><span className="text-[17px] font-bold text-white">{waitR ? '…' : pct(p.crSite)}</span><span className={sub}>site</span></>}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {x.hasAcct && !waitR ? <>
                      <span className="text-[17px] font-bold text-white whitespace-nowrap" title="site: spend ÷ site clickouts (ad visits)">{cur2(ac, p.cpoSite)} <small className="text-[13px] font-medium text-[#94a0bd]">site</small></span>
                      <span className={sub}>Ads {cur2(ac, p.cpoAds)} · CPC {cur2(ac, p.cpc)}</span>
                      <span className={sub}>rate {pct(p.crSite)} · Ads {pct(p.crAds)}</span></>
                      : <span className="text-[13px] text-[#94a0bd]">—</span>}
                  </div>
                  <span className={`text-lg transition-transform ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>
                </div>
              </button>
              {open && <Detail x={x} p={p} per={per} R={R} P={P}
                orders={orders.filter(o => o.market === x.m.market)} dt={V.dt === 'camps' ? 'camps' : 'today'} setDt={t => saveV({ ...V, dt: t })}
                steps={steps} setStep={(k, v) => setSteps(s => ({ ...s, [k]: v }))}
                sel={sel[x.m.market] ?? null} setSel={v => setSel(s => ({ ...s, [x.m.market]: v }))} onAsk={setAsk} S={S} />}
            </div>
          );
        })}
      </div>

      {P.unmatched_accounts.length > 0 && (
        <div className="text-[14px] text-[#c3cbe0] border border-dashed border-amber-400 rounded-xl px-3 py-2 bg-amber-950/20">
          <b className="text-amber-400">Setup check:</b> Google Ads account(s) with no market row: {P.unmatched_accounts.map(a => `${a.account_name ?? a.customer_id} (${a.customer_id})`).join(', ')}.
          A pulse_markets row whose name token matches (or a pinned gads_customer_id) links it on the next run.
        </div>
      )}

      {/* alerts */}
      <section className="bg-[#121a2e] border border-[#24304d] rounded-2xl px-4 py-3.5 grid lg:grid-cols-2 gap-3.5" aria-label="Telegram alerts">
        <div>
          <h3 className="m-0 mb-1.5 text-[15px] font-bold text-white">Telegram alerts · rules <span className={`ml-1 text-xs ${P.settings.alerts_enabled === true ? 'text-emerald-400' : 'text-amber-400'}`}>{P.settings.alerts_enabled === true ? 'ON' : 'OFF'}</span></h3>
          <div className="flex flex-col gap-1.5 text-sm">
            {[
              `Stuck: visitors under ${pct(S('alert_stuck_ratio', 0.5))} of normal for ${S('alert_stuck_minutes', 30)} min`,
              `Surge: visitors over ${pct(S('alert_surge_ratio', 1.5))} of normal (strong ${pct(S('alert_surge_strong', 2))}), when normal ≥ ${S('alert_surge_min_normal', 3)}`,
              `Budget: ${pct(S('alert_budget_used', 0.9))} used before ${pad(S('alert_budget_before_h', 18))}:00 local, or spend over budget`,
              `Same market + rule at most once per ${S('alert_cooldown_min', 60)} min · quiet ${String(P.settings.alert_quiet_il ?? '00-07')} Israel`,
            ].map(t => <div key={t} className="bg-[#1a2440] rounded-lg px-2.5 py-1.5">{t}</div>)}
          </div>
          <p className="text-[13px] text-[#94a0bd] mt-1.5">Every number is a row in pulse_settings (per market via overrides), so the limits grow with the markets.</p>
        </div>
        <div>
          <h3 className="m-0 mb-1.5 text-[15px] font-bold text-white">Last alerts (24 h)</h3>
          <div className="flex flex-col gap-1.5 text-sm">
            {(P.alerts ?? []).slice(0, 6).map((a, i) => <div key={i} className="bg-[#1a2440] rounded-lg px-2.5 py-1.5"><b>{ilTime(a.sent_at)}</b> · {a.message}</div>)}
            {!(P.alerts ?? []).length && <span className="text-[13px] text-[#94a0bd]">None.</span>}
          </div>
        </div>
      </section>

      <p className="text-[13px] text-[#94a0bd] leading-relaxed">
        Rows = pulse_markets with active = true; a market without its own Google Ads account shows site + Amazon until an account with its code appears.
        Days and hours = each Google Ads account&apos;s clock. Board money is in ₪ (spend × FX of the account currency; commission ≈ Amazon revenue × commission % × FX); per-click numbers stay in the account currency, like Google Ads.
        Amazon is paired with the same day as the spend: a late order goes to Amazon&apos;s own day. Orders: your click + confirm is the GO for that one change; the worker re-checks it, writes it and reads it back.
      </p>

      {ask && <Confirm a={ask} onNo={() => setAsk(null)} onYes={confirm} />}
      {toast && <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-5 z-50 bg-[#22304f] border border-[#33416a] rounded-xl px-4 py-2.5 text-[15px] font-semibold max-w-[calc(100%-32px)]">{toast}</div>}
    </div>
  );
}

const fmtVal = (a: { unit: Ask['unit'] }, ac: string | null, v: number) =>
  a.unit === 'pts' ? sp((v - 1) * 100) : a.unit === 'roas' ? roasTxt(v) : cur2(ac, v);

function Confirm({ a, onNo, onYes }: { a: Ask; onNo: () => void; onYes: () => void }) {
  const ac = a.x.m.acct_currency;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onNo(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onNo]);
  const dd = 'm-0', dt = 'text-[#94a0bd]';
  const when = a.kind === 'budget' ? 'from now, today and the next days, until changed again'
    : a.kind === 'seasonality' ? 'now' : 'now; Google Ads bids toward it from the next auctions';
  return (
    <div className="fixed inset-0 z-40 bg-[#03060f]/70 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="mp-c" className="bg-[#121a2e] border border-[#33416a] rounded-2xl max-w-[440px] w-full p-5 flex flex-col gap-3.5 shadow-2xl">
        <h3 id="mp-c" className="m-0 text-lg font-bold text-white">{a.x.m.market} · {a.title}</h3>
        <div className="flex items-center gap-3 text-[26px] font-extrabold text-white">
          {a.kind === 'budget' ? money(ac, a.from) : fmtVal(a, ac, a.from)} <span className="text-xl text-[#94a0bd]">→</span> {a.kind === 'budget' ? money(ac, a.to) : fmtVal(a, ac, a.to)}
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {a.kind === 'seasonality'
            ? <><dt className={dt}>What</dt><dd className={dd}>the account&apos;s one active seasonality adjustment; nothing is created or deleted</dd></>
            : a.moves ? <><dt className={dt}>Strategy</dt><dd className={dd}>{a.name}</dd><dt className={dt}>Moves</dt><dd className={dd}><b>{a.moves.length} campaign{a.moves.length > 1 ? 's' : ''}</b>: {a.moves.join(' · ')}</dd></>
            : <><dt className={dt}>Campaign</dt><dd className={dd}>{a.name} (only this one)</dd></>}
          <dt className={dt}>Account</dt><dd className={dd}>{a.x.m.customer_id} · {a.x.m.label}</dd>
          <dt className={dt}>When</dt><dd className={dd}>{when}</dd>
          <dt className={dt}>Safety</dt><dd className={dd}>stops if the value or bidding type changed since you looked, or if the step is over the limit</dd>
          <dt className={dt}>Check</dt><dd className={dd}>read back from Google Ads and shown in the orders list</dd>
        </dl>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onNo} className="rounded-xl px-4 py-2.5 font-bold border border-[#33416a] bg-[#1a2440]">Cancel</button>
          <button type="button" onClick={onYes} autoFocus className="rounded-xl px-4 py-2.5 font-bold bg-blue-500 text-white">Confirm change</button>
        </div>
      </div>
    </div>
  );
}

// compact stepper (owner 11-15: smaller text): [−big][−small] value [+small][+big] + apply button
function Stepper({ steps, value, small, cls, onStep, apply, onApply }: { steps: [number, string][]; value: string; small: string; cls: string;
  onStep: (d: number) => void; apply: string | null; onApply: () => void }) {
  const btn = 'bg-[#1a2440] border border-[#33416a] rounded-xl text-[13px] sm:text-sm font-semibold text-[#c3cbe0] min-h-[44px] px-1 sm:px-2 whitespace-nowrap hover:border-blue-400';
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="grid grid-cols-[minmax(36px,auto)_minmax(36px,auto)_minmax(76px,1fr)_minmax(36px,auto)_minmax(36px,auto)] gap-1 sm:gap-1.5" role="group">
        {steps.slice(0, 2).map(([d, l]) => <button key={d} type="button" className={btn} onClick={() => onStep(d)}>{l}</button>)}
        <output aria-live="polite" className="flex flex-col items-center justify-center bg-[#0b1020] border border-[#33416a] rounded-xl p-1 min-w-0">
          <span className={`text-lg sm:text-xl font-extrabold leading-tight ${cls}`}>{value}</span><small className="text-[11px] sm:text-[13px] text-[#c3cbe0] text-center leading-tight break-words">{small}</small>
        </output>
        {steps.slice(2).map(([d, l]) => <button key={d} type="button" className={btn} onClick={() => onStep(d)}>{l}</button>)}
      </div>
      <button type="button" disabled={!apply} onClick={onApply}
        className="rounded-xl px-3 py-2.5 font-bold text-[14px] sm:text-[15px] text-white bg-blue-500 disabled:bg-[#1a2440] disabled:text-[#94a0bd] break-words">{apply ?? 'Pick a change'}</button>
    </div>
  );
}

const SUB = 'text-[13px] font-bold text-[#c3cbe0]';
const CARD = 'bg-[#121a2e] border border-[#24304d] rounded-xl p-3 flex flex-col gap-2 min-w-0';
const CENTS: [number, string][] = [[-0.05, '−0.05'], [-0.01, '−0.01'], [0.01, '+0.01'], [0.05, '+0.05']];
const PTS: [number, string][] = [[-0.05, '−5'], [-0.01, '−1'], [0.01, '+1'], [0.05, '+5']];
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dCls = (d: number) => (d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-[#94a0bd]');

function Detail({ x, p, per, R, P, orders, dt, setDt, steps, setStep, sel, setSel, onAsk, S }: {
  x: D; p: PV; per: Per; R: Range | null; P: Pulse; orders: Order[]; dt: string; setDt: (t: string) => void;
  steps: Record<string, number>; setStep: (k: string, v: number) => void; sel: string | null; setSel: (v: string | null) => void;
  onAsk: (a: Ask) => void; S: (k: string, d: number) => number;
}) {
  const ac = x.m.acct_currency, mk = x.m.market;
  const st = (k: string) => steps[`${mk}:${k}`] ?? 0;
  const set = (k: string, v: number) => setStep(`${mk}:${k}`, r2(v));
  const pctLim = S('bid_step_pct', 0.5), ptsLim = S('troas_step_pts', 50) / 100, minB = S('bid_min_amount', 0.01), minR = S('troas_min', 0.05);
  const stratOf = (id: string | null) => x.strategies.find(s => s.strategy_id === id) ?? null;
  const usedBy = (id: string) => x.campaigns.filter(c => c.strategy_id === id).map(c => c.name ?? c.campaign_id);
  // owner 11-21: two tabs — the period view (always first, default) and Campaigns; the Money tab is folded into the first
  const tabs: [string, string][] = [['today', PER_LABEL[per]], ['camps', `Campaigns${x.campaigns.length ? ` (${x.campaigns.length})` : ''}`]];
  const [campF, setCampF] = useState<string>('all');

  const isH0 = per === 'today' || per === 'yday', ilNow = localNow(IL), waitR = per !== 'today' && !R;
  const fxA = x.fxA, fxAcc = x.fxAcc;
  // campaign days: today from the live read; other periods from the range read
  const cdSrc = per === 'today' ? (P.campaign_daily ?? []) : (R?.campaign_daily ?? []);
  const cdays = cdSrc.filter(c => c.market === mk && c.customer_id === x.m.customer_id && c.local_date >= p.from && c.local_date <= p.to);
  const cdOf = (id: string, d: string) => cdays.filter(c => c.campaign_id === id && c.local_date === d);
  const campNames = Array.from(new Map([...x.campaigns.map(c => [c.campaign_id, c.name ?? c.campaign_id] as [string, string]),
    ...cdays.filter(c => num(c.clicks, 0) > 0 || num(c.cost, 0) > 0).map(c => [c.campaign_id, c.name ?? c.campaign_id] as [string, string])]).entries());
  // owner 11-26: one campaign = its own day rows for ANY period (Today / Yesterday = one day row). Google Ads numbers
  // only: click_log has no campaign, Amazon's report has no tag per campaign -> visitors, Amazon, commission, net = —
  const one = campF !== 'all';
  const isH = isH0 && !one;
  const estE = (r: { amz_earnings: number | null; amz_revenue: number | null }) => (r.amz_earnings != null ? num(r.amz_earnings, 0) : num(r.amz_revenue, 0) * num(x.comm, 0));
  type Row = { key: string; label: string; il: string; vis: number | null; norm: number; outs: number | null; cost: number | null; clicks: number | null;
    conv: number | null; items: number | null; rev: number | null; earn: number | null; fut: boolean; now: boolean; lag: boolean };
  const hourIl = (h: number) => pad(((h - x.L.h + ilNow.h) % 24 + 24) % 24) + ':00';
  const dayLabel = (d: string) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T12:00:00Z').getUTCDay()]} ${dm(d)}`;
  const oneRows = (): Row[] => {
    const out: Row[] = [];
    for (let d = p.to; d >= p.from; d = addDays(d, -1)) {
      const c1 = cdOf(campF, d), cs = (k: 'cost' | 'clicks' | 'conv') => c1.reduce((a, c) => a + num(c[k], 0), 0);
      out.push({ key: d, label: dayLabel(d), il: '', vis: null, norm: 0, outs: null, cost: x.hasAcct ? cs('cost') : null, clicks: cs('clicks'),
        conv: cs('conv'), items: null, rev: null, earn: null, fut: false, now: d === x.L.date, lag: false });
    }
    return out;
  };
  const rows: Row[] = one ? oneRows() : per === 'today'
    ? x.hours.map(h => ({ key: String(h.h), label: pad(h.h) + ':00', il: hourIl(h.h), vis: h.vis, norm: h.norm, outs: h.outs,
        cost: h.cost, clicks: h.clicks, conv: h.conv, items: h.items, rev: h.rev, earn: h.earn, fut: h.fut, now: h.now, lag: h.lag }))
    : per === 'yday'
      ? Array.from({ length: 24 }, (_, h) => {
          const r = (R?.yesterday ?? []).find(y => y.market === mk && y.local_hour === h);
          return { key: String(h), label: pad(h) + ':00', il: hourIl(h), vis: num(r?.visitors, 0), norm: x.hours[h].norm, outs: num(r?.clickouts, 0),
            cost: x.hasAcct ? num(r?.gads_cost, 0) : null, clicks: num(r?.gads_clicks, 0), conv: num(r?.gads_conv, 0), items: num(r?.amz_items, 0),
            rev: num(r?.amz_revenue, 0), earn: r ? estE(r) : 0, fut: false, now: false, lag: false };
        })
      : (R?.days ?? []).filter(d => d.market === mk && d.local_date >= p.from && d.local_date <= p.to)
          .sort((a, b) => (a.local_date < b.local_date ? 1 : -1))   // newest first: the previous days right at the top
          .map(d => {
            const c1 = one ? cdOf(campF, d.local_date) : [];
            const cs = (k: 'cost' | 'clicks' | 'conv') => c1.reduce((a, c) => a + num(c[k], 0), 0);
            return { key: d.local_date, label: dayLabel(d.local_date), il: '',
              vis: one ? null : num(d.visitors, 0), norm: x.hours.reduce((a, h) => a + h.norm, 0), outs: one ? null : num(d.clickouts, 0),
              cost: !x.hasAcct ? null : one ? cs('cost') : num(d.gads_cost, 0), clicks: one ? cs('clicks') : num(d.gads_clicks, 0),
              conv: one ? cs('conv') : num(d.gads_conv, 0), items: num(d.amz_items, 0), rev: num(d.amz_revenue, 0), earn: estE(d),
              fut: false, now: d.local_date === x.L.date, lag: d.local_date === x.L.date };
          });
  const T = (k: 'vis' | 'outs' | 'cost' | 'clicks' | 'conv' | 'items' | 'rev' | 'earn') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const c2 = (v: number | null) => (v == null ? '—' : v.toFixed(2));
  const toIls = (v: number | null, fx: number | null) => (v == null || fx == null ? null : v * fx);
  // owner 11-15 + 11-21: the header stays visible while the PAGE scrolls (sticky right under the filter bar); spend,
  // commission and net come first; Amazon items/revenue at the end. Wide screens: no inner scroll box.
  // owner 11-22: left-aligned, bigger numbers (15 px), headers centred vertically
  // owner 11-22 (2nd look): bigger (16 px), centred, every other row a slightly lighter shade
  const td = 'px-1.5 py-2 text-center whitespace-nowrap border-b border-[#24304d]';
  const th = 'px-1.5 py-2 text-center align-middle leading-tight bg-[#1a2440] text-[#94a0bd] text-[12px] uppercase tracking-wide font-bold sticky z-20 top-0 lg:top-[var(--mp-top,0px)] border-b border-[#33416a]';
  // page-sticky under the filter bar on wide screens; on phones the table scrolls sideways in its own box, so top 0
  const thTop = undefined;
  const flag = 'inline-block px-1.5 rounded bg-red-400/15 text-red-400 font-bold';
  const B = 'border-l border-[#33416a]';

  // ── seasonality (owner 11-21: first in the period tab, also kept in Bids & budgets)
  const seasNow = x.m.seasonality, sd = st('seas'), nowPts = Math.round(((seasNow ?? 1) - 1) * 1000) / 10;
  const sRange = S('seas_step_range_pts', 25), sCap = S('seas_cap_pts', 60), sFloor = S('seas_floor_pts', -50);
  // owner 11-15: targets are WHOLE percents; only a step that lands on 0 stops at ±0.1 (Google Ads takes no exact 0%).
  const seasStep = (d: number) => {
    const cur = nowPts + sd;
    let t = Math.round(cur + d);
    if (t === 0) t = d > 0 ? 0.1 : -0.1;
    t = clamp(t, Math.max(nowPts - sRange, sFloor), Math.min(nowPts + sRange, sCap));
    set('seas', r2(t - nowPts));
  };
  const sdShown = sd === 0 ? 0 : (nowPts + sd) - Math.round(nowPts);
  // owner 11-22: compact — the label sits right next to the stepper (not at the far side)
  const seasStrip = x.hasAcct && (
    <div className="bg-[#121a2e] border border-[#24304d] rounded-xl p-2.5 flex flex-wrap gap-x-5 gap-y-2.5 items-center">
      <div className="flex flex-col min-w-0"><K>Account seasonality</K><b className="text-[22px] font-extrabold text-white leading-tight">{seasNow == null ? 'none active' : sp(nowPts)}</b>
        {seasNow != null && <span className="text-[12px] text-[#94a0bd]">range {sp(Math.max(nowPts - sRange, sFloor))} … {sp(Math.min(nowPts + sRange, sCap))}</span>}</div>
      {seasNow != null && <div className="w-full max-w-[460px]"><Stepper steps={[[-5, '−5'], [-1, '−1'], [1, '+1'], [5, '+5']]} value={sd === 0 ? '±0' : sp(sdShown)} small={`new ${sp(nowPts + sd)}`} cls={dCls(sd)}
        onStep={seasStep}
        apply={sd ? `Apply seasonality ${sp(nowPts)} → ${sp(nowPts + sd)}` : null}
        onApply={() => onAsk({ x, kind: 'seasonality', from: seasNow, to: Math.round((1 + (nowPts + sd) / 100) * 1000) / 1000, unit: 'pts', title: 'Seasonality', key: `${mk}:seas` })} /></div>}
    </div>
  );

  const periodTab = (
    <div className="flex flex-col gap-3">
      {seasStrip}
      {x.hasAcct && campNames.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Campaign">
          {[['all', 'All campaigns'] as [string, string], ...campNames].map(([id, nm]) => (
            <button key={id} type="button" aria-pressed={campF === id} onClick={() => setCampF(id)}
              className={`flex-none px-3 py-1 rounded-full text-[13px] font-semibold border whitespace-nowrap ${campF === id ? 'bg-blue-500/15 border-blue-500 text-white' : 'bg-[#1a2440] border-[#33416a] text-[#94a0bd]'}`}>{nm}</button>
          ))}
        </div>
      )}
      {one && <p className="text-[13px] text-[#94a0bd] m-0"><b className="text-[#c3cbe0]">One campaign, by day.</b> Per campaign: spend, clicks, CPC, Ads clickouts, Ads rate and Ads cost per clickout (Google Ads).
        Not split per campaign (shown as —): site visitors and site clickouts (our click log keeps the Google click id but not the campaign) and
        Amazon items, revenue, commission and so net (Amazon&apos;s report has no tag per campaign).</p>}
      {waitR ? <p className="text-sm text-[#94a0bd] m-0">Loading {PER_LABEL[per].toLowerCase()}…</p> : (
        <div className="overflow-x-auto lg:overflow-visible border border-[#24304d] rounded-xl">
          <table className="w-full min-w-[1060px] text-[16px] border-separate border-spacing-0">
            <thead><tr>
              <th style={thTop} className={`${th} text-left left-0 z-30 rounded-tl-xl`}>{isH ? 'Local' : 'Day'}</th>{isH && <th style={thTop} className={th}>IL</th>}
              <th style={thTop} className={`${th} ${B} text-white`}>Spend ₪</th><th style={thTop} className={`${th} text-emerald-300`}>Comm ≈₪</th><th style={thTop} className={th}>Net ₪</th>
              <th style={thTop} className={`${th} ${B}`}>Clicks</th><th style={thTop} className={th}>CPC {sym(ac).trim()}</th>
              <th style={thTop} className={`${th} ${B}`}>Visitors</th><th style={thTop} className={th}>Normal</th><th style={thTop} className={th}>Clickouts</th><th style={thTop} className={th}>Rate</th><th style={thTop} className={th}>Cost / clickout</th>
              <th style={thTop} className={`${th} ${B}`} title="Google Ads Clickouts conversion">Ads clickouts</th><th style={thTop} className={th}>Ads rate</th><th style={thTop} className={th}>Ads cost / clickout</th>
              <th style={thTop} className={`${th} ${B}`}>Amazon items</th><th style={thTop} className={`${th} rounded-tr-xl`}>Revenue {x.m.currency}</th>
            </tr></thead>
            <tbody>
              {rows.map((r, ri) => {
                const zb = ri % 2 ? 'bg-[#172140]' : 'bg-[#121a2e]';
                const rate = r.vis ? (r.outs ?? 0) / r.vis : null;
                const lowV = isH && r.vis != null && !r.now && r.norm >= x.stuckMin && r.vis < x.stuckRatio * r.norm;
                const sI = x.hasAcct ? toIls(r.cost, fxAcc) : null, eI = x.comm == null ? null : toIls(r.earn, fxA);
                const net = sI != null && eI != null ? eI - sI : null;
                const lag = per === 'today' && (x.amzStale || r.lag) ? 'bg-violet-400/10' : '';
                return (
                  <tr key={r.key} className={`${r.fut ? 'opacity-45 text-[#94a0bd]' : ''} ${r.now && per === 'today' ? 'bg-yellow-400/10' : zb}`}>
                    <td className={`${td} sticky left-0 ${r.now && per === 'today' ? 'bg-[#2a2c2a]' : zb}`}>{r.label}</td>{isH && <td className={td}>{r.il}</td>}
                    <td className={`${td} ${B} font-bold text-white`}>{x.hasAcct ? (r.fut ? '—' : n0(sI)) : '—'}</td>
                    <td className={`${td} font-bold text-emerald-300 ${lag}`}>{r.fut || eI == null ? '—' : n0(eI)}</td>
                    <td className={`${td} ${netCls(net)}`}>{r.fut || net == null ? '—' : Math.round(net) === 0 ? '0' : (net > 0 ? '+' : '−') + n0(Math.abs(net))}</td>
                    <td className={`${td} ${B}`}>{x.hasAcct ? n0(r.clicks) : '—'}</td>
                    <td className={td}>{x.hasAcct ? c2(ratio(r.cost, r.clicks)) : '—'}</td>
                    <td className={`${td} ${B}`}>{n0(r.vis)}</td>
                    <td className={td}>{one ? '—' : lowV ? <span className={flag}>{n1(r.norm)}</span> : isH ? n1(r.norm) : n0(r.norm)}</td>
                    <td className={td}>{n0(r.outs)}</td>
                    <td className={td}>{rate != null && rate < x.judgeCo && (r.vis ?? 0) >= 4 ? <span className={flag}>{pct(rate)}</span> : pct(rate)}</td>
                    <td className={td}>{r.cost && r.outs ? (r.cost / r.outs).toFixed(2) : '—'}</td>
                    <td className={`${td} ${B}`}>{x.hasAcct ? n1(r.conv) : '—'}</td>
                    <td className={td}>{x.hasAcct ? pct(ratio(r.conv, r.clicks)) : '—'}</td>
                    <td className={td}>{x.hasAcct ? c2(ratio(r.cost, r.conv)) : '—'}</td>
                    <td className={`${td} ${B} ${lag}`}>{n0(r.items)}</td><td className={`${td} ${lag}`}>{money(x.m.currency, r.rev)}</td>
                  </tr>
                );
              })}
              {(() => {
                const sI = x.hasAcct ? toIls(T('cost'), fxAcc) : null, eI = one || x.comm == null ? null : toIls(T('earn'), fxA), net = sI != null && eI != null ? eI - sI : null;
                const f = 'bg-[#1a2440]';
                return (
                  <tr className="font-bold">
                    <td className={`${td} ${f} text-left sticky left-0`}>Total</td>{isH && <td className={`${td} ${f}`} />}
                    <td className={`${td} ${f} ${B} text-white`}>{x.hasAcct ? ils(sI) : '—'}</td>
                    <td className={`${td} ${f} text-emerald-300`}>{eI == null ? '—' : '≈' + ils(eI)}</td>
                    <td className={`${td} ${f} ${netCls(net)}`}>{ilsS(net)}</td>
                    <td className={`${td} ${f} ${B}`}>{x.hasAcct ? n0(T('clicks')) : '—'}</td>
                    <td className={`${td} ${f}`}>{x.hasAcct ? c2(ratio(T('cost'), T('clicks'))) : '—'}</td>
                    <td className={`${td} ${f} ${B}`}>{one ? '—' : n0(T('vis'))}</td><td className={`${td} ${f}`}>{per === 'today' ? `${n0(x.normT)} by now` : '—'}</td>
                    <td className={`${td} ${f}`}>{one ? '—' : n0(T('outs'))}</td><td className={`${td} ${f}`}>{!one && T('vis') ? pct(T('outs') / T('vis')) : '—'}</td>
                    <td className={`${td} ${f}`}>{!one && T('cost') && T('outs') ? (T('cost') / T('outs')).toFixed(2) : '—'}</td>
                    <td className={`${td} ${f} ${B}`}>{x.hasAcct ? n1(T('conv')) : '—'}</td>
                    <td className={`${td} ${f}`}>{x.hasAcct ? pct(ratio(T('conv'), T('clicks'))) : '—'}</td>
                    <td className={`${td} ${f}`}>{x.hasAcct ? c2(ratio(T('cost'), T('conv'))) : '—'}</td>
                    <td className={`${td} ${f} ${B}`}>{one ? '—' : n0(T('items'))}</td><td className={`${td} ${f}`}>{one ? '—' : money(x.m.currency, T('rev'))}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[#94a0bd]">
        {per === 'today' && <><span><i className="inline-block w-[11px] h-[11px] rounded-sm mr-1 align-[-1px] bg-yellow-400/20" />current hour</span>
          <span><i className="inline-block w-[11px] h-[11px] rounded-sm mr-1 align-[-1px] bg-violet-400/20" />Amazon still coming in</span></>}
        {p.notIn && <span className="text-amber-400">Amazon&apos;s report is still on the day before; {dm(p.notIn)} is not in yet (see Yesterday for the full pair).</span>}
        <span>Amazon read {agoTxt(x.readAge)}{x.mtd?.last_new_order ? ` · last new order ${ilTime(x.mtd.last_new_order)} IL` : ''}</span>
      </div>
      {/* was the Money tab (owner 11-21: fold it in) */}
      <p className="text-[13px] text-[#94a0bd] m-0 leading-relaxed">
        {x.commUnset ? <span className="text-amber-400">No commission % on the {mk} market row yet, so no ₪ estimate. </span>
          : <>Commission ≈ revenue × <b className="text-[#c3cbe0]">{(num(x.comm, 0) * 100).toFixed(2)}%</b>{x.act != null && <> (actual this month <b className={Math.abs(x.act - num(x.comm, 0)) >= 0.005 ? 'text-amber-400' : 'text-[#c3cbe0]'}>{(x.act * 100).toFixed(1)}%</b>)</>}
            {' '}× FX{fxA != null ? ` (${x.m.currency} ${fxA < 0.1 ? `100 = ₪${(fxA * 100).toFixed(2)}` : `1 = ₪${fxA.toFixed(2)}`})` : ''}. Amazon&apos;s report has no earnings, so this is an estimate. </>}
        {x.mtd && <>Month-to-date (Amazon, ads tags): {n0(x.mtd.items)} items · {money(x.m.currency, x.mtd.revenue)} · earnings {money(x.m.currency, x.mtd.earnings)}. </>}
        {x.status?.job_last_error && <span className="text-amber-400">Last job error: {x.status.job_last_error}</span>}
      </p>
      {per === 'today' && (
        <div className={`${CARD} max-w-[620px]`}>
          <div className="flex flex-wrap gap-x-3 items-baseline"><h3 className="m-0 text-[13px] font-bold text-white">By local hour</h3><span className="text-[12px] text-[#94a0bd]">bars = ad visitors · dashed = normal · strip = clickout rate</span></div>
          <Chart x={x} />
        </div>
      )}
    </div>
  );

  // ── Campaigns tab (owner 11-22): ONE view, no sub-tabs. Seasonality on top; one campaign table that joins
  // performance (period = the switch at the top) with budget + bidding; a click on a campaign opens its changes
  // right under it, the 2–3 change boxes on one line.
  const stratCards = (s: Strat) => {
    const uses = usedBy(s.strategy_id), t0 = num(s.target_value, 0), tk = `str:${s.strategy_id}`, tdv = st(tk);
    const ck = `cpc:${s.strategy_id}`, cdv = st(ck), c0 = num(s.max_cpc, 0), isR = s.target_kind === 'troas';
    const nC = `${uses.length} campaign${uses.length > 1 ? 's' : ''}`;
    return [
      <div key="t" className={CARD}>
        <span className={SUB}>{isR ? 'tROAS' : `tCPA · ${ac}`} · <span className="text-violet-300">shared</span></span>
        {s.target_value == null ? <span className="text-[13px] text-[#94a0bd]">No target set.</span> :
          <Stepper steps={isR ? PTS : CENTS} cls={dCls(tdv)}
            value={tdv === 0 ? '±0' : isR ? (tdv > 0 ? '+' : '−') + Math.round(Math.abs(tdv) * 100) + ' pts' : (tdv > 0 ? '+' : '−') + cur2(ac, Math.abs(tdv))}
            small={isR ? `${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : `${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`}
            onStep={d => set(tk, isR ? clamp(tdv + d, Math.max(minR - t0, -ptsLim), ptsLim) : clamp(tdv + d, Math.max(minB - t0, -pctLim * t0), pctLim * t0))}
            apply={tdv ? `Apply ${isR ? `tROAS ${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : `tCPA ${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`} (${nC})` : null}
            onApply={() => onAsk({ x, kind: 'strategy_target', from: t0, to: r2(t0 + tdv), targetId: s.strategy_id, name: s.name ?? '', unit: isR ? 'roas' : 'money',
              title: isR ? 'Shared tROAS' : 'Shared tCPA', moves: uses, key: `${mk}:${tk}` })} />}
      </div>,
      <div key="c" className={CARD}>
        <span className={SUB}>Max CPC (bid limit) · {ac} · <span className="text-violet-300">shared</span></span>
        {s.max_cpc == null ? <span className="text-[13px] text-[#94a0bd]">No bid limit set on this strategy.</span> :
          <Stepper steps={CENTS} cls={dCls(cdv)} value={cdv === 0 ? '±0' : (cdv > 0 ? '+' : '−') + cur2(ac, Math.abs(cdv))}
            small={`${cur2(ac, c0)} → ${cur2(ac, c0 + cdv)}`}
            onStep={d => set(ck, clamp(cdv + d, Math.max(minB - c0, -pctLim * c0), pctLim * c0))}
            apply={cdv ? `Apply max CPC ${cur2(ac, c0)} → ${cur2(ac, c0 + cdv)} (${nC})` : null}
            onApply={() => onAsk({ x, kind: 'strategy_max_cpc', from: c0, to: r2(c0 + cdv), targetId: s.strategy_id, name: s.name ?? '', unit: 'money',
              title: 'Shared max CPC (bid limit)', moves: uses, key: `${mk}:${ck}` })} />}
      </div>,
    ];
  };
  const sharedNote = (s: Strat) => {
    const uses = usedBy(s.strategy_id);
    return <span className="text-[13px] text-[#94a0bd]">Shared strategy <b className="text-violet-300">{s.name}</b>: a change moves <b className="text-[#e8edf7]">{uses.length} campaign{uses.length > 1 ? 's' : ''}</b> — {uses.join(' · ') || '—'}.</span>;
  };
  const campEditor = (c: Camp) => {
    const b = num(c.budget_amount, 0), bk = `bud:${c.campaign_id}`, bd = st(bk);
    const tk = `tgt:${c.campaign_id}`, tdv = st(tk), t0 = num(c.bid_target, 0);
    const isR = ROAS_TYPES.includes(c.bid_type ?? ''), isC = CPA_TYPES.includes(c.bid_type ?? '');
    const s = stratOf(c.strategy_id);
    const budgetCard = (
      <div key="b" className={CARD}>
        <span className={SUB}>Daily budget · {ac}</span>
        {c.budget_shared ? <span className="text-[13px] text-[#94a0bd]">Shared budget: change it in Google Ads.</span> :
          <Stepper steps={[[-5, '−5'], [-1, '−1'], [1, '+1'], [5, '+5']]} value={bd === 0 ? '±0' : (bd > 0 ? '+' : '') + money(ac, bd)}
            small={`${money(ac, b)} → ${money(ac, b + bd)}`} cls={dCls(bd)}
            onStep={d => set(bk, clamp(bd + d, S('budget_min_amount', 1) - b, (S('budget_max_factor', 3) - 1) * b))}
            apply={bd ? `Apply budget ${money(ac, b)} → ${money(ac, b + bd)}` : null}
            onApply={() => onAsk({ x, kind: 'budget', from: b, to: r2(b + bd), targetId: c.campaign_id, name: c.name ?? '', unit: 'money', title: 'Daily budget', key: `${mk}:${bk}` })} />}
      </div>
    );
    const ownCard = (
      <div key="o" className={CARD}>
        {isC && c.bid_target != null ? <>
          <span className={SUB}>Bid target · tCPA · {ac}</span>
          <Stepper steps={CENTS} value={tdv === 0 ? '±0' : (tdv > 0 ? '+' : '−') + cur2(ac, Math.abs(tdv))} small={`${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`} cls={dCls(tdv)}
            onStep={d => set(tk, clamp(tdv + d, Math.max(minB - t0, -pctLim * t0), pctLim * t0))}
            apply={tdv ? `Apply tCPA ${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}` : null}
            onApply={() => onAsk({ x, kind: 'campaign_target', from: t0, to: r2(t0 + tdv), targetId: c.campaign_id, name: c.name ?? '', unit: 'money', title: 'tCPA (bid target)', key: `${mk}:${tk}` })} />
        </> : isR && c.bid_target != null ? <>
          <span className={SUB}>Bid target · tROAS</span>
          <Stepper steps={PTS} value={tdv === 0 ? '±0' : (tdv > 0 ? '+' : '−') + Math.round(Math.abs(tdv) * 100) + ' pts'} small={`${roasTxt(t0)} → ${roasTxt(t0 + tdv)}`} cls={dCls(tdv)}
            onStep={d => set(tk, clamp(tdv + d, Math.max(minR - t0, -ptsLim), ptsLim))}
            apply={tdv ? `Apply tROAS ${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : null}
            onApply={() => onAsk({ x, kind: 'campaign_target', from: t0, to: r2(t0 + tdv), targetId: c.campaign_id, name: c.name ?? '', unit: 'roas', title: 'tROAS (bid target)', key: `${mk}:${tk}` })} />
        </> : <><span className={SUB}>Bid target</span><span className="text-[13px] text-[#94a0bd]">{c.bid_type === 'TARGET_SPEND' ? 'Maximize clicks: no target to change.' : 'No target the panel can change.'}</span></>}
      </div>
    );
    const cards = s ? [budgetCard, ...stratCards(s)] : [budgetCard, ownCard];
    return (
      <div className="flex flex-col gap-2.5 min-w-0">
        <button type="button" onClick={() => { setCampF(c.campaign_id); setDt('today'); }} className="self-start text-[13px] font-bold text-blue-400">
          See this campaign by day ({PER_LABEL[per].toLowerCase()}) ›</button>
        <div className={`grid gap-3 ${cards.length === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>{cards}</div>
        {s && sharedNote(s)}
      </div>
    );
  };
  const bidType = (c: Camp) => {
    const s = stratOf(c.strategy_id);
    if (s) return s.target_kind === 'tcpa' ? 'tCPA' : 'tROAS';
    return CPA_TYPES.includes(c.bid_type ?? '') ? 'tCPA' : ROAS_TYPES.includes(c.bid_type ?? '') ? 'tROAS' : c.bid_type === 'TARGET_SPEND' ? 'Max clicks' : (c.bid_type ?? '—').toLowerCase().replace(/_/g, ' ');
  };
  const targetLabel = (c: Camp) => {
    const s = stratOf(c.strategy_id);
    if (s) return s.target_kind === 'troas' ? roasTxt(s.target_value) : cur2(ac, s.target_value);
    return c.bid_target == null ? '—' : ROAS_TYPES.includes(c.bid_type ?? '') ? roasTxt(c.bid_target) : cur2(ac, c.bid_target);
  };
  const stateTxt = (o: Order) => o.status === 'queued' ? 'Sending…' : o.status === 'running' ? 'Working…' : o.status === 'done' ? '✓ Done' : o.status === 'expired' ? '✗ Expired' : '✗ Not applied';
  const stateCls = (o: Order) => o.status === 'done' ? 'text-emerald-400' : o.status === 'queued' || o.status === 'running' ? 'text-blue-400' : 'text-red-400';
  const oVal = (o: Order, v: number) => o.kind === 'seasonality' ? sp((v - 1) * 100) : o.kind === 'budget' ? money(ac, v)
    : (o.kind === 'strategy_max_cpc' ? cur2(ac, v) : (ROAS_TYPES.includes(o.target_type ?? '') ? roasTxt(v) : cur2(ac, v)));
  const oWhat = (o: Order) => o.kind === 'seasonality' ? 'seasonality' : o.kind === 'budget' ? `${o.target_name} · budget`
    : o.kind === 'campaign_target' ? `${o.target_name} · target` : o.kind === 'strategy_target' ? `${o.target_name} · shared target` : `${o.target_name} · max CPC`;

  // campaign rows = enabled campaigns (can be changed) + any campaign that has numbers in the period
  type CRow = { id: string; name: string; c: Camp | null; cost: number; clicks: number; conv: number };
  const cmap = new Map<string, CRow>();
  x.campaigns.forEach(c => cmap.set(c.campaign_id, { id: c.campaign_id, name: c.name ?? c.campaign_id, c, cost: 0, clicks: 0, conv: 0 }));
  cdays.forEach(d => { const r = cmap.get(d.campaign_id) ?? { id: d.campaign_id, name: d.name ?? d.campaign_id, c: null, cost: 0, clicks: 0, conv: 0 };
    r.cost += num(d.cost, 0); r.clicks += num(d.clicks, 0); r.conv += num(d.conv, 0); cmap.set(d.campaign_id, r); });
  const crows = Array.from(cmap.values()).filter(r => r.c || r.cost > 0 || r.clicks > 0).sort((a, b) => b.cost - a.cost || (b.c ? 1 : 0) - (a.c ? 1 : 0));
  const ctot = crows.reduce((a, r) => ({ cost: a.cost + r.cost, clicks: a.clicks + r.clicks, conv: a.conv + r.conv }), { cost: 0, clicks: 0, conv: 0 });
  const ctd = 'px-2.5 py-2 text-center whitespace-nowrap border-t border-[#24304d]';
  const cth = 'px-2.5 py-2 text-center align-middle whitespace-nowrap text-[#94a0bd] text-[12px] uppercase tracking-wide font-bold bg-[#1a2440]';
  const COLS = 11;
  const campCards = (
    <div className="lg:hidden flex flex-col gap-2">
      {waitR && <span className="text-[13px] text-[#94a0bd]">Loading…</span>}
      {!waitR && crows.map(r => {
        const open = sel === `c:${r.id}`, c = r.c, sh = c ? stratOf(c.strategy_id) : null;
        const cell = (k: string, v: React.ReactNode, cls = 'text-white') => (
          <span className="flex flex-col min-w-0"><span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a0bd] truncate">{k}</span><b className={`text-[15px] truncate ${cls}`}>{v}</b></span>);
        return (
          <div key={r.id} className={`border rounded-xl min-w-0 ${open ? 'border-blue-500 bg-[#1a2440]' : 'border-[#24304d] bg-[#121a2e]'} ${c ? '' : 'opacity-70'}`}>
            <button type="button" disabled={!c} aria-expanded={c ? open : undefined} onClick={() => c && setSel(open ? null : `c:${r.id}`)} className="w-full text-left p-2.5 flex flex-col gap-2 min-w-0">
              <span className="flex items-center gap-2 min-w-0"><span className="font-semibold truncate flex-1">{r.name}</span>{c && <span className={`text-lg ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>}</span>
              <span className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                {cell('Spend', ils(toIls(r.cost, fxAcc)))}{cell('Clickouts', n1(r.conv))}{cell('Cost/CO', cur2(ac, ratio(r.cost, r.conv)))}
                {cell('Budget', c ? money(ac, num(c.budget_amount, 0)) : '—')}{cell('CPC', cur2(ac, ratio(r.cost, r.clicks)))}
                {cell(c ? bidType(c) + (sh ? ' · shared' : '') : 'Bid', c ? targetLabel(c) : '—', sh ? 'text-violet-300' : 'text-white')}
              </span>
            </button>
            {open && c && <div className="border-t border-[#33416a] p-2 min-w-0">{campEditor(c)}</div>}
          </div>
        );
      })}
      {!waitR && crows.length > 0 && <span className="text-[13px] text-[#c3cbe0]">Account: spend <b className="text-white">{ils(toIls(ctot.cost, fxAcc))}</b> · clickouts {n1(ctot.conv)} · cost/CO {cur2(ac, ratio(ctot.cost, ctot.conv))}</span>}
    </div>
  );
  const campTable = (
    <div className="hidden lg:block bg-[#121a2e] border border-[#24304d] rounded-xl overflow-x-auto">
      <table className="w-full min-w-[1020px] text-[16px] border-separate border-spacing-0">
        <thead><tr>
          <th className={`${cth} !text-left rounded-tl-xl`}>Campaign · {PER_LABEL[per].toLowerCase()}</th><th className={cth}>Budget / day</th>
          <th className={`${cth} text-white`}>Spend ₪</th><th className={cth}>Clickouts</th><th className={cth}>Cost / clickout</th>
          <th className={cth}>Clicks</th><th className={cth}>Avg. CPC</th><th className={cth}>Clickout rate</th>
          <th className={cth}>Bidding</th><th className={cth}>Target</th><th className={`${cth} rounded-tr-xl`} />
        </tr></thead>
        <tbody>
          {waitR && <tr><td colSpan={COLS} className={`${ctd} text-[#94a0bd]`}>Loading…</td></tr>}
          {!waitR && crows.map((r, ri) => {
            const open = sel === `c:${r.id}`, c = r.c, sh = c ? stratOf(c.strategy_id) : null;
            return (
              <Fragment key={r.id}>
                <tr onClick={() => c && setSel(open ? null : `c:${r.id}`)} aria-expanded={c ? open : undefined}
                  className={`${c ? 'cursor-pointer hover:bg-white/[.05]' : 'opacity-70'} ${open ? 'bg-[#1a2440]' : ri % 2 ? 'bg-[#172140]' : ''}`}>
                  <td className={`${ctd} !text-left font-semibold max-w-[300px] truncate`} title={r.name}>{r.name}{!c && <small className="ml-1.5 text-[12px] text-[#94a0bd]">not enabled</small>}</td>
                  <td className={ctd}>{c ? money(ac, num(c.budget_amount, 0)) : '—'}</td>
                  <td className={`${ctd} font-bold text-white`}>{ils(toIls(r.cost, fxAcc))}</td>
                  <td className={ctd}>{n1(r.conv)}</td>
                  <td className={`${ctd} bg-blue-500/5`}>{cur2(ac, ratio(r.cost, r.conv))}</td>
                  <td className={ctd}>{n0(r.clicks)}</td>
                  <td className={`${ctd} bg-blue-500/5`}>{cur2(ac, ratio(r.cost, r.clicks))}</td>
                  <td className={`${ctd} bg-blue-500/5`}>{pct(ratio(r.conv, r.clicks))}</td>
                  <td className={ctd}>{c ? bidType(c) : '—'}</td>
                  <td className={ctd}>{c ? <span className="flex flex-col leading-tight"><b className="text-white">{targetLabel(c)}</b>
                    {sh && <small className="text-[12px] text-violet-300">shared · {usedBy(sh.strategy_id).length} campaigns</small>}</span> : '—'}</td>
                  <td className={`${ctd} text-lg ${open ? 'text-white' : 'text-[#94a0bd]'}`}>{c ? <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>›</span> : ''}</td>
                </tr>
                {open && c && <tr><td colSpan={COLS} className="bg-[#0f1730] border-t border-[#33416a] p-3">{campEditor(c)}</td></tr>}
              </Fragment>
            );
          })}
          {!waitR && !crows.length && <tr><td colSpan={COLS} className={`${ctd} text-[#94a0bd]`}>Campaign list appears after the next job run.</td></tr>}
        </tbody>
        {!waitR && crows.length > 0 && <tfoot><tr className="font-bold text-white bg-[#1a2440]">
          <td className={ctd}>Account</td><td className={ctd}>{money(ac, x.campaigns.reduce((a, c) => a + num(c.budget_amount, 0), 0))}</td>
          <td className={ctd}>{ils(toIls(ctot.cost, fxAcc))}</td><td className={ctd}>{n1(ctot.conv)}</td><td className={ctd}>{cur2(ac, ratio(ctot.cost, ctot.conv))}</td>
          <td className={ctd}>{n0(ctot.clicks)}</td><td className={ctd}>{cur2(ac, ratio(ctot.cost, ctot.clicks))}</td><td className={ctd}>{pct(ratio(ctot.conv, ctot.clicks))}</td>
          <td className={ctd} colSpan={3} />
        </tr></tfoot>}
      </table>
    </div>
  );

  const campsTab = !x.hasAcct ? (
    <p className="text-[14px] text-[#94a0bd] m-0">No own Google Ads account yet. When an account named like the others (e.g. <b>thewinnerS.ae {mk}</b>) appears under the manager account, this market links itself and its campaigns, budgets and bids appear here. No code change.</p>
  ) : (
    <div className="flex flex-col gap-3">
      {seasStrip}
      {campCards}
      {campTable}
      <span className="text-[13px] text-[#94a0bd]">Google Ads numbers · Clickouts = the Google Ads conversion · account day · spend in ₪, budget / CPC / target in {ac} (as in Google Ads) · click a campaign to change its budget or bid.</span>
      {x.strategies.length > 0 && (
        <div className={CARD}>
          <h3 className="m-0 text-[15px] font-bold text-white">Shared bid strategies</h3>
          {x.strategies.map(s => {
            const open = sel === `s:${s.strategy_id}`;
            return (
              <div key={s.strategy_id} className="flex flex-col gap-2">
                <button type="button" aria-expanded={open} onClick={() => setSel(open ? null : `s:${s.strategy_id}`)}
                  className={`text-left flex flex-wrap gap-x-4 gap-y-1 items-baseline rounded-lg px-2.5 py-2 hover:bg-white/[.03] ${open ? 'bg-[#1a2440]' : ''}`}>
                  <b className="text-white text-[17px]">{s.target_kind === 'troas' ? roasTxt(s.target_value) : cur2(ac, s.target_value)}</b>
                  <span className="text-sm">{s.target_kind === 'troas' ? 'tROAS' : 'tCPA'}{s.max_cpc != null ? ` · max CPC ${cur2(ac, s.max_cpc)}` : ''}</span>
                  <span className="text-[13px] text-violet-300">{s.name} · {usedBy(s.strategy_id).length} campaigns</span>
                  <span className={`ml-auto text-lg ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>
                </button>
                {open && <div className="flex flex-col gap-2.5"><div className="grid md:grid-cols-2 gap-3">{stratCards(s)}</div>{sharedNote(s)}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div className={CARD}>
        <div className="flex flex-wrap gap-x-3 items-baseline"><h3 className="m-0 text-[15px] font-bold text-white">Orders</h3><span className="text-[13px] text-[#94a0bd]">last 48 h · each change asks once, then shows the result here</span></div>
        {orders.slice(0, 10).map(o => (
          <div key={o.id} className="bg-[#1a2440] rounded-lg px-2.5 py-2 flex flex-col gap-0.5 text-sm">
            <span className={`font-bold ${stateCls(o)}`}>{stateTxt(o)}</span>
            <span>{ilTime(o.requested_at)} · {oWhat(o)} {oVal(o, o.from_value)} → {oVal(o, o.to_value)}</span>
            {o.message && <span className="text-[13px] text-[#94a0bd]">{o.message}</span>}
          </div>
        ))}
        {!orders.length && <span className="text-[13px] text-[#94a0bd]">No orders in the last 48 h.</span>}
        {P.settings.orders_dry_run === true && <span className="text-[13px] text-amber-400">Test mode (orders_dry_run): orders are checked but not written to Google Ads.</span>}
      </div>
    </div>
  );

  return (
    <section className="border-t border-[#33416a] bg-[#0f1730] p-3 sm:p-4 flex flex-col gap-3" aria-label={`${mk} detail`}>
      <div className="text-[14px] text-[#c3cbe0] bg-[#1a2440] rounded-xl px-3.5 py-2 [&_b]:text-white">{why(x)}</div>
      <div className="flex gap-1 flex-wrap" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={dt === k} onClick={() => setDt(k)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border ${dt === k ? 'bg-blue-500/15 border-blue-500 text-white' : 'bg-[#121a2e] border-[#33416a] text-[#c3cbe0]'}`}>{l}</button>
        ))}
      </div>
      {dt === 'camps' ? campsTab : periodTab}
    </section>
  );
}
