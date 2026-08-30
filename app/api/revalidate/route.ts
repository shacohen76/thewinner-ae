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
import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOG_MARKETPLACES, LOCALE_CATALOG } from '@/lib/geo-config';
import { routing } from '@/i18n/routing';

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
const CATALOG_MARKETS = Array.from(CATALOG_MARKETPLACES);       // ae,us,uk,ca,ie,au,sg,jp
// Internal paths always carry a locale prefix (en included — middleware rewrites
// "/best/..." → "/en/best/..."). A locale pinned to one catalog (ja→jp) only ever
// renders that single market variant; others follow the visitor's geo (all markets).
function marketPathsForSlug(slug: string): string[] {
  const paths: string[] = [];
  for (const locale of routing.locales) {
    const markets = LOCALE_CATALOG[locale] ? [LOCALE_CATALOG[locale]] : CATALOG_MARKETS;
    for (const market of markets) paths.push(`/${locale}/best/${market}/${slug}`);
  }
  return paths;
}

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
    // Legacy public paths — no longer hold a cache entry after per-geo-static
    // (every /best request is rewritten), but revalidating them is a harmless
    // no-op and keeps us safe if any non-rewritten fallback is ever reintroduced.
    for (const prefix of LOCALE_PREFIXES) {
      const path = prefix ? `/${prefix}/best/${slug}` : `/best/${slug}`;
      revalidatePath(path);
      revalidated.push(path);
    }
    // 2026-08-30: the REAL cache entries — the internal per-market static variants
    // /<locale>/best/<market>/<slug> that middleware rewrites to. Purge every one
    // so a keyword_products update propagates to all markets (and the crawler-
    // indexed 'ae' variant) within seconds instead of the 7-day ISR window.
    for (const path of marketPathsForSlug(slug)) {
      revalidatePath(path);
      revalidated.push(path);
    }
    // 2026-08-25 (rerank-11): also purge the per-market catalog data served by
    // /api/catalog (tag `catalog:<slug>`). Now largely vestigial (the client
    // GeoCatalog swap was retired by per-geo-static), but kept — the tag is cheap
    // and still clears the /api/catalog cache if anything reads it.
    revalidateTag(`catalog:${slug}`);
  }

  return NextResponse.json({
    ok: true,
    slugs: clean.length,
    paths: revalidated.length,
    revalidated,
    timestamp: new Date().toISOString(),
  });
}
