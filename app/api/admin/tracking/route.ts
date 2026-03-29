// ============================================
// Admin Tracking Data API — /api/admin/tracking
// ============================================
// Created: 2026-03-28
// Last Modified: 2026-03-28
// v1.1: Fixed timezone — uses Dubai time (UTC+4) for calendar day boundaries
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const geoFilter = request.nextUrl.searchParams.get('geo') || 'ae'; // 'ae' = UAE only (default), 'all' = everything

  try {
    // Fetch all data in parallel
    let sessionsQuery = supabase.from('click_log')
      .select('session_id,gclid,assigned_tag,traffic_source,landing_page,clicked_asins,click_timestamps,user_agent,ip_country,created_at,last_activity,status')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    // Default: only show AE traffic for clean funnel data
    if (geoFilter === 'ae') {
      sessionsQuery = sessionsQuery.eq('ip_country', 'AE');
    }

    const [tagPoolRes, sessionsRes] = await Promise.all([
      // Tag pool status
      supabase.from('tag_pool').select('tag_id,tag_type,status,assigned_at,expires_at'),
      sessionsQuery,
    ]);

    const tagPool = tagPoolRes.data || [];
    const sessions: any[] = sessionsRes.data || [];

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

    return NextResponse.json({
      tag_pool: tagPool,
      sessions: sessions,
      daily_stats: Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      meta: {
        total_sessions: sessions.length,
        date_range: { from: since, to: new Date().toISOString(), days: daysBack },
        geo_filter: geoFilter,
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
