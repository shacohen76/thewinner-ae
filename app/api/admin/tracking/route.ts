// ============================================
// Admin Tracking Data API — /api/admin/tracking
// ============================================
// Created: 2026-03-28
// Last Modified: 2026-05-25 (Phase 2 — dashboard truth fix)
// v1.1: Fixed timezone — uses Dubai time (UTC+4) for calendar day boundaries
// v1.2: Added user_id + site to session query. Added user-level aggregation.
// v1.3: Added session_details array per user for expandable journey view.
// v1.4 (GEOS1): geo filter expanded from binary AE/All to 5-state.
// v1.5 (Phase 2, 2026-05-25): AGGREGATES now come from the read-only
//       Postgres function `admin_tracking_rollup` (GROUP BY in DB) instead of
//       a capped 500-row pull. Fixes two bugs:
//         (a) the 500-row cap made every aggregate a ~10% recency-biased sample
//         (b) bots (impossible Chrome/145 UA) inflated sessions / sank CR
//       The function returns a small JSON summary over the FULL date range,
//       bot-excluded. Geo logic stays in lib/geo-config.ts: the function
//       returns per-country counts; this route maps them to geo/program here.
//       The raw `sessions` list + `users` list stay capped (display only).
//       Response shape is unchanged + 3 added fields: meta.totals,
//       source_breakdown, top_pages.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGeoGroup, getGeoProgram, getProgramConfig, ALL_PROGRAMS, type GeoGroup, type GeoProgram } from '@/lib/geo-config';

// Country lists for DB-side filtering. Mirror lib/geo-config.ts membership.
// Kept here as plain arrays (not Sets) so Supabase .in() can consume them.
const GULF_CC = ['AE','SA','BH','KW','OM','QA'];
const EUROPE_CC = [
  'DE','GB','FR','NL','SE','FI','DK','NO','BE','CH','AT','IT','ES','PT','PL',
  'RO','GR','IE','CZ','HU','HR','BG','SK','SI','LT','LV','EE','LU','MT','CY',
  'IS','TR','UA','RS',
];

// Force dynamic — never cache this API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Dubai timezone offset: UTC+4
const DUBAI_OFFSET_HOURS = 4;

function getDubaiStartOfDay(daysBack: number): string {
  // Get current time in Dubai
  const now = new Date();
  const dubaiNow = new Date(now.getTime() + DUBAI_OFFSET_HOURS * 60 * 60 * 1000);

  // Go back N days and set to start of day (00:00 Dubai time)
  dubaiNow.setUTCDate(dubaiNow.getUTCDate() - daysBack);
  dubaiNow.setUTCHours(0, 0, 0, 0);

  // Convert back to UTC for Supabase query
  const utcTime = new Date(dubaiNow.getTime() - DUBAI_OFFSET_HOURS * 60 * 60 * 1000);
  return utcTime.toISOString();
}

interface GeoBucket { sessions: number; with_gclid: number; with_clicks: number; total_asins: number; }
const emptyBucket = (): GeoBucket => ({ sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0 });

