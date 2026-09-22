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
//   Scoped (2026-09-23): add "locale" and/or "market" to refresh only those copies:
//     -d '{"slugs":["air-fryers"],"locale":"ja"}'        → ja/jp copy only
//     -d '{"slugs":["air-fryers"],"locale":"en","market":"us"}' → en/us copy only
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { bestPageCopies, catalogTag, catalogCopyTag, isKnownLocale, isKnownMarket } from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

// '' = default (public /best/<slug>); localized variants live under /ar and /ja.
const LOCALE_PREFIXES = ['', 'ar', 'ja'];

// ── 2026-08-30 (per-geo-static revalidation fix) ────────────────────────────
// BUG THIS FIXES: since feat/per-geo-static-best (2026-08-26), middleware rewrites
// the public /best/<slug> to an INTERNAL /<locale>/best/<market>/<slug>, and Next
// caches one static ISR variant PER (locale × market × slug). This endpoint,
// written before that change, only revalidatePath'd the OLD public paths
// (/best/<slug>, /ar/..., /ja/...) — which no longer have a cache entry (every
// request is rewritten). Result: keyword_products updates (incl. the AE rerank
// rollback) did NOT propagate to the live per-market pages until the 7-day ISR
// window lapsed, and crawlers (pinned to the 'ae' market) kept indexing the stale
// catalog. FIX: revalidatePath the actual internal per-market paths below.
// Markets + locales come straight from geo-config/routing so this can't drift.
// (2026-09-23: the copies list moved to lib/cache-tags.ts → bestPageCopies.)
//
// ── 2026-09-23 (scoped refresh signals — Vercel cost fix) ───────────────────
// Optional `locale` and/or `market` in the body narrow the refresh to ONLY those
// copies (e.g. {"slugs":[...],"locale":"ja"} marks just the ja/jp copy instead of
// all ~19). Without them the behaviour is exactly as before (every copy + the
// shared data tag). A marked copy costs nothing until its next visitor triggers
// one rebuild.

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.REVALIDATE_SECRET || process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string; slugs?: string[]; locale?: string; market?: string } = {};
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

  // 2026-09-23: optional scope. Unknown values are rejected (a typo must not
  // silently refresh nothing — or everything).
  const locale = typeof body.locale === 'string' && body.locale ? body.locale : undefined;
  const market = typeof body.market === 'string' && body.market ? body.market : undefined;
  if (locale && !isKnownLocale(locale)) {
    return NextResponse.json({ error: `Unknown locale "${locale}"` }, { status: 400 });
  }
  if (market && !isKnownMarket(market)) {
    return NextResponse.json({ error: `Unknown market "${market}"` }, { status: 400 });
  }
  const scoped = !!(locale || market);

  const revalidated: string[] = [];
  for (const slug of clean) {
    if (!scoped) {
      // Legacy public paths — no longer hold a cache entry after per-geo-static
      // (every /best request is rewritten), but revalidating them is a harmless
      // no-op and keeps us safe if any non-rewritten fallback is ever reintroduced.
      for (const prefix of LOCALE_PREFIXES) {
        const path = prefix ? `/${prefix}/best/${slug}` : `/best/${slug}`;
        revalidatePath(path);
        revalidated.push(path);
      }
    }
    // 2026-08-30: the REAL cache entries — the internal per-market static variants
    // /<locale>/best/<market>/<slug> that middleware rewrites to.
    // 2026-09-23: only the copies in scope (all of them when unscoped), plus the
    // matching per-copy data tag so that copy's products data re-reads too.
    for (const copy of bestPageCopies(slug, { locale, market })) {
      revalidatePath(copy.path);
      revalidated.push(copy.path);
      if (scoped) revalidateTag(catalogCopyTag(slug, copy.market, copy.locale));
    }
    // 2026-08-25 (rerank-11): unscoped = purge the shared tag (every copy's data +
    // the /api/catalog cache), exactly as before.
    if (!scoped) revalidateTag(catalogTag(slug));
  }

  return NextResponse.json({
    ok: true,
    scope: scoped ? { locale: locale ?? 'all', market: market ?? 'all' } : 'all',
    slugs: clean.length,
    paths: revalidated.length,
    revalidated,
    timestamp: new Date().toISOString(),
  });
}
