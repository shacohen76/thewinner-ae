// ============================================
// Admin Tracking Data API — /api/admin/tracking
// ============================================
// Created: 2026-03-28
// Returns tracking data for the admin dashboard.
// Protected by ADMIN_PASSWORD env var.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  // Simple password protection
  const password = request.nextUrl.searchParams.get('key');
  const adminPassword = process.env.ADMIN_PASSWORD || 'tw2026admin';

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Date range from query params (default: last 7 days)
  const daysBack = parseInt(request.nextUrl.searchParams.get('days') || '7');
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Fetch all data in parallel
    const [tagPoolRes, sessionsRes] = await Promise.all([
      // Tag pool status
      supabase.from('tag_pool').select('tag_id,tag_type,status,assigned_at,expires_at'),

      // Sessions within date range
      supabase.from('click_log')
        .select('session_id,gclid,assigned_tag,traffic_source,landing_page,clicked_asins,click_timestamps,user_agent,ip_country,created_at,last_activity,status')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const tagPool = tagPoolRes.data || [];
    const sessions: any[] = sessionsRes.data || [];

    // Compute daily stats manually if RPC doesn't exist
    const dailyStats: Record<string, any> = {};
    sessions.forEach(s => {
      const day = s.created_at.substring(0, 10); // YYYY-MM-DD
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
        generated_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Admin tracking API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