export async function GET(request: NextRequest) {
  // Simple password protection
  const password = request.nextUrl.searchParams.get('key');
  const adminPassword = process.env.ADMIN_PASSWORD || 'tw2026admin';

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Date range from query params (default: last 7 days)
  // "1" = today only, "7" = last 7 days (all include today, open-ended to now).
  const daysBack = parseInt(request.nextUrl.searchParams.get('days') || '7');
  // MG5 (2026-07-28): optional single-day mode. mode='yesterday' isolates the
  // prior Dubai day [yesterday 00:00, today 00:00); every other preset stays
  // open-ended to now (until = null → the aggregation coalesces it to +infinity).
  const mode = request.nextUrl.searchParams.get('mode') || '';
  let since = getDubaiStartOfDay(daysBack - 1); // -1 because "1 day" = today = 0 days back
  let until: string | null = null;
  if (mode === 'yesterday') {
    since = getDubaiStartOfDay(1);   // yesterday 00:00 Dubai
    until = getDubaiStartOfDay(0);   // today 00:00 Dubai (exclusive)
  }

  // GEOS1: 5-state geo filter + optional country drilldown.
  //   geo = 'all' | 'gulf' | 'europe' | 'intl'   (default: 'all')
  //   country = 'AE' | 'US' | ...                (optional; overrides geo)
  // Legacy 'ae' value (from pre-GEOS1 page builds) is treated as 'all'.
  let geoFilter = request.nextUrl.searchParams.get('geo') || 'all';
  if (geoFilter === 'ae') geoFilter = 'all'; // backward-compat
  const countryFilter = request.nextUrl.searchParams.get('country') || '';

  // Resolve the geo filter to the include/exclude country lists passed to the
  // aggregation function (mirrors the .in()/.not() filter on the sessions list).
  let pIn: string[] | null = null;
  let pNotIn: string[] | null = null;
  if (countryFilter) {
    pIn = [countryFilter];
  } else if (geoFilter === 'gulf') {
    pIn = GULF_CC;
  } else if (geoFilter === 'europe') {
    pIn = EUROPE_CC;
  } else if (geoFilter === 'intl') {
    pNotIn = [...GULF_CC, ...EUROPE_CC];
  }

  try {
    // Capped recent rows for the Sessions tab + the Users list (display only).
    // Bot-excluded (the confirmed impossible Chrome/145 signature) + geo filter.
    let sessionsQuery = supabase.from('click_log')
      .select('session_id,gclid,assigned_tag,traffic_source,landing_page,clicked_asins,click_timestamps,user_agent,ip_country,created_at,last_activity,status,user_id,site')
      .gte('created_at', since)
      .not('user_agent', 'ilike', '%Chrome/145.0.0.0%')
      .order('created_at', { ascending: false })
      .limit(500);

    // MG5: single-day mode caps the sessions list at the day boundary too.
    if (until) sessionsQuery = sessionsQuery.lt('created_at', until);

    if (countryFilter) {
      sessionsQuery = sessionsQuery.eq('ip_country', countryFilter);
    } else if (geoFilter === 'gulf') {
      sessionsQuery = sessionsQuery.in('ip_country', GULF_CC);
    } else if (geoFilter === 'europe') {
      sessionsQuery = sessionsQuery.in('ip_country', EUROPE_CC);
    } else if (geoFilter === 'intl') {
      const exclusionList = [...GULF_CC, ...EUROPE_CC];
      sessionsQuery = sessionsQuery
        .not('ip_country', 'in', `(${exclusionList.join(',')})`)
        .not('ip_country', 'is', null);
    }

    // MG4.5 (2026-08-01): fetch the FULL tag_pool via pagination. PostgREST caps an
    // unbounded select at 1000 rows; tag_pool now exceeds that (~2000+ across all
    // programs), so a single select silently dropped every tag past row 1000. That
    // made the per-program panel undercount — e.g. JP showed 0 warming / 93 total
    // vs the real 7 / 100, AE 277 vs 301 — because the dropped rows were the
    // recently-created (higher tag_id) warming tags. Loop .range() until a short page
    // returns so counts are complete regardless of how many programs/tags exist.
    // Read-only, admin-only endpoint; does NOT touch rotation/assignment logic.
    const fetchAllTagPool = async () => {
      const cols = 'tag_id,tag_type,status,assigned_at,expires_at,is_stable,seeding_cohort,program,locale';
      const pageSize = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('tag_pool')
          .select(cols)
          .order('tag_id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) return { data: all, error };
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return { data: all, error: null };
    };

    const [tagPoolRes, rollupRes, sessionsRes, langSplitRes] = await Promise.all([
      // Tag pool status (incl. AMZ12 tier flags for the busy-tag badges).
      // MG5 (2026-07-24): +program,+locale so the panel can resolve each tag to
      // (program, source, language) and fix the AE-only tag-count contamination.
      fetchAllTagPool(),
      // Read-only aggregation over the FULL range, bot-excluded (Phase 2).
      supabase.rpc('admin_tracking_rollup', { p_since: since, p_in: pIn, p_not_in: pNotIn, p_until: until }),
      sessionsQuery,
      // MG5: language-split source — click side (by_tag) + money side (purchases)
      // per tag, GLOBAL (program is the geo axis here; purchases are by tag, not IP).
      supabase.rpc('admin_lang_split', { p_since: since, p_until: until }),
    ]);

    const tagPool = tagPoolRes.data || [];
    const rollup: any = rollupRes.data || {};
    const sessionsRaw: any[] = sessionsRes.data || [];
    const langSplitRaw: any = langSplitRes.data || {};

    // Annotate each displayed session with its geo group.
    const sessions = sessionsRaw.map((s: any) => ({
      ...s,
      geo_group: getGeoGroup(s.ip_country) as GeoGroup,
    }));

    // ── daily_stats: from rollup.by_day + rollup.by_day_source ──
    const dayMap: Record<string, any> = {};
    for (const d of (rollup.by_day || [])) {
      dayMap[d.day] = {
        date: d.day,
        sessions: d.sessions,
        with_gclid: d.with_gclid,
        with_clicks: d.with_clicks,
        total_asins: d.total_asins,
        sources: {} as Record<string, number>,
      };
    }
    for (const s of (rollup.by_day_source || [])) {
      if (!dayMap[s.day]) {
        dayMap[s.day] = { date: s.day, sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0, sources: {} };
      }
      dayMap[s.day].sources[s.source] = s.n;
    }
    const daily_stats = Object.values(dayMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // ── by_country → by_geo / top_countries / by_program ──
    const byCountry: any[] = rollup.by_country || [];

    const byGeo: Record<GeoGroup, GeoBucket> = {
      gulf: emptyBucket(),
      europe: emptyBucket(),
      international: emptyBucket(),
    };
    for (const c of byCountry) {
      const g = getGeoGroup(c.ip_country) as GeoGroup;
      const b = byGeo[g];
      b.sessions += c.sessions;
      b.with_gclid += c.with_gclid;
      b.with_clicks += c.with_clicks;
      b.total_asins += c.total_asins;
    }

    const topCountries = [...byCountry]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 12)
      .map((c) => ({
        code: c.ip_country || '_unknown',
        count: c.sessions,
        geo_group: c.ip_country ? getGeoGroup(c.ip_country) : 'international',
      }));

    // Per-program sessions/clicks from per-country aggregates.
    const progAgg: Record<string, { sessions: number; clicks: number }> = {};
    for (const c of byCountry) {
      const p = getGeoProgram(c.ip_country);
      if (!progAgg[p]) progAgg[p] = { sessions: 0, clicks: 0 };
      progAgg[p].sessions += c.sessions;
      progAgg[p].clicks += c.with_clicks;
    }
    const byProgram: Record<GeoProgram, any> = {} as any;
    ALL_PROGRAMS.forEach((prog) => {
      const cfg = getProgramConfig(prog);
      // MG5 (2026-07-24): count tags by the tag_pool.program column (populated for
      // all 18 programs) instead of the old AE-only tag_type heuristic, which
      // cross-counted the new non-AE tags into AE and under-counted the rest.
      const tagsForProgram = tagPool.filter((t: any) => t.program === prog).length;
      byProgram[prog] = {
        group: cfg.group,
        amazonDomain: cfg.amazonDomain,
        defaultTag: cfg.defaultTag,
        tags: tagsForProgram,
        sessions: progAgg[prog]?.sessions || 0,
        clicks: progAgg[prog]?.clicks || 0,
      };
    });

    // ── user_summary: from rollup.user_summary + derived rates ──
    const us: any = rollup.user_summary || {};
    const totalUsers = us.total_users || 0;
    const returningUsers = us.returning_users || 0;
    const newUsers = us.new_users || 0;
    const avgSessions = totalUsers > 0 ? (us.total_sessions / totalUsers).toFixed(1) : '0';
    const returningClickRate = returningUsers > 0
      ? ((us.returning_with_clicks / returningUsers) * 100).toFixed(1)
      : '0';
    const newClickRate = newUsers > 0
      ? ((us.new_with_clicks / newUsers) * 100).toFixed(1)
      : '0';
    const user_summary = {
      total_users: totalUsers,
      new_users: newUsers,
      returning_users: returningUsers,
      cross_source_users: us.cross_source_users || 0,
      users_with_clicks: us.users_with_clicks || 0,
      users_with_gclid: us.users_with_gclid || 0,
      avg_sessions: avgSessions,
      returning_click_rate: returningClickRate,
      new_click_rate: newClickRate,
    };

    // ── users LIST (display) — built from the capped sessions, as before ──
    const userMap: Record<string, any> = {};
    sessions.forEach((s: any) => {
      const uid = s.user_id;
      if (!uid) return;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id: uid, sessions: 0, first_seen: s.created_at, last_seen: s.created_at,
          sources: new Set(), pages: new Set(), total_asin_clicks: 0, has_gclid: false,
          gclid_sessions: 0, tags: new Set(), countries: new Set(), sites: new Set(),
          session_details: [],
        };
      }
      const u = userMap[uid];
      u.sessions++;
      if (s.created_at < u.first_seen) u.first_seen = s.created_at;
      if (s.created_at > u.last_seen) u.last_seen = s.created_at;
      u.sources.add(s.traffic_source);
      if (s.landing_page) u.pages.add(s.landing_page);
      if (s.clicked_asins?.length > 0) u.total_asin_clicks += s.clicked_asins.length;
      if (s.gclid && !s.gclid.startsWith('test')) { u.has_gclid = true; u.gclid_sessions++; }
      if (s.assigned_tag) u.tags.add(s.assigned_tag);
      if (s.ip_country) u.countries.add(s.ip_country);
      if (s.site) u.sites.add(s.site);
      u.session_details.push({
        created_at: s.created_at,
        traffic_source: s.traffic_source,
        landing_page: s.landing_page,
        assigned_tag: s.assigned_tag,
        has_gclid: !!(s.gclid && !s.gclid.startsWith('test')),
        clicked_asins: s.clicked_asins || [],
      });
    });
    const users = Object.values(userMap).map((u: any) => {
      const countries = Array.from(u.countries) as string[];
      const primaryCountry = countries[0] || null;
      return {
        ...u,
        sources: Array.from(u.sources),
        pages: Array.from(u.pages),
        tags: Array.from(u.tags),
        countries,
        sites: Array.from(u.sites),
        is_returning: u.sessions > 1,
        has_cross_source: u.sources.size > 1,
        primary_country: primaryCountry,
        geo_group: getGeoGroup(primaryCountry) as GeoGroup,
      };
    }).sort((a: any, b: any) => b.last_seen.localeCompare(a.last_seen));

    // ── source_breakdown + top_pages (accurate, for the Overview) ──
    const source_breakdown: Record<string, number> = {};
    for (const s of (rollup.by_source || [])) source_breakdown[s.source] = s.n;
    // Tuple shape [page, {visits, clicks}] matches the page's existing renderer.
    const top_pages = (rollup.top_pages || []).map((p: any) => [p.page, { visits: p.visits, clicks: p.clicks }]);

    const totals = rollup.totals || { sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0, bots_excluded: 0 };

    // ── lang_split: sessions/clicks/purchases by program × source × locale (MG5) ──
    // The money view this project exists to produce: join the click side
    // (langSplit.by_tag) + the money side (langSplit.purchases) to tag_pool so each
    // Amazon tag resolves to (program, tag_type=source, locale). gads tags are
    // language-blind (locale NULL) → paid rows aggregate onto one per-program row.
    // Tags no longer in the pool (retired) fall into an '(unmapped)' bucket.
    const tagMeta: Record<string, { program: string; source: string; locale: string | null }> = {};
    for (const t of tagPool as any[]) {
      tagMeta[t.tag_id] = { program: t.program, source: t.tag_type, locale: t.locale ?? null };
    }
    interface SplitRow {
      program: string; source: string; locale: string;
      sessions: number; clicks: number; with_gclid: number; orders: number; revenue: number;
    }
    const splitMap: Record<string, SplitRow> = {};
    const getSplit = (tagId: string): SplitRow => {
      const m = tagMeta[tagId];
      const program = m?.program || '(unmapped)';
      const source = m?.source || '(unmapped)';
      const locale = m?.locale || '-';
      const key = `${program}|${source}|${locale}`;
      if (!splitMap[key]) {
        splitMap[key] = { program, source, locale, sessions: 0, clicks: 0, with_gclid: 0, orders: 0, revenue: 0 };
      }
      return splitMap[key];
    };
    for (const r of (langSplitRaw.by_tag || [])) {
      if (!r.assigned_tag) continue;
      const row = getSplit(r.assigned_tag);
      row.sessions += r.sessions || 0;
      row.clicks += r.with_clicks || 0;
      row.with_gclid += r.with_gclid || 0;
    }
    for (const p of (langSplitRaw.purchases || [])) {
      if (!p.tag_id) continue;
      const row = getSplit(p.tag_id);
      row.orders += p.orders || 0;
      row.revenue += Number(p.revenue) || 0;
    }
    const lang_split = Object.values(splitMap)
      .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);

    return NextResponse.json({
      tag_pool: tagPool,
      sessions: sessions,
      daily_stats: daily_stats,
      users: users,
      user_summary: user_summary,
      by_geo: byGeo,
      top_countries: topCountries,
      by_program: byProgram,
      // Phase 2 additions (accurate, bot-excluded full-range aggregates):
      source_breakdown: source_breakdown,
      top_pages: top_pages,
      // MG5: program × source × language money view (global — see lang_split note).
      lang_split: lang_split,
      meta: {
        total_sessions: totals.sessions,
        totals: totals,
        date_range: { from: since, to: until || new Date().toISOString(), days: daysBack, mode: mode || 'rolling' },
        geo_filter: geoFilter,
        country_filter: countryFilter || null,
        timezone: 'Asia/Dubai (UTC+4)',
        generated_at: new Date().toISOString(),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Admin tracking API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
