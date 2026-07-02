// ============================================
// Tag Pool Maintenance Cron — /api/cron/maintain-tag-pool
// ============================================
// Created: 2026-05-19
// Runs every 15 minutes via Vercel cron.
// - Promotes tags that crossed 4-order threshold to is_stable=true
// - Graduates stable cohort members (clears seeding_cohort flag)
// - Tops up the seeding cohort back to TRACKING_CONFIG.seedingCohortSize
// - Sends Telegram alert if reserve pool drops below poolLowThreshold
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { maintainTagPool } from '@/lib/tracking';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await maintainTagPool();
    // 2026-07-02: result now carries its own `ok` flag (false when a key/RLS/write
    // problem was detected). Don't hardcode ok:true — let the real status surface.
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron maintain-tag-pool error:', error);
    return NextResponse.json(
      { error: 'Failed to maintain tag pool', details: String(error) },
      { status: 500 }
    );
  }
}
