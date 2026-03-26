// ============================================
// Tag Expiry Cron — /api/cron/release-tags
// ============================================
// Created: 2026-03-27
// Runs every 30 minutes via Vercel cron.
// Releases tags that have been busy longer than TAG_HOLD_HOURS.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { releaseExpiredTags } from '@/lib/tracking';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const releasedCount = await releaseExpiredTags();

    return NextResponse.json({
      ok: true,
      released: releasedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron release-tags error:', error);
    return NextResponse.json(
      { error: 'Failed to release tags' },
      { status: 500 }
    );
  }
}
