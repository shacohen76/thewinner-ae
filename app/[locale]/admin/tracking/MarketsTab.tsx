'use client';
// ============================================
// Admin "Markets" tab — Market Pulse panel (2026-11-15, step 4)
// ============================================
// Per active market: hourly ad-visitor pace vs the normal week (same local hour),
// clickout rate, Google Ads spend / clicks / conv and today's budget (ACCOUNT
// currency, never converted), Amazon items / revenue / earnings, net, and the
// month by day. Data: /api/admin/markets → admin_market_pulse() (GROUP BY in DB).
//
// Code once (owner 11-14): markets, thresholds, refresh pace, FX and commission
// rates are Supabase rows (pulse_markets / pulse_settings / pulse_fx). Nothing
// market-specific is hard-coded here.
// Clock (owner 11-14): every market uses its Google Ads ACCOUNT time zone. Amazon
// is counted in the hour the job first SAW a new order (not Amazon's own clock).
// Amazon freshness (Manager 6.9 / PS 14): shaded when the worker's last read is
// older than the amazon_lag_h setting.
// ============================================
import { useState, useEffect, useCallback, Fragment } from 'react';

type Json = Record<string, unknown>;
interface Mkt {
  market: string; label: string; region: string; tz: string; customer_id: string | null;
  account_name: string | null; acct_currency: string | null; budget_today: number | null;
  budget_date: string | null; seasonality: number | null; currency: string | null;
  comm_rate: number | null; amazon_program: string | null; overrides: Json | null;
}
interface Hour {
  market: string; local_date: string; local_hour: number; gads_cost: number | null; gads_clicks: number | null;
  gads_conv: number | null; visitors: number | null; clickouts: number | null; amz_items: number | null;
  amz_revenue: number | null; amz_earnings: number | null;
}
type Day = Omit<Hour, 'market' | 'local_hour'>;
interface Base { market: string; local_hour: number; normal: number | null; normal_cost?: number | null }
interface Fx { currency: string; to_ils: number }
interface Comm { program: string; rate: number | null }
interface AmzMtd { market: string; items: number | null; revenue: number | null; earnings: number | null; last_new_order: string | null }
interface Status { market: string; job_last_run: string | null; job_last_error: string | null; amazon_last_read: string | null }
interface Pulse {
  generated_at: string; settings: Json; markets: Mkt[]; unmatched_accounts: { customer_id: string; account_name: string | null }[];
  today: Hour[]; baseline: Base[]; month: Day[]; fx: Fx[]; comm_actual: Comm[]; amazon_mtd?: AmzMtd[]; status?: Status[];
}

const REGION: Record<string, { label: string; text: string; card: string }> = {
  gulf:     { label: '🇦🇪 Gulf',         text: 'text-emerald-300', card: 'bg-emerald-950/30 border-emerald-900/60' },
  europe:   { label: '🇪🇺 Europe',       text: 'text-blue-300',    card: 'bg-blue-950/30 border-blue-900/60' },
  americas: { label: '🌎 Americas',      text: 'text-purple-300',  card: 'bg-purple-950/30 border-purple-900/60' },
  apac:     { label: '🌏 Asia-Pacific',  text: 'text-amber-300',   card: 'bg-amber-950/30 border-amber-900/60' },
  other:    { label: 'Other',            text: 'text-gray-300',    card: 'bg-gray-900 border-gray-800' },
};
const SYM: Record<string, string> = { ILS: '₪', USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', JPY: '¥', BRL: 'R$', SGD: 'S$' };
const sym = (c: string | null | undefined) => (c ? SYM[c] ?? c + ' ' : '');
const n0 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));
const n1 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1));
const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%');
const money = (c: string | null | undefined, v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : sym(c) + n0(v));
const pad = (n: number) => String(n).padStart(2, '0');
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : v == null ? d : Number(v));
const IL = 'Asia/Jerusalem';

