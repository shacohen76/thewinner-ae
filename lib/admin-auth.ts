// Admin auth for the Market Pulse routes (2026-11-15).
// Same rule as /api/admin/tracking: ADMIN_PASSWORD must be set (no built-in fallback -> 503), constant-time compare.
// The key travels in the `x-admin-key` HEADER (not the URL), so it never lands in access logs.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export function adminAuthError(request: NextRequest, tag: string): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error(`[${tag}] ADMIN_PASSWORD is not set — refusing request`);
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 });
  }
  const given = Buffer.from(request.headers.get('x-admin-key') ?? '', 'utf8');
  const expected = Buffer.from(adminPassword, 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
