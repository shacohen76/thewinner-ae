// ============================================
// On-demand ISR revalidation — /api/revalidate
// ============================================
// Created: 2026-08-19 (rerank rollout).
// WHY: /best/[slug]/page.tsx has `revalidate = 604800` (7-day ISR). After a rerank
// migrate updates keyword_products.rank in Supabase, the cached pages keep serving
// the OLD order for up to 7 days. This endpoint lets the rerank pipeline (or an
// admin) force-regenerate specific /best/<slug> pages immediately, so a reranked
// order becomes visible within seconds instead of waiting out the cache.
//
// AUTH: Bearer <REVALIDATE_SECRET> (falls back to CRON_SECRET), same pattern as the
// existing cron routes. Set REVALIDATE_SECRET in the Vercel project env.
//
// USAGE:
//   curl -X POST https://thewinners.ae/api/revalidate \
//     -H "Authorization: Bearer $REVALIDATE_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"slugs":["nokia-phone","air-fryer"]}'
//   (single: {"slug":"nokia-phone"})  ·  (also localizes /ar and /ja variants)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// '' = default (public /best/<slug>); localized variants live under /ar and /ja.
const LOCALE_PREFIXES = ['', 'ar', 'ja'];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.REVALIDATE_SECRET || process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string; slugs?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // fall through to the empty-slugs guard below
  }

  const slugs = Array.isArray(body.slugs)
    ? body.slugs
    : typeof body.slug === 'string'
      ? [body.slug]
      : [];

  const clean = slugs
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0 && !s.includes('/'));

  if (clean.length === 0) {
    return NextResponse.json(
      { error: 'Provide a non-empty "slug" or "slugs" array' },
      { status: 400 },
    );
  }

  const revalidated: string[] = [];
  for (const slug of clean) {
    for (const prefix of LOCALE_PREFIXES) {
      const path = prefix ? `/${prefix}/best/${slug}` : `/best/${slug}`;
      revalidatePath(path);
      revalidated.push(path);
    }
  }

  return NextResponse.json({
    ok: true,
    slugs: clean.length,
    paths: revalidated.length,
    revalidated,
    timestamp: new Date().toISOString(),
  });
}
