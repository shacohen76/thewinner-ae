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
  // "1" = today only, "2" = yesterday + today, etc.
  const daysBack = parseInt(request.nextUrl.searchParams.get('days') || '7');
  const since = getDubaiStartOfDay(daysBack - 1); // -1 because "1 day" = today = 0 days back

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

    const [tagPoolRes, rollupRes, sessionsRes] = await Promise.all([
      // Tag pool status (incl. AMZ12 tier flags for the busy-tag badges).
      supabase.from('tag_pool').select('tag_id,tag_type,status,assigned_at,expires_at,is_stable,seeding_cohort'),
      // Read-only aggregation over the FULL range, bot-excluded (Phase 2).
      supabase.rpc('admin_tracking_rollup', { p_since: since, p_in: pIn, p_not_in: pNotIn }),
      sessionsQuery,
    ]);

    const tagPool = tagPoolRes.data || [];
    const rollup: any = rollupRes.data || {};
    const sessionsRaw: any[] = sessionsRes.data || [];

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
    const UAE_TAG_TYPES = new Set(['gads', 'seo', 'direct', 'seo_reserve', 'other_geo']);
    const byProgram: Record<GeoProgram, any> = {} as any;
    ALL_PROGRAMS.forEach((prog) => {
      const cfg = getProgramConfig(prog);
      const tagsForProgram = prog === 'ae'
        ? tagPool.filter((t: any) => UAE_TAG_TYPES.has(t.tag_type)).length
        : tagPool.filter((t: any) => t.tag_id === cfg.defaultTag).length;
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
      meta: {
        total_sessions: totals.sessions,
        totals: totals,
        date_range: { from: since, to: new Date().toISOString(), days: daysBack },
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
