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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
}
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
  // Today totals = Amazon's own today report when the job has it (v1.3); else the sum of the hourly cells.
  const tday = status?.amz_today_read_at ? { date: status.amz_today_date ?? null, items: num(status.amz_today_items, 0), rev: num(status.amz_today_revenue, 0) } : null;
  const items = tday ? tday.items : sum('items'), rev = tday ? tday.rev : sum('rev');
  const earn = tday ? (comm == null ? 0 : tday.rev * comm) : sum('earn');
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
    vis: sum('vis'), outs: sum('outs'), items, rev, earn, earnAcct: hasAcct && comm != null ? toAcct(earn) : null,
    earnIls: fxA == null || comm == null ? null : earn * fxA, revIls: fxA == null ? null : rev * fxA, commUnset: comm == null, amzDay,
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

// one confirm request. key = the stepper key to reset after a successful queue.
interface Ask { x: D; kind: OrderKind; from: number; to: number; targetId?: string; name?: string; unit: 'pts' | 'money' | 'roas';
  title: string; moves?: string[]; key: string }

export default function MarketsTab({ adminKey }: { adminKey: string }) {
  const [P, setP] = useState<Pulse | null>(null);
  const [month, setMonth] = useState<{ market: string; rows: Day[] } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [V, setV] = useState({ reg: 'all', prob: true, sleep: false, hide: [] as string[], open: null as string | null, dt: 'today' });
  const [view, setView] = useState<'h' | 'd'>('h');
  const [steps, setSteps] = useState<Record<string, number>>({});     // stepper values: `${market}:${kind}:${id}`
  const [sel, setSel] = useState<Record<string, string | null>>({});  // open campaign (c:<id>) or strategy (s:<id>) per market
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toast, setToast] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout>>();
  const hdr = useMemo(() => ({ 'x-admin-key': adminKey }), [adminKey]);

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem('mp_view') || '{}'); setV(v => ({ ...v, ...s })); } catch { /* storage off */ } }, []);
  const saveV = (n: typeof V) => { setV(n); try { localStorage.setItem('mp_view', JSON.stringify(n)); } catch { /* storage off */ } };
  const say = (t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async (market?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/markets${market ? `?market=${market}` : ''}`, { headers: hdr, cache: 'no-store' });
      if (!res.ok) { setErr(res.status === 401 ? 'Wrong password' : `Load failed (${res.status})`); setLoading(false); return; }
      const j: Pulse = await res.json();
      setP(j); setErr(''); setOrders(j.orders ?? []);
      if (market) setMonth({ market, rows: j.month });
    } catch { setErr('Load failed'); }
    setLoading(false);
  }, [hdr]);
  useEffect(() => { load(); }, [load]);
  const refreshSec = P ? Math.max(60, num(P.settings.panel_refresh_sec, 300)) : 300;
  useEffect(() => { const t = setInterval(() => load(view === 'd' && V.open ? V.open : undefined), refreshSec * 1000); return () => clearInterval(t); }, [load, refreshSec, view, V.open]);
  useEffect(() => { if (view === 'd' && V.open && month?.market !== V.open) load(V.open); }, [view, V.open, month, load]);

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
  if (err && !P) return <p className="text-red-400 text-sm">{err}</p>;
  if (!P) return <p className="text-gray-400 text-sm">Loading markets…</p>;

  const S = (k: string, d: number) => num(P.settings[k], d);
  const shown = (() => {
    let a = data.filter(x => (V.reg === 'all' || x.m.region === V.reg) && !V.hide.includes(x.m.market) && !(V.sleep && x.st === 'asleep'));
    if (V.prob) a = a.slice().sort((p, q) => p.rank - q.rank || (q.spend ?? 0) - (p.spend ?? 0));
    return a;
  })();
  const lastRun = (P.status ?? []).map(s => s.job_last_run).filter(Boolean).sort().pop() ?? null;
  const errs = (P.status ?? []).filter(s => s.job_last_error);
  const ils = data.filter(x => x.m.acct_currency === 'ILS' && x.budget);
  const sp0 = ils.reduce((a, x) => a + (x.spend ?? 0), 0), bt0 = ils.reduce((a, x) => a + (x.budget ?? 0), 0);
  const others = data.filter(x => x.hasAcct && x.m.acct_currency !== 'ILS' && x.budget);
  const earnIls = data.reduce((a, x) => a + (x.earnIls ?? 0), 0);
  const stuck = data.filter(x => x.st === 'stuck').map(x => x.m.market), watch = data.filter(x => x.st === 'watch').map(x => x.m.market);
  const bfDays = Math.ceil((new Date('2026-11-27T00:00:00+02:00').getTime() - Date.now()) / 864e5);
  const regions = ['all', ...Object.keys(REG).filter(r => data.some(x => x.m.region === r))];

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

  return (
    <div className={`${inter.className} flex flex-col gap-4 text-[15px] leading-normal text-[#e8edf7] [font-feature-settings:'tnum']`}>
      {/* sticky filter bar */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 bg-[#0b1020]/95 backdrop-blur border-b border-[#24304d] flex flex-wrap gap-2.5 items-center">
        <div className="flex gap-0.5 bg-[#121a2e] border border-[#33416a] rounded-xl p-1" role="group" aria-label="Region">
          {regions.map(r => (
            <button key={r} type="button" aria-pressed={V.reg === r} onClick={() => saveV({ ...V, reg: r })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${V.reg === r ? 'bg-blue-500/20 text-white ring-1 ring-blue-500' : 'text-[#c3cbe0]'}`}>
              {r === 'all' ? 'All' : REG[r].label}
            </button>
          ))}
        </div>
        {([['prob', 'Problems first'], ['sleep', 'Hide asleep']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={V[k]} onClick={() => saveV({ ...V, [k]: !V[k] })}
            className={`flex items-center gap-2 text-sm rounded-xl px-3 py-1.5 border ${V[k] ? 'border-blue-500 text-white' : 'border-[#33416a] text-[#c3cbe0]'} bg-[#121a2e]`}>
            <i className={`relative w-[30px] h-[18px] rounded-full ${V[k] ? 'bg-blue-500' : 'bg-[#2a3657]'}`}>
              <i className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${V[k] ? 'left-[14px] bg-white' : 'left-0.5 bg-[#94a0bd]'}`} />
            </i>{l}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-[#94a0bd] whitespace-nowrap">
          Israel <b className="text-[#e8edf7]">{ilTime(new Date().toISOString())}</b> · job <b className={errs.length ? 'text-amber-400' : 'text-[#e8edf7]'}>{agoTxt(ageH(lastRun))}</b>
          {errs.length > 0 && <> · errors {errs.map(e => e.market).join(' ')}</>}
          {' '}· <b className="text-[#e8edf7]">{bfDays > 0 ? `Black Friday in ${bfDays} days` : 'Black Friday week'}</b>
          <button type="button" onClick={() => load(view === 'd' && V.open ? V.open : undefined)} disabled={loading}
            className="ml-2 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50">{loading ? '…' : 'Refresh'}</button>
        </span>
        <div className="flex gap-1.5 overflow-x-auto basis-full pb-0.5" role="group" aria-label="Markets to show">
          {data.map(x => {
            const on = !V.hide.includes(x.m.market);
            return (
              <button key={x.m.market} type="button" aria-pressed={on}
                onClick={() => saveV({ ...V, hide: on ? [...V.hide, x.m.market] : V.hide.filter(z => z !== x.m.market) })}
                className={`flex-none flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold border ${on ? 'border-[#c3cbe0] bg-[#1a2440] text-white' : 'border-[#33416a] bg-[#121a2e] text-[#94a0bd]'}`}>
                <b className="w-2 h-2 rounded-full" style={{ background: ST_DOT[x.st] }} />{x.m.market}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Budget used today', bt0 ? pct(sp0 / bt0) : '—', <>₪{n0(sp0)} of ₪{n0(bt0)}{others.map(x => <span key={x.m.market}> · {x.m.market} {money(x.m.acct_currency, x.spend)} of {money(x.m.acct_currency, x.budget)}</span>)}</>, ''],
          ['Amazon earnings today', `≈₪${n0(earnIls)}`, "Amazon's today report · revenue × comm % × FX", 'text-emerald-400'],
          ['Needs a push', stuck.join(' ') || 'none', 'visitors under half of normal', stuck.length ? 'text-red-400' : ''],
          ['Watch quality', watch.join(' ') || 'none', "land but don't click out", watch.length ? 'text-amber-400' : ''],
        ].map(([k, v, s, c], i) => (
          <div key={i} className="bg-[#121a2e] border border-[#24304d] rounded-2xl px-4 py-3.5 flex flex-col gap-1 min-w-0">
            <K>{k}</K><span className={`text-[28px] font-extrabold leading-tight text-white ${c}`}>{v}</span><span className="text-[13px] text-[#94a0bd]">{s}</span>
          </div>
        ))}
      </div>

      {/* board */}
      <div className="bg-[#121a2e] border border-[#24304d] rounded-2xl overflow-hidden" role="list">
        <div className="hidden lg:grid grid-cols-[minmax(170px,1.5fr)_128px_1.1fr_.8fr_1.5fr_1fr_1fr_28px] gap-3.5 items-center px-4 h-10 bg-[#1a2440] border-b border-[#24304d]">
          {['Market', 'Status', 'Visitors 60 min', 'Clickout', 'Budget today', 'Amazon today', 'Net ≈', ''].map((h, i) => <K key={i}>{h}</K>)}
        </div>
        {!shown.length && <div className="px-4 py-5 text-[#94a0bd]">No market matches the filter. Pick a region or tap a market chip above.</div>}
        {shown.map(x => {
          const open = V.open === x.m.market, ac = x.m.acct_currency;
          return (
            <div key={x.m.market} role="listitem">
              <button type="button" aria-expanded={open} onClick={() => saveV({ ...V, open: open ? null : x.m.market })}
                className={`w-full text-left grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(170px,1.5fr)_128px_1.1fr_.8fr_1.5fr_1fr_1fr_28px] gap-x-3.5 gap-y-2.5 items-center px-4 py-3 lg:py-2 lg:min-h-[66px] border-t border-[#24304d] first:border-t-0 hover:bg-white/[.025] ${open ? 'bg-[#1a2440]' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl font-extrabold text-white w-[42px] flex-none">{x.m.market}</span>
                  <span className="flex flex-col min-w-0"><span className="text-sm font-semibold truncate">{x.m.label}</span><span className="text-[13px] text-[#94a0bd]">{pad(x.L.h)}:{pad(x.L.m)} local</span></span>
                </div>
                <span className={`justify-self-end lg:justify-self-start text-[13px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap ${ST_CLS[x.st]}`}>{ST_LABEL[x.st]}</span>
                <div className="col-span-2 lg:col-span-1 grid grid-cols-3 gap-3 lg:contents">
                  <div className="flex flex-col gap-1 min-w-0"><span className="lg:hidden"><K>Visitors 60 min</K></span>
                    <span className="text-[17px] font-bold text-white whitespace-nowrap">{x.v60} <small className="text-[13px] font-medium text-[#94a0bd]">/ {n1(x.n60)} normal</small></span><Pace x={x} /></div>
                  <div className="flex flex-col gap-1 min-w-0"><span className="lg:hidden"><K>Clickout</K></span>
                    <span className={`text-[17px] font-bold whitespace-nowrap ${x.c60 != null && x.c60 < x.judgeCo && x.v60 >= 3 ? 'text-red-400' : 'text-white'}`}>{pct(x.c60)}</span><span className="text-[13px] text-[#94a0bd]">60 min</span></div>
                  <div className="flex flex-col gap-1 min-w-0"><span className="lg:hidden"><K>Budget today</K></span>
                    {x.hasAcct ? <><span className="text-[17px] font-bold text-white whitespace-nowrap">{pct(x.used)} <small className="text-[13px] font-medium text-[#94a0bd]">{money(ac, x.spend)} / {money(ac, x.budget)}</small></span><Bar x={x} /></>
                      : <span className="text-[13px] text-[#94a0bd] border border-dashed border-[#33416a] rounded-lg px-2 py-0.5 self-start whitespace-nowrap">no own Google Ads account</span>}</div>
                </div>
                <div className="hidden lg:flex flex-col gap-1 min-w-0"><span className="text-[17px] font-bold text-white">{n0(x.items)} <small className="text-[13px] font-medium text-[#94a0bd]">items</small></span><span className={`text-[13px] truncate ${x.amzStale ? 'text-amber-400' : 'text-[#94a0bd]'}`}>{money(x.m.currency, x.rev)}{x.earnIls != null ? ` · ≈₪${n0(x.earnIls)}` : ''}{x.amzStale ? ' · read old' : ''}</span>
                  {x.amzDay ? <span className="text-[12px] font-semibold text-amber-400">Amazon day {x.amzDay.slice(8)}/{x.amzDay.slice(5, 7)}</span>
                    : x.commUnset && x.items > 0 ? <span className="text-[12px] font-semibold text-amber-400">Set commission %</span> : null}</div>
                <div className="hidden lg:flex flex-col gap-1 min-w-0"><span className={`text-[17px] font-bold ${x.net == null ? 'text-white' : x.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{signed(ac, x.net)}</span><span className="text-[13px] text-[#94a0bd]">earnings − spend</span></div>
                <span className={`hidden lg:block text-lg transition-transform ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>
              </button>
              {open && <Detail x={x} P={P} view={view} setView={setView} month={month?.market === x.m.market ? month.rows : null}
                orders={orders.filter(o => o.market === x.m.market)} dt={V.dt || 'today'} setDt={t => saveV({ ...V, dt: t })}
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
        Hours = each Google Ads account&apos;s clock. Budget and spend stay in the account currency (never converted); FX only converts Amazon amounts.
        Amazon today = Amazon&apos;s own today report (all tags, read hourly); each hour shows what was added, in the hour it was first seen (late orders go to Amazon&apos;s own day). Earnings ≈ revenue × commission % × FX. Orders: your click + confirm is the GO for that one change; the worker re-checks it, writes it and reads it back.
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
  const btn = 'bg-[#1a2440] border border-[#33416a] rounded-xl text-sm font-semibold text-[#c3cbe0] min-h-[44px] px-2 whitespace-nowrap hover:border-blue-400';
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(46px,auto)_minmax(46px,auto)_minmax(110px,1fr)_minmax(46px,auto)_minmax(46px,auto)] gap-1.5" role="group">
        {steps.slice(0, 2).map(([d, l]) => <button key={d} type="button" className={btn} onClick={() => onStep(d)}>{l}</button>)}
        <output aria-live="polite" className="flex flex-col items-center justify-center bg-[#0b1020] border border-[#33416a] rounded-xl p-1">
          <span className={`text-xl font-extrabold leading-tight ${cls}`}>{value}</span><small className="text-[13px] text-[#c3cbe0]">{small}</small>
        </output>
        {steps.slice(2).map(([d, l]) => <button key={d} type="button" className={btn} onClick={() => onStep(d)}>{l}</button>)}
      </div>
      <button type="button" disabled={!apply} onClick={onApply}
        className="rounded-xl px-3.5 py-2.5 font-bold text-white bg-blue-500 disabled:bg-[#1a2440] disabled:text-[#94a0bd]">{apply ?? 'Pick a change'}</button>
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

function Detail({ x, P, view, setView, month, orders, dt, setDt, steps, setStep, sel, setSel, onAsk, S }: {
  x: D; P: Pulse; view: 'h' | 'd'; setView: (v: 'h' | 'd') => void; month: Day[] | null; orders: Order[]; dt: string; setDt: (t: string) => void;
  steps: Record<string, number>; setStep: (k: string, v: number) => void; sel: string | null; setSel: (v: string | null) => void;
  onAsk: (a: Ask) => void; S: (k: string, d: number) => number;
}) {
  const ac = x.m.acct_currency, mk = x.m.market;
  const st = (k: string) => steps[`${mk}:${k}`] ?? 0;
  const set = (k: string, v: number) => setStep(`${mk}:${k}`, r2(v));
  const pctLim = S('bid_step_pct', 0.5), ptsLim = S('troas_step_pts', 50) / 100, minB = S('bid_min_amount', 0.01), minR = S('troas_min', 0.05);
  const stratOf = (id: string | null) => x.strategies.find(s => s.strategy_id === id) ?? null;
  const usedBy = (id: string) => x.campaigns.filter(c => c.strategy_id === id).map(c => c.name ?? c.campaign_id);
  const tabs: [string, string][] = [['today', 'Today'], ['camps', `Campaigns & bids${x.campaigns.length ? ` (${x.campaigns.length})` : ''}`], ['money', 'Money']];

  // ── Today tab
  const H = view === 'h', ilNow = localNow(IL);
  const dayNormal = x.hours.reduce((a, h) => a + h.norm, 0);
  const rows = H
    ? x.hours.map(h => ({ key: String(h.h), label: pad(h.h) + ':00', il: pad(((h.h - x.L.h + ilNow.h) % 24 + 24) % 24) + ':00', vis: h.vis, norm: h.norm, outs: h.outs,
        cost: h.cost, clicks: h.clicks, items: h.items, rev: h.rev, earn: h.earn, fut: h.fut, now: h.now, lag: h.lag }))
    : (month ?? []).map(d => ({ key: d.local_date, label: d.local_date.slice(5), il: '', vis: num(d.visitors, 0), norm: dayNormal, outs: num(d.clickouts, 0),
        cost: x.hasAcct ? num(d.gads_cost, 0) : null, clicks: num(d.gads_clicks, 0), items: num(d.amz_items, 0), rev: num(d.amz_revenue, 0),
        earn: num(d.amz_earnings, 0), fut: false, now: d.local_date === x.L.date, lag: d.local_date === x.L.date }));
  const T = (k: 'vis' | 'outs' | 'cost' | 'clicks' | 'items' | 'rev' | 'earn') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const td = 'px-2.5 py-1.5 text-right whitespace-nowrap border-b border-[#24304d]';
  const th = 'px-2.5 py-1.5 text-right whitespace-nowrap bg-[#1a2440] text-[#94a0bd] text-xs uppercase tracking-wide font-bold';
  const flag = 'inline-block px-1.5 rounded bg-red-400/15 text-red-400 text-xs font-bold';

  const todayTab = (
    <div className="flex flex-col gap-3.5">
      {x.hasAcct && (
        <div className={CARD}>
          <div className="flex flex-wrap gap-x-3 items-baseline"><h3 className="m-0 text-[15px] font-bold text-white">Daily budget</h3><span className="text-[13px] text-[#94a0bd]">own account {x.m.customer_id} · account day · {ac}</span></div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-2">
            {[['Used', money(ac, x.spend), ''], ['Budget', money(ac, x.budget), ''], ['Left', money(ac, x.budget != null && x.spend != null ? Math.max(0, x.budget - x.spend) : null), ''],
              ['Used %', pct(x.used), x.used != null && x.used >= 1 ? 'text-red-400' : ''], ['Normal by now', pct(x.normBy), 'text-[#94a0bd]']].map(([k, v, c]) => (
              <div key={k} className="flex flex-col min-w-0"><K>{k}</K><span className={`text-[19px] font-bold text-white whitespace-nowrap ${c}`}>{v}</span></div>
            ))}
          </div>
          <Bar x={x} big />
        </div>
      )}
      <div className={CARD}>
        <div className="flex flex-wrap gap-x-3 items-baseline"><h3 className="m-0 text-[15px] font-bold text-white">Today by local hour</h3><span className="text-[13px] text-[#94a0bd]">bars = ad visitors · dashed = normal · strip = clickout rate</span></div>
        <Chart x={x} />
      </div>
      <div className="flex gap-1" role="tablist">
        {(['h', 'd'] as const).map(v => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border ${view === v ? 'bg-blue-500/15 border-blue-500 text-white' : 'bg-[#121a2e] border-[#33416a] text-[#c3cbe0]'}`}>
            {v === 'h' ? 'By hour' : 'This month by day'}</button>
        ))}
      </div>
      {!H && !month && <p className="text-sm text-[#94a0bd]">Loading month…</p>}
      <div className="overflow-x-auto border border-[#24304d] rounded-xl">
        <table className="w-full min-w-[900px] text-sm border-separate border-spacing-0">
          <thead><tr>
            <th className={`${th} text-left sticky left-0 z-10`}>{H ? 'Local' : 'Day'}</th>{H && <th className={th}>IL</th>}
            <th className={`${th} border-l border-[#33416a]`}>Spend {x.hasAcct ? ac : ''}</th><th className={th}>Clicks</th>
            <th className={`${th} border-l border-[#33416a]`}>Visitors</th><th className={th}>Normal</th><th className={th}>Clickouts</th><th className={th}>Rate</th><th className={th}>Cost / clickout</th>
            <th className={`${th} border-l border-[#33416a]`}>Amazon items</th><th className={th}>Revenue {x.m.currency}</th><th className={th}>Net ≈{sym(ac).trim()}</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const rate = r.vis ? (r.outs ?? 0) / r.vis : null;
              const lowV = H && r.vis != null && !r.now && r.norm >= x.stuckMin && r.vis < x.stuckRatio * r.norm;
              const e = x.hasAcct ? x.toAcct(r.earn) : null, net = e != null && r.cost != null ? e - r.cost : null;
              const lag = x.amzStale || r.lag ? 'bg-violet-400/10' : '';
              return (
                <tr key={r.key} className={`${r.fut ? 'opacity-45 text-[#94a0bd]' : ''} ${r.now ? 'bg-yellow-400/10' : ''}`}>
                  <td className={`${td} text-left sticky left-0 bg-[#121a2e]`}>{r.label}</td>{H && <td className={td}>{r.il}</td>}
                  <td className={`${td} border-l border-[#33416a]`}>{x.hasAcct ? n1(r.cost) : '—'}</td><td className={td}>{x.hasAcct ? n0(r.clicks) : '—'}</td>
                  <td className={`${td} border-l border-[#33416a]`}>{n0(r.vis)}</td>
                  <td className={td}>{lowV ? <span className={flag}>{n1(r.norm)}</span> : H ? n1(r.norm) : n0(r.norm)}</td>
                  <td className={td}>{n0(r.outs)}</td>
                  <td className={td}>{rate != null && rate < x.judgeCo && (r.vis ?? 0) >= 4 ? <span className={flag}>{pct(rate)}</span> : pct(rate)}</td>
                  <td className={td}>{r.cost && r.outs ? (r.cost / r.outs).toFixed(2) : '—'}</td>
                  <td className={`${td} border-l border-[#33416a] ${lag}`}>{n0(r.items)}</td><td className={`${td} ${lag}`}>{money(x.m.currency, r.rev)}</td>
                  <td className={`${td} ${net == null ? '' : net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{net == null ? '—' : (net >= 0 ? '+' : '') + Math.round(net)}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className={`${td} text-left sticky left-0 bg-[#1a2440]`}>Total</td>{H && <td className={`${td} bg-[#1a2440]`} />}
              <td className={`${td} bg-[#1a2440] border-l border-[#33416a]`}>{x.hasAcct ? n0(T('cost')) : '—'}</td><td className={`${td} bg-[#1a2440]`}>{x.hasAcct ? n0(T('clicks')) : '—'}</td>
              <td className={`${td} bg-[#1a2440] border-l border-[#33416a]`}>{n0(T('vis'))}</td><td className={`${td} bg-[#1a2440]`}>{H ? `${n0(x.normT)} by now` : '—'}</td>
              <td className={`${td} bg-[#1a2440]`}>{n0(T('outs'))}</td><td className={`${td} bg-[#1a2440]`}>{T('vis') ? pct(T('outs') / T('vis')) : '—'}</td>
              <td className={`${td} bg-[#1a2440]`}>{T('cost') && T('outs') ? (T('cost') / T('outs')).toFixed(2) : '—'}</td>
              <td className={`${td} bg-[#1a2440] border-l border-[#33416a]`}>{n0(T('items'))}</td><td className={`${td} bg-[#1a2440]`}>{money(x.m.currency, T('rev'))}</td>
              <td className={`${td} bg-[#1a2440]`}>{(() => { const e = x.hasAcct ? x.toAcct(T('earn')) : null; return e == null ? '—' : signed(ac, e - T('cost')); })()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[#94a0bd]">
        <span><i className="inline-block w-[11px] h-[11px] rounded-sm mr-1 align-[-1px] bg-yellow-400/20" />current hour</span>
        <span><i className="inline-block w-[11px] h-[11px] rounded-sm mr-1 align-[-1px] bg-violet-400/20" />Amazon still coming in</span>
        <span>Amazon read {agoTxt(x.readAge)}{x.mtd?.last_new_order ? ` · last new order ${ilTime(x.mtd.last_new_order)} IL` : ''}</span>
      </div>
    </div>
  );

  // ── Campaigns & bids tab (full width; owner 11-15: not a side panel)
  const seasNow = x.m.seasonality, sd = st('seas'), nowPts = Math.round(((seasNow ?? 1) - 1) * 1000) / 10;
  // owner 11-15: targets are WHOLE percents; only a step that lands on 0 stops at ±0.1 (Google Ads takes no exact 0%).
  // e.g. now +0.1 → +1 gives +1 (not +1.1); now −1 → +1 gives +0.1; now +0.1 → +5 gives +5.
  const seasStep = (d: number) => {
    const cur = nowPts + sd;
    let t = Math.round(cur + d);
    if (t === 0) t = d > 0 ? 0.1 : -0.1;
    t = clamp(t, Math.max(nowPts - sRange, sFloor), Math.min(nowPts + sRange, sCap));
    set('seas', r2(t - nowPts));
  };
  const sdShown = sd === 0 ? 0 : (nowPts + sd) - Math.round(nowPts);   // the change in whole points, as the owner reads it
  const sRange = S('seas_step_range_pts', 25), sCap = S('seas_cap_pts', 60), sFloor = S('seas_floor_pts', -50);
  const campEditor = (c: Camp) => {
    const b = num(c.budget_amount, 0), bk = `bud:${c.campaign_id}`, bd = st(bk);
    const tk = `tgt:${c.campaign_id}`, tdv = st(tk), t0 = num(c.bid_target, 0);
    const isR = ROAS_TYPES.includes(c.bid_type ?? ''), isC = CPA_TYPES.includes(c.bid_type ?? '');
    const s = stratOf(c.strategy_id);
    return (
      <div className="grid md:grid-cols-2 gap-3.5">
        <div className={CARD}>
          <span className={SUB}>Daily budget · {ac}</span>
          {c.budget_shared ? <span className="text-[13px] text-[#94a0bd]">Shared budget: change it in Google Ads.</span> :
            <Stepper steps={[[-5, '−5'], [-1, '−1'], [1, '+1'], [5, '+5']]} value={bd === 0 ? '±0' : (bd > 0 ? '+' : '') + money(ac, bd)}
              small={`${money(ac, b)} → ${money(ac, b + bd)}`} cls={dCls(bd)}
              onStep={d => set(bk, clamp(bd + d, S('budget_min_amount', 1) - b, (S('budget_max_factor', 3) - 1) * b))}
              apply={bd ? `Apply budget ${money(ac, b)} → ${money(ac, b + bd)}` : null}
              onApply={() => onAsk({ x, kind: 'budget', from: b, to: r2(b + bd), targetId: c.campaign_id, name: c.name ?? '', unit: 'money', title: 'Daily budget', key: `${mk}:${bk}` })} />}
        </div>
        <div className={CARD}>
          {isC && !c.strategy_id && c.bid_target != null ? <>
            <span className={SUB}>Bid target · tCPA · {ac}</span>
            <Stepper steps={CENTS} value={tdv === 0 ? '±0' : (tdv > 0 ? '+' : '−') + cur2(ac, Math.abs(tdv))} small={`${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`} cls={dCls(tdv)}
              onStep={d => set(tk, clamp(tdv + d, Math.max(minB - t0, -pctLim * t0), pctLim * t0))}
              apply={tdv ? `Apply tCPA ${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}` : null}
              onApply={() => onAsk({ x, kind: 'campaign_target', from: t0, to: r2(t0 + tdv), targetId: c.campaign_id, name: c.name ?? '', unit: 'money', title: 'tCPA (bid target)', key: `${mk}:${tk}` })} />
          </> : isR && !c.strategy_id && c.bid_target != null ? <>
            <span className={SUB}>Bid target · tROAS</span>
            <Stepper steps={PTS} value={tdv === 0 ? '±0' : (tdv > 0 ? '+' : '−') + Math.round(Math.abs(tdv) * 100) + ' pts'} small={`${roasTxt(t0)} → ${roasTxt(t0 + tdv)}`} cls={dCls(tdv)}
              onStep={d => set(tk, clamp(tdv + d, Math.max(minR - t0, -ptsLim), ptsLim))}
              apply={tdv ? `Apply tROAS ${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : null}
              onApply={() => onAsk({ x, kind: 'campaign_target', from: t0, to: r2(t0 + tdv), targetId: c.campaign_id, name: c.name ?? '', unit: 'roas', title: 'tROAS (bid target)', key: `${mk}:${tk}` })} />
          </> : c.strategy_id ? <>
            <span className={SUB}>Bid target</span>
            <span className="text-[13px] text-[#c3cbe0]">Comes from the shared strategy <b className="text-violet-300">{s?.name ?? c.strategy_id}</b> (moves {usedBy(c.strategy_id).length}).{' '}
              <button type="button" className="text-blue-400 font-bold" onClick={() => setSel(`s:${c.strategy_id}`)}>Open it ›</button></span>
          </> : <><span className={SUB}>Bid target</span><span className="text-[13px] text-[#94a0bd]">{c.bid_type === 'TARGET_SPEND' ? 'Maximize clicks: no target to change.' : 'No target the panel can change.'}</span></>}
        </div>
      </div>
    );
  };
  const stratEditor = (s: Strat) => {
    const uses = usedBy(s.strategy_id), t0 = num(s.target_value, 0), tk = `str:${s.strategy_id}`, tdv = st(tk);
    const ck = `cpc:${s.strategy_id}`, cdv = st(ck), c0 = num(s.max_cpc, 0), isR = s.target_kind === 'troas';
    const nC = `${uses.length} campaign${uses.length > 1 ? 's' : ''}`;
    return (
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-[#94a0bd]">Moves <b className="text-[#e8edf7]">{nC}</b>: {uses.join(' · ') || '—'} · the name is the label in Google Ads; values are live.</span>
        <div className="grid md:grid-cols-2 gap-3.5">
          <div className={CARD}>
            <span className={SUB}>{isR ? 'tROAS' : `tCPA · ${ac}`}</span>
            {s.target_value == null ? <span className="text-[13px] text-[#94a0bd]">No target set.</span> :
              <Stepper steps={isR ? PTS : CENTS} cls={dCls(tdv)}
                value={tdv === 0 ? '±0' : isR ? (tdv > 0 ? '+' : '−') + Math.round(Math.abs(tdv) * 100) + ' pts' : (tdv > 0 ? '+' : '−') + cur2(ac, Math.abs(tdv))}
                small={isR ? `${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : `${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`}
                onStep={d => set(tk, isR ? clamp(tdv + d, Math.max(minR - t0, -ptsLim), ptsLim) : clamp(tdv + d, Math.max(minB - t0, -pctLim * t0), pctLim * t0))}
                apply={tdv ? `Apply ${isR ? `tROAS ${roasTxt(t0)} → ${roasTxt(t0 + tdv)}` : `tCPA ${cur2(ac, t0)} → ${cur2(ac, t0 + tdv)}`} (${nC})` : null}
                onApply={() => onAsk({ x, kind: 'strategy_target', from: t0, to: r2(t0 + tdv), targetId: s.strategy_id, name: s.name ?? '', unit: isR ? 'roas' : 'money',
                  title: isR ? 'Shared tROAS' : 'Shared tCPA', moves: uses, key: `${mk}:${tk}` })} />}
          </div>
          <div className={CARD}>
            <span className={SUB}>Max CPC (bid limit) · {ac}</span>
            {s.max_cpc == null ? <span className="text-[13px] text-[#94a0bd]">No bid limit set on this strategy.</span> :
              <Stepper steps={CENTS} cls={dCls(cdv)} value={cdv === 0 ? '±0' : (cdv > 0 ? '+' : '−') + cur2(ac, Math.abs(cdv))}
                small={`${cur2(ac, c0)} → ${cur2(ac, c0 + cdv)}`}
                onStep={d => set(ck, clamp(cdv + d, Math.max(minB - c0, -pctLim * c0), pctLim * c0))}
                apply={cdv ? `Apply max CPC ${cur2(ac, c0)} → ${cur2(ac, c0 + cdv)} (${nC})` : null}
                onApply={() => onAsk({ x, kind: 'strategy_max_cpc', from: c0, to: r2(c0 + cdv), targetId: s.strategy_id, name: s.name ?? '', unit: 'money',
                  title: 'Shared max CPC (bid limit)', moves: uses, key: `${mk}:${ck}` })} />}
          </div>
        </div>
      </div>
    );
  };
  const bidLabel = (c: Camp) => c.strategy_id ? `shared · ${stratOf(c.strategy_id)?.target_kind === 'tcpa' ? 'tCPA' : 'tROAS'}`
    : CPA_TYPES.includes(c.bid_type ?? '') ? 'tCPA' : ROAS_TYPES.includes(c.bid_type ?? '') ? 'tROAS' : c.bid_type === 'TARGET_SPEND' ? 'Max clicks' : (c.bid_type ?? '—').toLowerCase().replace(/_/g, ' ');
  const targetLabel = (c: Camp) => {
    const s = stratOf(c.strategy_id);
    if (s) return s.target_kind === 'troas' ? roasTxt(s.target_value) : cur2(ac, s.target_value);
    return c.bid_target == null ? '—' : ROAS_TYPES.includes(c.bid_type ?? '') ? roasTxt(c.bid_target) : cur2(ac, c.bid_target);
  };
  const rowCls = 'w-full text-left grid gap-x-3 gap-y-1 items-center px-3.5 py-2.5 border-t border-[#24304d] hover:bg-white/[.03]';
  const cGrid = 'grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.4fr)_1.2fr_.8fr_.9fr_1.3fr_22px]';
  const sGrid = 'grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.4fr)_.8fr_.8fr_.9fr_1.1fr_22px]';
  const stateTxt = (o: Order) => o.status === 'queued' ? 'Sending…' : o.status === 'running' ? 'Working…' : o.status === 'done' ? '✓ Done' : o.status === 'expired' ? '✗ Expired' : '✗ Not applied';
  const stateCls = (o: Order) => o.status === 'done' ? 'text-emerald-400' : o.status === 'queued' || o.status === 'running' ? 'text-blue-400' : 'text-red-400';
  const oVal = (o: Order, v: number) => o.kind === 'seasonality' ? sp((v - 1) * 100) : o.kind === 'budget' ? money(ac, v)
    : (o.kind === 'strategy_max_cpc' ? cur2(ac, v) : (ROAS_TYPES.includes(o.target_type ?? '') ? roasTxt(v) : cur2(ac, v)));
  const oWhat = (o: Order) => o.kind === 'seasonality' ? 'seasonality' : o.kind === 'budget' ? `${o.target_name} · budget`
    : o.kind === 'campaign_target' ? `${o.target_name} · target` : o.kind === 'strategy_target' ? `${o.target_name} · shared target` : `${o.target_name} · max CPC`;

  const campsTab = !x.hasAcct ? (
    <p className="text-[14px] text-[#94a0bd] m-0">No own Google Ads account yet. When an account named like the others (e.g. <b>thewinnerS.ae {mk}</b>) appears under the manager account, this market links itself and its campaigns, budgets and bids appear here. No code change.</p>
  ) : (
    <div className="flex flex-col gap-3.5">
      {/* seasonality strip */}
      <div className="bg-[#121a2e] border border-[#24304d] rounded-xl p-3 grid md:grid-cols-[minmax(170px,1fr)_minmax(280px,1.6fr)] gap-3 items-center">
        <div className="flex flex-col"><K>Account seasonality</K><b className="text-[26px] font-extrabold text-white">{seasNow == null ? 'none active' : sp(nowPts)}</b>
          {seasNow != null && <span className="text-[13px] text-[#94a0bd]">range {sp(Math.max(nowPts - sRange, sFloor))} … {sp(Math.min(nowPts + sRange, sCap))}</span>}</div>
        {seasNow != null && <Stepper steps={[[-5, '−5'], [-1, '−1'], [1, '+1'], [5, '+5']]} value={sd === 0 ? '±0' : sp(sdShown)} small={`new ${sp(nowPts + sd)}`} cls={dCls(sd)}
          onStep={seasStep}
          apply={sd ? `Apply seasonality ${sp(nowPts)} → ${sp(nowPts + sd)}` : null}
          onApply={() => onAsk({ x, kind: 'seasonality', from: seasNow, to: Math.round((1 + (nowPts + sd) / 100) * 1000) / 1000, unit: 'pts', title: 'Seasonality', key: `${mk}:seas` })} />}
      </div>
      {/* campaigns */}
      <div className="bg-[#121a2e] border border-[#24304d] rounded-xl overflow-hidden" role="list">
        <div className={`hidden md:grid ${cGrid} gap-x-3 px-3.5 py-2 bg-[#1a2440]`}>{[`Campaign · ${x.campaigns.length} enabled`, 'Bidding', 'Target', 'Budget / day', 'Spent today', ''].map((h, i) => <K key={i}>{h}</K>)}</div>
        {x.campaigns.map(c => {
          const open = sel === `c:${c.campaign_id}`, b = num(c.budget_amount, 0), s = num(c.spend_today, 0);
          return (
            <div key={c.campaign_id} role="listitem">
              <button type="button" aria-expanded={open} onClick={() => setSel(open ? null : `c:${c.campaign_id}`)} className={`${rowCls} ${cGrid} ${open ? 'bg-[#1a2440]' : ''}`}>
                <span className="col-span-2 md:col-span-1 font-semibold truncate">{c.name}</span>
                <span className={c.strategy_id ? 'text-violet-300 text-sm' : 'text-sm'}>{bidLabel(c)}</span>
                <span className="font-bold text-white whitespace-nowrap">{targetLabel(c)}</span>
                <span className="font-bold text-white whitespace-nowrap">{money(ac, b)}</span>
                <span className="flex flex-col gap-1 text-sm text-[#c3cbe0] whitespace-nowrap">{money(ac, s)} · {pct(b ? s / b : null)}
                  <span className="relative h-1.5 rounded-full bg-[#2a3657]"><i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(b ? s / b : 0, 1) * 100}%`, background: s >= b ? '#f87171' : '#3b82f6' }} /></span></span>
                <span className={`hidden md:block text-lg ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>
              </button>
              {open && <div className="bg-[#0f1730] border-t border-[#33416a] p-3.5">{campEditor(c)}</div>}
            </div>
          );
        })}
        {!x.campaigns.length && <div className="px-3.5 py-3 text-[13px] text-[#94a0bd]">Campaign list appears after the next job run.</div>}
      </div>
      {/* shared strategies */}
      {x.strategies.length > 0 && (
        <div className="bg-[#121a2e] border border-[#24304d] rounded-xl overflow-hidden" role="list">
          <div className={`hidden md:grid ${sGrid} gap-x-3 px-3.5 py-2 bg-[#1a2440]`}>{['Shared bid strategy · name in Google Ads', 'Type', 'Target', 'Max CPC', 'Moves', ''].map((h, i) => <K key={i}>{h}</K>)}</div>
          {x.strategies.map(s => {
            const open = sel === `s:${s.strategy_id}`, n = usedBy(s.strategy_id).length;
            return (
              <div key={s.strategy_id} role="listitem">
                <button type="button" aria-expanded={open} onClick={() => setSel(open ? null : `s:${s.strategy_id}`)} className={`${rowCls} ${sGrid} ${open ? 'bg-[#1a2440]' : ''}`}>
                  <span className="col-span-2 md:col-span-1 font-semibold text-violet-300 truncate">{s.name}</span>
                  <span className="text-sm">{s.target_kind === 'troas' ? 'tROAS' : 'tCPA'}</span>
                  <span className="font-bold text-white whitespace-nowrap">{s.target_kind === 'troas' ? roasTxt(s.target_value) : cur2(ac, s.target_value)}</span>
                  <span className="font-bold text-white whitespace-nowrap">{s.max_cpc != null ? cur2(ac, s.max_cpc) : '—'}</span>
                  <span className="text-sm">{n} campaign{n === 1 ? '' : 's'}</span>
                  <span className={`hidden md:block text-lg ${open ? 'rotate-90 text-white' : 'text-[#94a0bd]'}`} aria-hidden>›</span>
                </button>
                {open && <div className="bg-[#0f1730] border-t border-[#33416a] p-3.5">{stratEditor(s)}</div>}
              </div>
            );
          })}
        </div>
      )}
      {/* orders */}
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

  // ── Money tab
  const moneyTab = (
    <div className={CARD}>
      <div className="flex flex-wrap gap-x-3 items-baseline"><h3 className="m-0 text-[15px] font-bold text-white">Money</h3>
        <span className="text-[13px] text-[#94a0bd]">Amazon {x.m.currency}{x.fxA != null ? ` · ${x.fxA < 0.1 ? `${x.m.currency} 100 = ₪${(x.fxA * 100).toFixed(2)}` : `${x.m.currency} 1 = ₪${x.fxA.toFixed(2)}`}` : ''}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
        {[['Amazon today', `${n0(x.items)} items`, ''], ['Revenue', `${money(x.m.currency, x.rev)}${x.revIls != null && x.m.currency !== 'ILS' ? ` ≈₪${n0(x.revIls)}` : ''}`, ''],
          ['Earnings ≈', x.commUnset ? 'Set comm %' : x.earnIls != null ? '₪' + n0(x.earnIls) : '—', x.commUnset ? 'text-amber-400' : 'text-emerald-400'],
          ['Net ≈', signed(ac, x.net), x.net == null ? '' : x.net >= 0 ? 'text-emerald-400' : 'text-red-400'],
          ['Comm set', x.m.comm_rate != null ? (x.m.comm_rate * 100).toFixed(1) + '%' : 'unset', ''],
          ['Actual this month', x.act != null ? (x.act * 100).toFixed(1) + '%' : '—', x.act != null && x.m.comm_rate != null && Math.abs(x.act - x.m.comm_rate) >= 0.005 ? 'text-amber-400' : ''],
        ].map(([k, v, c]) => <div key={k} className="flex flex-col min-w-0"><K>{k}</K><span className={`text-[19px] font-bold text-white whitespace-nowrap ${c}`}>{v}</span></div>)}
      </div>
      <span className="text-[13px] text-[#94a0bd]">
        {x.commUnset ? `No commission % on the ${x.m.market} market row yet, so no ₪ estimate.`
          : `Earnings ≈ revenue ${money(x.m.currency, x.rev)} × ${(num(x.m.comm_rate, 0) * 100).toFixed(2)}% × FX = ₪${n0(x.earnIls)}. Amazon's today report has no earnings, so this is an estimate.`}
        {x.amzDay ? ` Amazon is on ${x.amzDay} (its own day).` : ''}</span>
      {x.mtd && <span className="text-[13px] text-[#94a0bd]">This month (Amazon&apos;s own month-to-date, ads tags): {n0(x.mtd.items)} items · {money(x.m.currency, x.mtd.revenue)} · earnings {money(x.m.currency, x.mtd.earnings)}</span>}
      {x.status?.job_last_error && <span className="text-[13px] text-amber-400">Last job error: {x.status.job_last_error}</span>}
    </div>
  );

  return (
    <section className="border-t border-[#33416a] bg-[#0f1730] p-4 flex flex-col gap-3.5" aria-label={`${mk} detail`}>
      <div className="text-[15px] text-[#c3cbe0] bg-[#1a2440] rounded-xl px-3.5 py-2.5 [&_b]:text-white">{why(x)}</div>
      <div className="flex gap-1 flex-wrap" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={dt === k} onClick={() => setDt(k)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border ${dt === k ? 'bg-blue-500/15 border-blue-500 text-white' : 'bg-[#121a2e] border-[#33416a] text-[#c3cbe0]'}`}>{l}</button>
        ))}
      </div>
      {dt === 'camps' ? campsTab : dt === 'money' ? moneyTab : todayTab}
    </section>
  );
}
