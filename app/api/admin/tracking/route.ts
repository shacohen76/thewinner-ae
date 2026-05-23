// ============================================
// Admin Tracking Data API — /api/admin/tracking
// ============================================
// Created: 2026-03-28
// Last Modified: 2026-05-21 (GEOS1)
// v1.1: Fixed timezone — uses Dubai time (UTC+4) for calendar day boundaries
// v1.2: Added user_id + site to session query. Added user-level aggregation.
// v1.3: Added session_details array per user for expandable journey view.
// v1.4 (GEOS1): geo filter expanded from binary AE/All to 5-state
//       (all | gulf | europe | intl | country=XX). Each session annotated with
//       geo_group. Response adds by_geo aggregate, top_countries list, and
//       by_program tag-pool counts. Default geo filter changed from 'ae' to
//       'all' so monitoring is unbiased post-GEOS1.
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

function utcToDubaiDate(utcTimestamp: string): string {
  // Convert UTC timestamp to Dubai calendar date (YYYY-MM-DD)
  const utc = new Date(utcTimestamp);
  const dubai = new Date(utc.getTime() + DUBAI_OFFSET_HOURS * 60 * 60 * 1000);
  return dubai.toISOString().substring(0, 10);
}

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
  // Legacy 'ae' value (from pre-GEOS1 page builds) is treated as 'all' so
  // stale browser tabs don't crash — they fall back to unfiltered view.
  let geoFilter = request.nextUrl.searchParams.get('geo') || 'all';
  if (geoFilter === 'ae') geoFilter = 'all'; // backward-compat
  const countryFilter = request.nextUrl.searchParams.get('country') || '';

  try {
    // Fetch all data in parallel
    let sessionsQuery = supabase.from('click_log')
      .select('session_id,gclid,assigned_tag,traffic_source,landing_page,clicked_asins,click_timestamps,user_agent,ip_country,created_at,last_activity,status,user_id,site')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    // Apply geo / country filter at DB level so the 500-row limit hits the
    // right slice. Country filter overrides geo filter.
    if (countryFilter) {
      sessionsQuery = sessionsQuery.eq('ip_country', countryFilter);
    } else if (geoFilter === 'gulf') {
      sessionsQuery = sessionsQuery.in('ip_country', GULF_CC);
    } else if (geoFilter === 'europe') {
      sessionsQuery = sessionsQuery.in('ip_country', EUROPE_CC);
    } else if (geoFilter === 'intl') {
      // International = everything except Gulf + Europe. Excludes NULL country
      // (NULL only happens in local dev — no real traffic noise).
      const exclusionList = [...GULF_CC, ...EUROPE_CC];
      sessionsQuery = sessionsQuery
        .not('ip_country', 'in', `(${exclusionList.join(',')})`)
        .not('ip_country', 'is', null);
    }
    // geoFilter === 'all' → no filter

    const [tagPoolRes, sessionsRes] = await Promise.all([
      // Tag pool status. GEOS1: include is_stable + seeding_cohort so the
      // dashboard can show tier badges next to busy tags.
      supabase.from('tag_pool').select('tag_id,tag_type,status,assigned_at,expires_at,is_stable,seeding_cohort'),
      sessionsQuery,
    ]);

    const tagPool = tagPoolRes.data || [];
    const sessionsRaw: any[] = sessionsRes.data || [];

    // GEOS1: annotate every session with its resolved geo_group so the page
    // can render Geo badges + per-geo aggregations without re-deriving.
    const sessions = sessionsRaw.map((s: any) => ({
      ...s,
      geo_group: getGeoGroup(s.ip_country) as GeoGroup,
    }));

    // Compute daily stats grouped by DUBAI calendar date
    const dailyStats: Record<string, any> = {};
    sessions.forEach((s: any) => {
      const day = utcToDubaiDate(s.created_at);
      if (!dailyStats[day]) {
        dailyStats[day] = { date: day, sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0, sources: {} };
      }
      dailyStats[day].sessions++;
      if (s.gclid && !s.gclid.startsWith('test')) dailyStats[day].with_gclid++;
      if (s.clicked_asins?.length > 0) {
        dailyStats[day].with_clicks++;
        dailyStats[day].total_asins += s.clicked_asins.length;
      }
      const src = s.traffic_source || 'unknown';
      dailyStats[day].sources[src] = (dailyStats[day].sources[src] || 0) + 1;
    });

    // Compute user-level stats from sessions with user_id
    const userMap: Record<string, any> = {};
    sessions.forEach((s: any) => {
      const uid = s.user_id;
      if (!uid) return;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id: uid,
          sessions: 0,
          first_seen: s.created_at,
          last_seen: s.created_at,
          sources: new Set(),
          pages: new Set(),
          total_asin_clicks: 0,
          has_gclid: false,
          gclid_sessions: 0,
          tags: new Set(),
          countries: new Set(),
          sites: new Set(),
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

    // Convert Sets to arrays for JSON serialization.
    // GEOS1: also resolve a primary geo_group per user, derived from their
    // first-known country. If multiple countries on file (VPN flips, etc.),
    // we use the first observed — a tiny edge case for the dashboard view.
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

    // Aggregate user stats
    const totalUsers = users.length;
    const returningUsers = users.filter((u: any) => u.is_returning).length;
    const crossSourceUsers = users.filter((u: any) => u.has_cross_source).length;
    const usersWithClicks = users.filter((u: any) => u.total_asin_clicks > 0).length;
    const usersWithGclid = users.filter((u: any) => u.has_gclid).length;
    const avgSessionsPerUser = totalUsers > 0 ? (users.reduce((s: number, u: any) => s + u.sessions, 0) / totalUsers).toFixed(1) : '0';
    const returningClickRate = returningUsers > 0
      ? ((users.filter((u: any) => u.is_returning && u.total_asin_clicks > 0).length / returningUsers) * 100).toFixed(1)
      : '0';
    const newClickRate = (totalUsers - returningUsers) > 0
      ? ((users.filter((u: any) => !u.is_returning && u.total_asin_clicks > 0).length / (totalUsers - returningUsers)) * 100).toFixed(1)
      : '0';

    // ── GEOS1: per-geo aggregate (Overview KPI strip + Funnel per-geo cards)
    const byGeo: Record<string, { sessions: number; with_gclid: number; with_clicks: number; total_asins: number }> = {
      gulf:          { sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0 },
      europe:        { sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0 },
      international: { sessions: 0, with_gclid: 0, with_clicks: 0, total_asins: 0 },
    };
    sessions.forEach((s: any) => {
      const bucket = byGeo[s.geo_group];
      if (!bucket) return;
      bucket.sessions++;
      if (s.gclid && !s.gclid.startsWith('test')) bucket.with_gclid++;
      if (s.clicked_asins?.length > 0) {
        bucket.with_clicks++;
        bucket.total_asins += s.clicked_asins.length;
      }
    });

    // ── GEOS1: top countries panel (Overview).
    // Ordered by session count, each annotated with its geo_group.
    const countryCounts: Record<string, number> = {};
    sessions.forEach((s: any) => {
      const cc = s.ip_country || '_unknown';
      countryCounts[cc] = (countryCounts[cc] || 0) + 1;
    });
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, count]) => ({
        code,
        count,
        geo_group: code === '_unknown' ? 'international' : getGeoGroup(code),
      }));

    // ── GEOS1 v2: per-program rollup (Tag Pool tab By-Program panel).
    // Each program tracks: how many tag_pool inventory rows it owns,
    // how many sessions it received in the date range, and clickouts.
    //
    // Tag-count rules:
    //   ae    — all tag_pool rows tagged 'gads' / 'seo' / 'direct' / 'seo_reserve'
    //           / 'other_geo' (the UAE Amazon Associates account family)
    //   other — exactly one row matching the program's defaultTag
    const UAE_TAG_TYPES = new Set(['gads', 'seo', 'direct', 'seo_reserve', 'other_geo']);
    const byProgram: Record<GeoProgram, { sessions: number; clicks: number; tags: number; group: GeoGroup; amazonDomain: string; defaultTag: string }> = {} as any;
    ALL_PROGRAMS.forEach(prog => {
      const cfg = getProgramConfig(prog);
      const tagsForProgram = prog === 'ae'
        ? tagPool.filter((t: any) => UAE_TAG_TYPES.has(t.tag_type)).length
        : tagPool.filter((t: any) => t.tag_id === cfg.defaultTag).length;
      const progSessions = sessions.filter((s: any) => getGeoProgram(s.ip_country) === prog);
      byProgram[prog] = {
        group: cfg.group,
        amazonDomain: cfg.amazonDomain,
        defaultTag: cfg.defaultTag,
        tags: tagsForProgram,
        sessions: progSessions.length,
        clicks: progSessions.filter((s: any) => s.clicked_asins?.length > 0).length,
      };
    });

    return NextResponse.json({
      tag_pool: tagPool,
      sessions: sessions,
      daily_stats: Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      users: users,
      by_geo: byGeo,
      top_countries: topCountries,
      by_program: byProgram,
      user_summary: {
        total_users: totalUsers,
        new_users: totalUsers - returningUsers,
        returning_users: returningUsers,
        cross_source_users: crossSourceUsers,
        users_with_clicks: usersWithClicks,
        users_with_gclid: usersWithGclid,
        avg_sessions: avgSessionsPerUser,
        returning_click_rate: returningClickRate,
        new_click_rate: newClickRate,
      },
      meta: {
        total_sessions: sessions.length,
        date_range: { from: since, to: new Date().toISOString(), days: daysBack },
        geo_filter: geoFilter,
        country_filter: countryFilter || null,
        timezone: 'Asia/Dubai (UTC+4)',
        generated_at: new Date().toISOString(),
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Admin tracking API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}