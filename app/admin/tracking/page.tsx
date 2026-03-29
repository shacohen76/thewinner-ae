'use client';
// ============================================
// Admin Tracking Dashboard — /admin/tracking
// ============================================
// Created: 2026-03-28
// Standalone dashboard for monitoring tag rotation system.
// Password protected via query param or localStorage.
// ============================================

import { useState, useEffect, useCallback } from 'react';

interface Session {
  session_id: string;
  gclid: string | null;
  assigned_tag: string;
  traffic_source: string;
  landing_page: string;
  clicked_asins: string[];
  click_timestamps: string[];
  user_agent: string;
  ip_country: string;
  created_at: string;
  last_activity: string;
  status: string;
}

interface TagPoolEntry {
  tag_id: string;
  tag_type: string;
  status: string;
  assigned_at: string | null;
  expires_at: string | null;
}

interface DailyStat {
  date: string;
  sessions: number;
  with_gclid: number;
  with_clicks: number;
  total_asins: number;
  sources: Record<string, number>;
}

interface TrackingData {
  tag_pool: TagPoolEntry[];
  sessions: Session[];
  daily_stats: DailyStat[];
  meta: {
    total_sessions: number;
    date_range: { from: string; to: string; days: number };
    generated_at: string;
  };
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const SRC_COLORS: Record<string, string> = {
  gads: '#3b82f6', seo: '#10b981', direct: '#6b7280', fb: '#a855f7',
  bing: '#14b8a6', chatgpt: '#ec4899', other: '#f59e0b',
};

const SRC_BG: Record<string, string> = {
  gads: 'bg-blue-100 text-blue-800', seo: 'bg-emerald-100 text-emerald-800',
  direct: 'bg-gray-100 text-gray-700', fb: 'bg-purple-100 text-purple-800',
  bing: 'bg-teal-100 text-teal-800', chatgpt: 'bg-pink-100 text-pink-800',
  other: 'bg-amber-100 text-amber-800',
};

export default function AdminTracking() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);
  const [geoFilter, setGeoFilter] = useState<'ae' | 'all'>('ae');
  const [tab, setTab] = useState<'overview' | 'sessions' | 'tags' | 'funnel'>('overview');

  // Check localStorage for saved password
  useEffect(() => {
    const saved = localStorage.getItem('tw_admin_key');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchData = useCallback(async (pw?: string) => {
    const key = pw || password;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tracking?key=${encodeURIComponent(key)}&days=${days}&geo=${geoFilter}`);
      if (res.status === 401) {
        setError('Wrong password');
        setAuthenticated(false);
        localStorage.removeItem('tw_admin_key');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setAuthenticated(true);
      localStorage.setItem('tw_admin_key', key);
    } catch (e) {
      setError('Failed to fetch data');
    }
    setLoading(false);
  }, [password, days, geoFilter]);

  useEffect(() => {
    if (authenticated && password) fetchData();
  }, [days, geoFilter, authenticated]);

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
          <h1 className="text-white text-lg font-bold mb-1">Tracking Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">thewinner.ae admin</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm mb-3 outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button
            onClick={() => fetchData()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Loading...' : 'Enter'}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  // Computed
  const { tag_pool, sessions, daily_stats, meta } = data;
  const gadsTags = tag_pool.filter(t => t.tag_type === 'gads');
  const busyTags = gadsTags.filter(t => t.status === 'busy');
  const realSessions = sessions.filter(s => !s.gclid?.startsWith('test'));
  const withGclid = realSessions.filter(s => s.gclid);
  const withClicks = realSessions.filter(s => s.clicked_asins?.length > 0);
  const totalAsins = realSessions.reduce((sum, s) => sum + (s.clicked_asins?.length || 0), 0);

  const sourceBreakdown: Record<string, number> = {};
  realSessions.forEach(s => {
    sourceBreakdown[s.traffic_source] = (sourceBreakdown[s.traffic_source] || 0) + 1;
  });

  // Top pages
  const pageCount: Record<string, { visits: number; clicks: number }> = {};
  realSessions.forEach(s => {
    const p = (s.landing_page || 'unknown').replace('/best/', '');
    if (!pageCount[p]) pageCount[p] = { visits: 0, clicks: 0 };
    pageCount[p].visits++;
    if (s.clicked_asins?.length > 0) pageCount[p].clicks++;
  });
  const topPages = Object.entries(pageCount).sort((a, b) => b[1].visits - a[1].visits).slice(0, 15);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">thewinner.ae — Tracking</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.total_sessions} sessions · {days}d range · Updated {meta.generated_at ? timeAgo(meta.generated_at) : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 outline-none">
              <option value={1}>Today</option>
              <option value={2}>Yesterday + Today</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            <button onClick={() => setGeoFilter(geoFilter === 'ae' ? 'all' : 'ae')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
                geoFilter === 'ae'
                  ? 'bg-emerald-900/50 border-emerald-700 text-emerald-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
              {geoFilter === 'ae' ? '🇦🇪 UAE Only' : '🌍 All GEOs'}
            </button>
            <button onClick={() => fetchData()} disabled={loading}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex gap-1 pt-2">
          {(['overview', 'funnel', 'sessions', 'tags'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t === 'tags' ? 'Tag Pool' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: 'Sessions', value: realSessions.length, color: '#3b82f6' },
                { label: 'With GCLID', value: withGclid.length, color: '#a855f7' },
                { label: 'Amazon Clicks', value: totalAsins, color: '#10b981' },
                { label: 'Click Rate', value: `${realSessions.length > 0 ? ((withClicks.length / realSessions.length) * 100).toFixed(1) : '0'}%`, color: '#f59e0b' },
                { label: 'Tags Busy', value: `${busyTags.length}/${gadsTags.length}`, color: '#14b8a6' },
                { label: 'Bot Leaks', value: realSessions.filter(s => (s.user_agent || '').match(/bot|Bot|crawl|spider/i)).length, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Daily chart */}
            {daily_stats.length > 1 && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
                <h2 className="text-sm font-semibold text-gray-400 mb-4">Daily sessions</h2>
                <div className="flex items-end gap-1.5 h-32">
                  {daily_stats.map(d => {
                    const maxSessions = Math.max(...daily_stats.map(x => x.sessions), 1);
                    const h = (d.sessions / maxSessions) * 100;
                    const clickH = (d.with_clicks / maxSessions) * 100;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.sessions} sessions, ${d.with_clicks} clicked, ${d.total_asins} ASINs`}>
                        <div className="w-full relative" style={{ height: '100px' }}>
                          <div className="absolute bottom-0 w-full bg-blue-500/30 rounded-t-sm" style={{ height: `${h}%` }} />
                          <div className="absolute bottom-0 w-full bg-emerald-500/60 rounded-t-sm" style={{ height: `${clickH}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-600">{formatDate(d.date)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500/30" /> Sessions</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/60" /> With Amazon clicks</span>
                </div>
              </div>
            )}

            {/* Sources + Top Pages */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Traffic sources</h2>
                <div className="space-y-2">
                  {Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                    <div key={src} className="flex items-center gap-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SRC_BG[src] || SRC_BG.other}`}>{src}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${(count / realSessions.length) * 100}%`, backgroundColor: SRC_COLORS[src] || '#f59e0b' }} />
                      </div>
                      <span className="text-sm text-gray-400 w-12 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Top landing pages</h2>
                <div className="space-y-1.5">
                  {topPages.map(([page, stats]) => (
                    <div key={page} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 truncate mr-2">{page}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-500">{stats.visits}</span>
                        {stats.clicks > 0 && <span className="text-emerald-500 text-xs">→ {stats.clicks}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* FUNNEL — the sanity check view */}
        {tab === 'funnel' && (
          <>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
              <h2 className="text-sm font-semibold text-gray-400 mb-4">Daily funnel — sanity check</h2>
              <p className="text-xs text-gray-600 mb-4">Compare these numbers with Google Ads clicks and Amazon Associates reports to verify data flow.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-800">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Sessions</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">With GCLID</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Clicked to AMZ</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Total ASINs</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Click Rate</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily_stats].reverse().map(d => (
                      <tr key={d.date} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-3 py-2.5 font-medium text-white">{d.date}</td>
                        <td className="px-3 py-2.5 text-blue-400">{d.sessions}</td>
                        <td className="px-3 py-2.5 text-purple-400">{d.with_gclid}</td>
                        <td className="px-3 py-2.5 text-emerald-400">{d.with_clicks}</td>
                        <td className="px-3 py-2.5 text-emerald-400">{d.total_asins}</td>
                        <td className="px-3 py-2.5 text-amber-400">
                          {d.sessions > 0 ? ((d.with_clicks / d.sessions) * 100).toFixed(1) : '0'}%
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {Object.entries(d.sources).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                              <span key={src} className="text-xs text-gray-500">{src}:{count}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sanity comparison helper */}
            <div className="bg-gray-900 rounded-xl p-6 border border-amber-900/30 mb-6">
              <h2 className="text-sm font-semibold text-amber-400 mb-3">How to cross-check</h2>
              <div className="text-sm text-gray-400 space-y-2">
                <p><span className="text-white font-medium">Google Ads clicks</span> should roughly match <span className="text-purple-400">With GCLID</span> column (our system may miss some due to JS not loading, ad blockers, etc.)</p>
                <p><span className="text-white font-medium">Amazon Associates clicks</span> should be ≥ <span className="text-emerald-400">Total ASINs</span> (Amazon counts all clicks including same user clicking same product multiple times)</p>
                <p><span className="text-white font-medium">Expected ratios:</span> GCLID capture rate: 80-95% of G-Ads clicks · Amazon click rate: 8-15% of sessions</p>
                <p className="text-amber-500/80 text-xs mt-2">If Amazon shows 0 clicks for a day where our system shows clicks → check if the tracking IDs (twnrae*) are visible in Amazon reports. New tags may take 24-48h to appear.</p>
              </div>
            </div>
          </>
        )}

        {/* SESSIONS */}
        {tab === 'sessions' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-800">
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">Time</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">Source</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">Tag</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">GCLID</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">Page</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">AMZ Clicks</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={s.session_id}
                      className={`border-b border-gray-800/30 ${s.clicked_asins?.length > 0 ? 'bg-emerald-950/20' : ''} hover:bg-gray-800/30`}>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{timeAgo(s.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SRC_BG[s.traffic_source] || SRC_BG.other}`}>
                          {s.traffic_source}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{s.assigned_tag}</td>
                      <td className="px-3 py-2 text-xs">
                        {s.gclid
                          ? s.gclid.startsWith('test')
                            ? <span className="text-amber-500">test</span>
                            : <span className="text-purple-400" title={s.gclid}>✓</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[200px] truncate" title={s.landing_page}>
                        {(s.landing_page || '').replace('/best/', '')}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {s.clicked_asins?.length > 0
                          ? <div className="flex flex-col gap-0.5">
                              {s.clicked_asins.map((asin: string) => (
                                <a key={asin} href={`https://www.amazon.ae/dp/${asin}`} target="_blank" rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 font-mono underline">{asin}</a>
                              ))}
                            </div>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.ip_country || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAG POOL */}
        {tab === 'tags' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Tags', value: tag_pool.length, color: '#3b82f6' },
                { label: 'Gads Pool', value: `${busyTags.length} busy / ${gadsTags.length}`, color: '#14b8a6' },
                { label: 'Utilization', value: `${gadsTags.length > 0 ? ((busyTags.length / gadsTags.length) * 100).toFixed(0) : 0}%`, color: '#f59e0b' },
                { label: 'Static Tags', value: tag_pool.filter(t => t.tag_type !== 'gads').length, color: '#a855f7' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
                  <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {busyTags.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Currently busy ({busyTags.length})</h2>
                <div className="space-y-1.5">
                  {busyTags.map(t => (
                    <div key={t.tag_id} className="flex items-center gap-4 text-sm">
                      <span className="font-mono text-xs text-teal-400 w-28">{t.tag_id}</span>
                      <span className="text-gray-500 text-xs">{t.assigned_at ? timeAgo(t.assigned_at) : '—'}</span>
                      <span className="text-xs">
                        {t.expires_at && new Date(t.expires_at) < new Date()
                          ? <span className="text-red-400">expired — cron will release</span>
                          : t.expires_at ? <span className="text-gray-600">expires {timeAgo(t.expires_at)}</span> : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Tag allocation</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(tag_pool.reduce((acc: Record<string, number>, t) => {
                  acc[t.tag_type] = (acc[t.tag_type] || 0) + 1;
                  return acc;
                }, {})).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SRC_BG[type] || SRC_BG.other}`}>{type}</span>
                    <span className="text-sm text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 px-4 py-3 text-center text-xs text-gray-600">
        thewinner.ae tracking · Rollback: c27338c · <button onClick={() => { localStorage.removeItem('tw_admin_key'); setAuthenticated(false); }} className="text-gray-500 hover:text-white">Logout</button>
      </div>
    </div>
  );
}
