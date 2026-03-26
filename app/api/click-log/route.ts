// ============================================
// Click Log API — /api/click-log
// ============================================
// Created: 2026-03-27
// Logs which ASINs a visitor clicked (for reconciliation matching).
// Called via navigator.sendBeacon on each affiliate click.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { logAsinClick } from '@/lib/tracking';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { session_id, asin } = body;

    if (!session_id || !asin) {
      return NextResponse.json(
        { error: 'session_id and asin are required' },
        { status: 400 }
      );
    }

    const success = await logAsinClick(session_id, asin);

    if (!success) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Click log error:', error);
    // Always return 200 for sendBeacon — errors shouldn't block the user
    return NextResponse.json({ ok: false });
  }
}