function localNow(tz: string, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '0';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, h: Number(g('hour')) % 24, m: Number(g('minute')) };
}
const ago = (iso: string | null | undefined) => {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3.6e6;
};
const agoTxt = (h: number | null) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min ago` : `${h.toFixed(1)} h ago`);
const ilTime = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: IL, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—');

type St = 'flowing' | 'stuck' | 'watch' | 'waking' | 'asleep';
const ST_LABEL: Record<St, string> = { flowing: 'Flowing', stuck: 'Stuck', watch: 'Watch quality', waking: 'Waking', asleep: 'Asleep' };
const ST_CLS: Record<St, string> = {
  flowing: 'bg-emerald-900/50 text-emerald-300', stuck: 'bg-red-900/50 text-red-300', watch: 'bg-amber-900/50 text-amber-300',
  waking: 'bg-gray-700/60 text-gray-300', asleep: 'bg-gray-700/60 text-gray-400',
};

interface HourRow { h: number; vis: number | null; norm: number; outs: number | null; cost: number | null; clicks: number | null;
  conv: number | null; items: number | null; rev: number | null; earn: number | null; now: boolean; fut: boolean; lag: boolean }

function derive(m: Mkt, P: Pulse) {
  const S = (k: string, d: number) => num((m.overrides as Json | null)?.[k] ?? P.settings[k], d);
  const L = localNow(m.tz);
  const rows = P.today.filter(r => r.market === m.market);
  const base = P.baseline.filter(b => b.market === m.market);
  const byH = new Map(rows.map(r => [r.local_hour, r]));
  const bH = new Map(base.map(b => [b.local_hour, b]));
  const lagH = S('amazon_lag_h', 3);
  const hours: HourRow[] = Array.from({ length: 24 }, (_, h) => {
    const r = byH.get(h); const fut = h > L.h;
    return {
      h, fut, now: h === L.h, lag: !fut && h > L.h - lagH,
      vis: fut ? null : r?.visitors ?? 0, outs: fut ? null : r?.clickouts ?? 0,
      norm: num(bH.get(h)?.normal, 0), cost: fut ? null : num(r?.gads_cost, 0), clicks: fut ? null : num(r?.gads_clicks, 0),
      conv: fut ? null : num(r?.gads_conv, 0), items: fut ? null : num(r?.amz_items, 0), rev: fut ? null : num(r?.amz_revenue, 0),
      earn: fut ? null : num(r?.amz_earnings, 0),
    };
  });
  const sum = (k: keyof HourRow) => hours.reduce((a, x) => a + (typeof x[k] === 'number' ? (x[k] as number) : 0), 0);
  const spend = sum('cost');
  const budget = m.budget_date === L.date ? num(m.budget_today, 0) : null;
  const used = budget ? spend / budget : null;
  // "Normal by now" = share of a normal day's spend gone by this local time (normal week, same account clock)
  const nc = (h: number) => num(bH.get(h)?.normal_cost, 0);
  const totC = Array.from({ length: 24 }, (_, h) => nc(h)).reduce((a, b) => a + b, 0);
  let by = 0; for (let h = 0; h < L.h; h++) by += nc(h); by += nc(L.h) * L.m / 60;
  const normBy = totC > 0 ? by / totC : null;
  // last 60 minutes: this hour so far + the tail of the previous hour (same for normal)
  const w = 1 - L.m / 60; const prev = hours[L.h - 1];
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
  const fxA = fx(m.currency), fxAcc = fx(m.acct_currency);
  const toAcct = (amz: number | null) => (amz == null || fxA == null || fxAcc == null ? null : (amz * fxA) / fxAcc);
  const earn = sum('earn');
  const status = P.status?.find(s => s.market === m.market) ?? null;
  const readAge = ago(status?.amazon_last_read);
  const act = P.comm_actual.find(c => c.program === m.amazon_program)?.rate ?? null;
  return {
    m, L, hours, spend, budget, used, normBy, v60, o60, n60, c60, st, fxA, fxAcc, toAcct,
    clicks: sum('clicks'), conv: sum('conv'), vis: sum('vis'), outs: sum('outs'), items: sum('items'), rev: sum('rev'), earn,
    earnAcct: toAcct(earn), earnIls: fxA == null ? null : earn * fxA,
    amzStale: readAge == null || readAge > lagH, readAge, lagH, status, act,
    mtd: P.amazon_mtd?.find(a => a.market === m.market) ?? null,
    judgeCo: S('watch_clickout', 0.2), stuckRatio: S('stuck_ratio', 0.5), stuckMin: S('stuck_min_normal', 2),
    aheadPts: S('budget_ahead_pts', 0.2),
  };
}
type D = ReturnType<typeof derive>;

const barCls = (x: D) => (x.used == null ? 'bg-gray-600' : x.used >= 1 ? 'bg-red-400' : x.normBy != null && x.used - x.normBy > x.aheadPts ? 'bg-amber-400' : 'bg-blue-500');
const usedCls = (x: D) => (x.used == null ? '' : x.used >= 1 ? 'text-red-400' : x.normBy != null && x.used - x.normBy > x.aheadPts ? 'text-amber-400' : '');

function BudgetBar({ x, big }: { x: D; big?: boolean }) {
  return (
    <div className={`relative rounded bg-gray-700/70 ${big ? 'h-3' : 'h-[7px]'}`} role="img"
      aria-label={`Budget ${pct(x.used)} used; normally ${pct(x.normBy)} by this hour`}>
      <i className={`absolute inset-y-0 left-0 rounded ${barCls(x)}`} style={{ width: `${Math.min(x.used ?? 0, 1) * 100}%` }} />
      {x.normBy != null && <span className="absolute -top-[3px] -bottom-[3px] w-0.5 -ml-px rounded bg-gray-200" style={{ left: `${x.normBy * 100}%` }} />}
    </div>
  );
}

function Spark({ x }: { x: D }) {
  const W = 240, H = 46, mx = Math.max(1, ...x.hours.map(h => Math.max(h.norm, h.vis ?? 0)));
  const X = (h: number) => (h / 23) * (W - 6) + 3, Y = (v: number) => H - 4 - (v / mx) * (H - 10);
  const nl = x.hours.map(h => `${X(h.h).toFixed(1)},${Y(h.norm).toFixed(1)}`).join(' ');
  const act = x.hours.filter(h => h.vis != null);
  const line = act.map(h => `${X(h.h).toFixed(1)},${Y(h.vis ?? 0).toFixed(1)}`).join(' ');
  const e = act[act.length - 1];
  return (
    <svg className="block w-full h-[46px]" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Visitors per local hour vs normal">
      <line x1="3" x2={W - 3} y1={H - 4} y2={H - 4} stroke="#374151" strokeWidth="1" />
      <polyline points={nl} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="3 3" />
      {act.length > 1 && <polygon points={`${X(act[0].h)},${H - 4} ${line} ${X(e.h)},${H - 4}`} fill="rgba(59,130,246,.22)" />}
      <polyline points={line} fill="none" stroke="#60a5fa" strokeWidth="1.7" />
      {e && <circle cx={X(e.h)} cy={Y(e.vis ?? 0)} r="2.8" fill="#93c5fd" />}
    </svg>
  );
}

function hint(x: D) {
  const t = pad(x.L.h) + ':00';
  if (x.st === 'stuck') return <><b className="text-gray-200">{Math.round((x.v60 / Math.max(x.n60, 1)) * 100)}% of normal</b> visitors for {t}</>;
  if (x.st === 'watch') return <>Visitors land, <b className="text-gray-200">only {pct(x.c60)} click out</b> (60 min)</>;
  if (x.st === 'waking') return <>Morning ramp, judged later in the day</>;
  if (x.st === 'asleep') return <>Local night, nothing to judge</>;
  return <>Normal pace for {t}, clickout {pct(x.c60)}</>;
}

function Card({ x, on, onClick }: { x: D; on: boolean; onClick: () => void }) {
  const r = REGION[x.m.region] ?? REGION.other;
  const net = x.earnAcct == null ? null : x.earnAcct - x.spend;
  const ac = x.m.acct_currency;
  const actOff = x.act != null && x.m.comm_rate != null && Math.abs(x.act - x.m.comm_rate) >= 0.005;
  return (
    <button type="button" onClick={onClick}
      className={`text-left rounded-xl border p-3 flex flex-col gap-2 min-w-0 hover:brightness-125 ${r.card} ${on ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[17px] font-extrabold text-white">{x.m.market}</span>
        <span className="font-mono text-xs text-gray-400">{pad(x.L.h)}:{pad(x.L.m)} local</span>
        <span className={`ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${ST_CLS[x.st]}`}>{ST_LABEL[x.st]}</span>
      </div>
      <Spark x={x} />
      <div className="text-xs text-gray-400 min-h-[18px]">{hint(x)}</div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-2 text-[11.5px] text-gray-400 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Budget today</span>
          <span className="font-mono"><b className="text-gray-200">{money(ac, x.spend)}</b> of {money(ac, x.budget)} · <b className={usedCls(x)}>{pct(x.used)}</b></span>
        </div>
        <BudgetBar x={x} />
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
        {[
          ['Visitors 60m', <>{x.v60} <span className="text-gray-500">/ {n1(x.n60)}</span></>],
          ['Clickout 60m', <span className={x.c60 != null && x.c60 < x.judgeCo && x.v60 >= 3 ? 'text-red-400' : ''}>{pct(x.c60)}</span>],
          ['Seasonality', x.m.seasonality != null ? `×${Number(x.m.seasonality).toFixed(2)}` : '×1.00'],
          ['Clicks', n0(x.clicks)],
          ['Amazon', <span className={x.amzStale ? 'text-gray-500' : ''}>{n0(x.items)} · {money(x.m.currency, x.rev)}</span>],
          ['Net ≈' + sym(ac).trim(), <span className={net == null ? '' : net >= 0 ? 'text-emerald-400' : 'text-red-400'}>{net == null ? '—' : (net >= 0 ? '+' : '') + n0(net)}</span>],
        ].map(([k, v], i) => (
          <div key={i} className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">{k}</span>
            <span className="font-mono text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{v}</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-gray-500 border-t border-dashed border-gray-700 pt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
        <span>GAds {x.m.customer_id ?? 'no account'}</span>
        {x.fxA != null && <span>Amazon {x.fxA < 0.1 ? `${x.m.currency} 100 = ₪${(x.fxA * 100).toFixed(2)}` : `${x.m.currency} 1 = ₪${x.fxA.toFixed(2)}`}</span>}
        <span>Comm {x.m.comm_rate != null ? (x.m.comm_rate * 100).toFixed(1) + '%' : 'unset'} · actual <span className={actOff ? 'text-amber-400' : ''}>{x.act != null ? (x.act * 100).toFixed(1) + '%' : '—'}</span></span>
        <span className={x.amzStale ? 'text-amber-400' : ''}>Amazon read {agoTxt(x.readAge)}</span>
      </div>
    </button>
  );
}

function Chart({ x }: { x: D }) {
  const W = 720, top = 8, bh = 96, sy = top + bh + 10, sh = 14, L = 30, H = 150;
  const mx = Math.max(1, ...x.hours.map(h => Math.max(h.norm, h.vis ?? 0)));
  const slot = (W - L - 6) / 24, bw = slot * 0.62, Y = (v: number) => top + bh - (v / mx) * bh;
  const step = mx > 10 ? Math.ceil(mx / 3 / 5) * 5 : Math.max(1, Math.ceil(mx / 3));
  const grid: number[] = []; for (let v = step; v <= mx; v += step) grid.push(v);
  return (
    <svg className="block w-full h-auto" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Ad visitors per local hour against normal, with clickout rate per hour">
      <line x1={L} x2={W - 6} y1={top + bh} y2={top + bh} stroke="#374151" />
      {grid.map(v => (
        <Fragment key={v}>
          <line x1={L} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="#1f2937" />
          <text x={L - 5} y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill="#6b7280">{v}</text>
        </Fragment>
      ))}
      {x.hours.map(h => {
        const cx = L + h.h * slot + slot / 2;
        const low = h.vis != null && h.norm >= x.stuckMin && h.vis < x.stuckRatio * h.norm && !h.now;
        const c = h.vis ? (h.outs ?? 0) / h.vis : null;
        const col = c == null ? '#1f2937' : c < x.judgeCo ? '#f87171' : c < 0.35 ? '#fbbf24' : '#34d399';
        return (
          <g key={h.h}>
            {h.now && <rect x={L + h.h * slot} y={top} width={slot} height={sy + sh - top} fill="rgba(250,204,21,.08)" />}
            {h.vis != null && <rect x={cx - bw / 2} y={Y(h.vis)} width={bw} height={top + bh - Y(h.vis)} rx="2" fill={low ? '#f87171' : '#3b82f6'} opacity={h.now ? 0.6 : 0.9} />}
            <line x1={cx - slot / 2 + 2} x2={cx + slot / 2 - 2} y1={Y(h.norm)} y2={Y(h.norm)} stroke="#d1d5db" strokeWidth="1.4" strokeDasharray="3 2" />
            <rect x={L + h.h * slot + 1} y={sy} width={slot - 2} height={sh} rx="2" fill={col} opacity={c == null ? 1 : 0.85} />
            {c != null && <text x={cx} y={sy + 10.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#111827">{Math.round(c * 100)}</text>}
            {h.h % 3 === 0 && <text x={cx} y={sy + sh + 13} textAnchor="middle" fontSize="10" fill="#9ca3af">{pad(h.h)}</text>}
          </g>
        );
      })}
      <text x={L - 5} y={sy + 10.5} textAnchor="end" fontSize="9.5" fill="#9ca3af">CO%</text>
    </svg>
  );
}

function why(x: D) {
  const u = pct(x.used);
  if (x.st === 'stuck' && x.used != null && x.used >= 0.9) return <><b>Stuck:</b> {x.v60} visitors in 60 min vs {n1(x.n60)} normal at this local hour, and <b>{u} of today&apos;s budget is already used</b>. The limit looks like the budget, not seasonality.</>;
  if (x.st === 'stuck') return <><b>Stuck:</b> {x.v60} visitors in 60 min vs {n1(x.n60)} normal at this local hour. Budget {u} used, so the budget is not the limit.</>;
  if (x.st === 'watch') return <><b>Watch quality:</b> visitors at normal pace but only {pct(x.c60)} click out in 60 min. Check landing pages and search terms before any push.</>;
  if (x.st === 'waking') return <><b>Morning ramp:</b> compared only with the same local hour; judged later.</>;
  if (x.st === 'asleep') return <><b>Local night:</b> nothing to judge.</>;
  if (x.used != null && x.used >= 1) return <><b>Flowing, budget used up:</b> {u} of today&apos;s budget spent at {pad(x.L.h)}:{pad(x.L.m)} local. Ads can stop for the rest of the day.</>;
  return <><b>Flowing:</b> normal pace for this local hour, clickout {pct(x.c60)}.</>;
}

export default function MarketsTab({ adminKey }: { adminKey: string }) {
  const [P, setP] = useState<Pulse | null>(null);
  const [month, setMonth] = useState<{ market: string; rows: Day[] } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<'h' | 'd'>('h');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (market?: string) => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/admin/markets?key=${encodeURIComponent(adminKey)}${market ? `&market=${market}` : ''}`, { cache: 'no-store' });
      if (!res.ok) { setErr(res.status === 401 ? 'Wrong password' : `Load failed (${res.status})`); setLoading(false); return; }
      const j: Pulse = await res.json();
      setP(j);
      if (market) setMonth({ market, rows: j.month });
    } catch { setErr('Load failed'); }
    setLoading(false);
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);
  const refreshSec = P ? Math.max(60, num(P.settings.panel_refresh_sec, 300)) : 300;
  useEffect(() => {
    const t = setInterval(() => load(view === 'd' && sel ? sel : undefined), refreshSec * 1000);
    return () => clearInterval(t);
  }, [load, refreshSec, view, sel]);
  useEffect(() => { if (view === 'd' && sel && month?.market !== sel) load(sel); }, [view, sel, month, load]);

  if (err && !P) return <p className="text-red-400 text-sm">{err}</p>;
  if (!P) return <p className="text-gray-400 text-sm">Loading markets…</p>;

  const data = P.markets.map(m => derive(m, P));
  const cur = data.find(x => x.m.market === sel) ?? data[0];
  const regions = Array.from(new Set(data.map(x => x.m.region)));
  const lastRun = (P.status ?? []).map(s => s.job_last_run).filter(Boolean).sort().pop() ?? null;
  const errs = (P.status ?? []).filter(s => s.job_last_error);
  const runAge = ago(lastRun);
  const jobOn = P.settings.job_enabled === true;
  const ilsM = data.filter(x => x.m.acct_currency === 'ILS' && x.budget);
  const sp = ilsM.reduce((a, x) => a + x.spend, 0), bt = ilsM.reduce((a, x) => a + (x.budget ?? 0), 0);
  const others = data.filter(x => x.m.acct_currency !== 'ILS' && x.budget);
  const earnIls = data.reduce((a, x) => a + (x.earnIls ?? 0), 0);
  const stuck = data.filter(x => x.st === 'stuck').map(x => x.m.market), watch = data.filter(x => x.st === 'watch').map(x => x.m.market);
  const bfDays = Math.ceil((new Date('2026-11-27T00:00:00+02:00').getTime() - Date.now()) / 864e5);

  return (
    <div className="flex flex-col gap-5">
      {/* freshness */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center text-[12.5px] text-gray-400">
        <span>Israel time <b className="font-mono text-gray-200">{ilTime(new Date().toISOString())}</b></span>
        <span><i className={`inline-block w-[7px] h-[7px] rounded-full mr-1.5 ${!jobOn ? 'bg-red-400' : runAge != null && runAge < 0.75 && !errs.length ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          Job {jobOn ? <>last run <b className="font-mono text-gray-200">{ilTime(lastRun)}</b> ({agoTxt(runAge)})</> : <b className="text-red-300">switched off</b>}
          {errs.length > 0 && <span className="text-amber-400"> · errors: {errs.map(e => e.market).join(' ')}</span>}</span>
        <span>Google Ads + site: per hour, account clock</span>
        <span>Amazon: counted when first seen; shaded after {data[0]?.lagH ?? 3} h without a read</span>
        <button onClick={() => load(view === 'd' && cur ? cur.m.market : undefined)} disabled={loading}
          className="ml-auto px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? '…' : 'Refresh'}</button>
        <span className="text-blue-300 font-semibold">{bfDays > 0 ? `Black Friday in ${bfDays} days` : 'Black Friday week'}</span>
      </div>

      {/* tiles */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Budget used today</div>
          <div className="text-2xl font-bold font-mono text-blue-300">{bt ? pct(sp / bt) : '—'}</div>
          <div className="text-[11.5px] text-gray-500 font-mono">₪{n0(sp)} of ₪{n0(bt)} · ₪{n0(Math.max(0, bt - sp))} left
            {others.map(x => <span key={x.m.market} className="block">{x.m.market}: {money(x.m.acct_currency, x.spend)} of {money(x.m.acct_currency, x.budget)}</span>)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Amazon earnings today ≈₪</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{n0(earnIls)}</div>
          <div className="text-[11.5px] text-gray-500">seen so far today · Amazon lags</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Markets awake</div>
          <div className="text-2xl font-bold font-mono">{data.filter(x => x.st !== 'asleep').length} / {data.length}</div>
          <div className="text-[11.5px] text-gray-500">by local hour</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Needs a push</div>
          <div className="text-2xl font-bold text-red-400">{stuck.join(' ') || 'none'}</div>
          <div className="text-[11.5px] text-gray-500">visitors under {pct(data[0]?.stuckRatio)} of normal</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Watch quality</div>
          <div className="text-2xl font-bold text-amber-400">{watch.join(' ') || 'none'}</div>
          <div className="text-[11.5px] text-gray-500">land but don&apos;t click out</div>
        </div>
      </div>

      {/* cards by region */}
      {regions.map(rg => (
        <div key={rg} className="flex flex-col gap-2.5">
          <div className={`text-[11.5px] uppercase tracking-wider font-bold ${(REGION[rg] ?? REGION.other).text}`}>{(REGION[rg] ?? REGION.other).label}</div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(258px,1fr))' }}>
            {data.filter(x => x.m.region === rg).map(x => (
              <Card key={x.m.market} x={x} on={x === cur} onClick={() => { setSel(x.m.market); }} />
            ))}
          </div>
        </div>
      ))}
      {P.unmatched_accounts.length > 0 && (
        <div className="text-[12.5px] text-gray-400 border border-dashed border-amber-400 rounded-xl px-3 py-2 bg-amber-950/20">
          <b className="text-amber-400">Setup check:</b> Google Ads account(s) with no market row: {P.unmatched_accounts.map(a => `${a.account_name ?? a.customer_id} (${a.customer_id})`).join(', ')}.
          Add a <b>pulse_markets</b> row whose name token matches (or pin <b>gads_customer_id</b>) and it gets its own card on the next run. No code change.
        </div>
      )}

      {cur && <Detail x={cur} view={view} setView={setView} month={month?.market === cur.m.market ? month.rows : null} />}

      <p className="text-xs text-gray-500">
        Sources: our site = click_log (ad visitors, gclid) · Google Ads = each market&apos;s own account: spend, clicks, conversions per hour and today&apos;s
        daily budget (enabled campaigns, shared budgets once), in the account&apos;s own currency, never converted · Amazon = the hourly month-to-date
        report (ads tags), counted in the hour the job first saw it. Commission = Amazon&apos;s earnings; the rate set in pulse_markets is shown next to this
        month&apos;s actual rate. FX (pulse_fx) is used only to convert Amazon amounts. Hours = the market&apos;s Google Ads account clock. Normal = the
        average of {String(P.settings.baseline_start ?? '')} + {String(P.settings.baseline_days ?? 7)} days at the same local hour.
      </p>
    </div>
  );
}

function Detail({ x, view, setView, month }: { x: D; view: 'h' | 'd'; setView: (v: 'h' | 'd') => void; month: Day[] | null }) {
  const ac = x.m.acct_currency, ag = sym(ac).trim();
  const left = x.budget != null ? Math.max(0, x.budget - x.spend) : null;
  const dayNormal = x.hours.reduce((a, h) => a + h.norm, 0);
  const H = view === 'h';
  const ilNow = localNow(IL);
  const rows = H
    ? x.hours.map(h => ({ key: String(h.h), label: pad(h.h) + ':00', il: pad(((h.h - x.L.h + ilNow.h) % 24 + 24) % 24) + ':00', vis: h.vis, norm: h.norm,
        outs: h.outs, cost: h.cost, clicks: h.clicks, conv: h.conv, items: h.items, rev: h.rev, earn: h.earn, fut: h.fut, now: h.now, lag: h.lag }))
    : (month ?? []).map(d => ({ key: d.local_date, label: d.local_date.slice(5), il: '', vis: num(d.visitors, 0), norm: dayNormal,
        outs: num(d.clickouts, 0), cost: num(d.gads_cost, 0), clicks: num(d.gads_clicks, 0), conv: num(d.gads_conv, 0),
        items: num(d.amz_items, 0), rev: num(d.amz_revenue, 0), earn: num(d.amz_earnings, 0), fut: false, now: d.local_date === x.L.date, lag: d.local_date === x.L.date }));
  const T = (k: 'vis' | 'outs' | 'cost' | 'clicks' | 'conv' | 'items' | 'rev' | 'earn') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const td = 'px-2 py-1 text-right whitespace-nowrap border-b border-gray-800 font-mono';
  const th = 'px-2 py-1 text-right whitespace-nowrap bg-gray-800 text-gray-400 text-[10.5px] uppercase tracking-wide font-bold';
  const netOf = (earn: number | null, cost: number | null) => { const e = x.toAcct(earn); return e == null || cost == null ? null : e - cost; };
  const shade = (lag: boolean) => (x.amzStale || lag ? 'bg-violet-500/10' : '');
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 min-w-0" aria-label="Selected market">
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-baseline">
        <h2 className="text-xl font-bold text-white">{x.m.market} · {x.m.label}</h2>
        <span className="font-mono text-xs text-gray-400">{pad(x.L.h)}:{pad(x.L.m)} local ({x.m.tz}) · own account {x.m.customer_id ?? '—'} · Amazon {x.m.amazon_program?.toUpperCase()} program</span>
      </div>
      <div className="text-[13px] text-gray-400 bg-gray-800 rounded-lg px-3 py-2 [&_b]:text-gray-200">{why(x)}</div>

      <div className="border border-gray-800 rounded-lg px-3 py-2.5">
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-baseline mb-2">
          <h3 className="text-[13px] font-semibold text-white">Daily budget · own account</h3>
          <span className="text-[11.5px] text-gray-500">enabled campaigns&apos; daily budgets · account day · account currency ({ac ?? '—'})</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-1.5 mb-2">
          {[['Used', money(ac, x.spend), ''], ['Budget', money(ac, x.budget), ''], ['Left', money(ac, left), ''], ['Used %', pct(x.used), usedCls(x)], ['Normal by now', pct(x.normBy), 'text-gray-500']].map(([k, v, c]) => (
            <div key={k} className="flex flex-col min-w-0"><span className="text-[10px] uppercase tracking-wide text-gray-500">{k}</span><span className={`font-mono text-[17px] font-bold whitespace-nowrap ${c}`}>{v}</span></div>
          ))}
        </div>
        <BudgetBar x={x} big />
      </div>

      <div className="border border-gray-800 rounded-lg px-3 py-2.5">
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-baseline mb-2">
          <h3 className="text-[13px] font-semibold text-white">Pace × clickout, today by local hour</h3>
          <span className="text-[11.5px] text-gray-500">bars = ad visitors · dashed = normal · strip = clickout rate</span>
        </div>
        <Chart x={x} />
      </div>

      <div className="flex gap-1" role="tablist">
        {(['h', 'd'] as const).map(v => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`px-3 py-1.5 text-[13px] font-semibold rounded-lg border ${view === v ? 'bg-blue-900/60 border-blue-700 text-blue-100' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
            {v === 'h' ? 'Today by hour' : 'This month by day'}
          </button>
        ))}
      </div>
      {!H && !month && <p className="text-sm text-gray-500">Loading month…</p>}
      <div className="overflow-x-auto border border-gray-800 rounded-lg">
        <table className="w-full min-w-[1000px] text-[12.5px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={`${th} text-left sticky left-0 z-10`} rowSpan={2}>{H ? 'Local' : 'Day'}</th>
              {H && <th className={th} rowSpan={2}>IL</th>}
              <th className={`${th} text-center border-l border-gray-700`} colSpan={4}>Google Ads · own account ({ag})</th>
              <th className={`${th} text-center border-l border-gray-700`} colSpan={5}>Our site</th>
              <th className={`${th} text-center border-l border-gray-700`} colSpan={3}>Amazon ({x.m.currency})</th>
              <th className={`${th} text-center border-l border-gray-700`} rowSpan={2}>Net ≈{ag}</th>
            </tr>
            <tr>
              <th className={`${th} border-l border-gray-700`}>Spend</th><th className={th}>Clicks</th><th className={th}>CPC</th><th className={th}>Conv</th>
              <th className={`${th} border-l border-gray-700`}>Visitors</th><th className={th}>Normal</th><th className={th}>Clickouts</th><th className={th}>Rate</th><th className={th}>Cost / clickout</th>
              <th className={`${th} border-l border-gray-700`}>Items</th><th className={th}>Revenue</th><th className={th}>Comm ≈{ag}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const rate = r.vis ? (r.outs ?? 0) / r.vis : null;
              const lowRate = rate != null && rate < x.judgeCo && (r.vis ?? 0) >= 4;
              const lowVis = H && r.vis != null && !r.now && r.norm >= x.stuckMin && r.vis < x.stuckRatio * r.norm;
              const net = netOf(r.earn, r.cost);
              const rc = `${r.fut ? 'opacity-50 text-gray-500' : ''} ${r.now ? 'bg-yellow-400/10' : ''}`;
              return (
                <tr key={r.key} className={rc}>
                  <td className={`${td} text-left sticky left-0 bg-gray-900`}>{r.label}</td>
                  {H && <td className={td}>{r.il}</td>}
                  <td className={`${td} border-l border-gray-700`}>{n0(r.cost)}</td><td className={td}>{n0(r.clicks)}</td>
                  <td className={td}>{r.cost && r.clicks ? (r.cost / r.clicks).toFixed(2) : '—'}</td><td className={td}>{n0(r.conv)}</td>
                  <td className={`${td} border-l border-gray-700`}>{n0(r.vis)}</td>
                  <td className={td}>{lowVis ? <span className="px-1 rounded bg-red-900/50 text-red-300 text-[10.5px] font-bold">{n1(r.norm)}</span> : H ? n1(r.norm) : n0(r.norm)}</td>
                  <td className={td}>{n0(r.outs)}</td>
                  <td className={td}>{lowRate ? <span className="px-1 rounded bg-red-900/50 text-red-300 text-[10.5px] font-bold">{pct(rate)}</span> : pct(rate)}</td>
                  <td className={td}>{r.cost != null && r.outs ? (r.cost / r.outs).toFixed(2) : '—'}</td>
                  <td className={`${td} border-l border-gray-700 ${shade(r.lag)}`}>{n0(r.items)}</td>
                  <td className={`${td} ${shade(r.lag)}`}>{money(x.m.currency, r.rev)}</td>
                  <td className={`${td} ${shade(r.lag)}`}>{n0(x.toAcct(r.earn))}</td>
                  <td className={`${td} border-l border-gray-700 ${net == null ? '' : net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{net == null ? '—' : (net >= 0 ? '+' : '') + Math.round(net)}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className={`${td} text-left sticky left-0 bg-gray-800`}>Total</td>
              {H && <td className={`${td} bg-gray-800`} />}
              <td className={`${td} bg-gray-800 border-l border-gray-700`}>{n0(T('cost'))}</td><td className={`${td} bg-gray-800`}>{n0(T('clicks'))}</td>
              <td className={`${td} bg-gray-800`}>{T('clicks') ? (T('cost') / T('clicks')).toFixed(2) : '—'}</td><td className={`${td} bg-gray-800`}>{n0(T('conv'))}</td>
              <td className={`${td} bg-gray-800 border-l border-gray-700`}>{n0(T('vis'))}</td><td className={`${td} bg-gray-800`}>{H ? n0(dayNormal) : '—'}</td>
              <td className={`${td} bg-gray-800`}>{n0(T('outs'))}</td><td className={`${td} bg-gray-800`}>{T('vis') ? pct(T('outs') / T('vis')) : '—'}</td>
              <td className={`${td} bg-gray-800`}>{T('outs') ? (T('cost') / T('outs')).toFixed(2) : '—'}</td>
              <td className={`${td} bg-gray-800 border-l border-gray-700`}>{n0(T('items'))}</td><td className={`${td} bg-gray-800`}>{money(x.m.currency, T('rev'))}</td>
              <td className={`${td} bg-gray-800`}>{n0(x.toAcct(T('earn')))}</td>
              <td className={`${td} bg-gray-800 border-l border-gray-700`}>{(() => { const n = netOf(T('earn'), T('cost')); return n == null ? '—' : (n >= 0 ? '+' : '') + Math.round(n); })()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-[-1px] bg-yellow-400/20" />current local hour</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-[-1px] bg-violet-500/20" />Amazon still coming in (last {x.lagH} h, or no recent read)</span>
        <span>Amazon read {agoTxt(x.readAge)}{x.mtd?.last_new_order ? ` · last new order ${ilTime(x.mtd.last_new_order)} IL` : ''}</span>
      </div>
      {x.mtd && (
        <div className="text-[12.5px] text-gray-400 border-l-[3px] border-blue-700 pl-2.5 py-1.5 bg-gray-800 rounded-r-lg">
          <b className="text-gray-200">Amazon this month (ads tags, Amazon&apos;s own month-to-date):</b> {n0(x.mtd.items)} items · {money(x.m.currency, x.mtd.revenue)} revenue ·
          {' '}{money(x.m.currency, x.mtd.earnings)} earnings ≈{ag}{n0(x.toAcct(x.mtd.earnings))}. Hours and days above start when the job began counting Amazon.
        </div>
      )}
      {x.status?.job_last_error && <p className="text-xs text-amber-400">Last job error: {x.status.job_last_error}</p>}
    </section>
  );
}
