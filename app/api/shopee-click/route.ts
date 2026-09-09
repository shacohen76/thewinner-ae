// Isolated Shopee click logging. Added 2026-09-09.
// INSERT-ONLY into `shopee_click` (no shared row with click_log → no write race
// with logAsinClick). Beacon-safe: always returns 200, never throws to the client.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { session_id, page_slug, offer_id, market } = await req.json();
    await admin()
      .from('shopee_click')
      .insert({
        session_id: session_id ?? null,
        page_slug: page_slug ?? null,
        offer_id: offer_id ?? null,
        market: market ?? 'sg',
      });
  } catch {
    // swallow — beacon must not surface errors
  }
  return NextResponse.json({ ok: true });
}
