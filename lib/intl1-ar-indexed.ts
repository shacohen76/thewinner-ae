// ============================================
// INTL1 Phase 3 — Arabic indexing allowlist (SINGLE SOURCE OF TRUTH)
// ============================================
// Created: 2026-06-03 (INTL1 Phase 3 — index + hreflang launch)
//
// The ONE list of Arabic /best pages allowed to be indexed by search engines.
// Read by THREE places that MUST always agree — if they disagree, Google
// reports "no return tags" or an indexed page points hreflang at a noindexed
// one, and Arabic fails to rank:
//   1. middleware.ts          — stops stamping `X-Robots-Tag: noindex` on these
//                               /ar/best pages (PR 3.3)
//   2. lib/seo-alternates.ts  — emits the reciprocal `ar` hreflang ONLY for these
//   3. app/sitemap.ts         — lists the /ar/best URL (with alternates) ONLY
//                               for these (PR 3.2)
//
// Expanding a batch = add slugs here + PR + deploy (each batch reviewed live).
// A plain code file (not a DB flag) because the edge middleware decides noindex
// per request and cannot query the DB — baking the list into the build is the
// only edge-safe option anyway. See roadmap v2_0 §Phase 3.
//
// Phase 3 indexes /best keyword pages ONLY; home/category come in a later batch.
// EMPTY here on purpose: PR 3.1 (this) and PR 3.2 ship it empty as a verified
// no-op (English byte-identical, all /ar still noindex). PR 3.3 populates batch 1.
// ============================================

export const AR_INDEXED_BEST_SLUGS: ReadonlySet<string> = new Set<string>([
  // ── Phase 3 BATCH 1 (launched 2026-06-03) ────────────────────────────────
  // Top-traffic /best keywords (30-day sessions) that have full Arabic coverage
  // (title + WWL + buying guide). Expand by adding slugs here after watching GSC.
  'earbuds',
  'tefal-iron',
  'mobile-phones',
  'laptops',
  'nokia-phone',
  'steam-irons',
  'xiaomi-watches',
  'air-fryers',
  'gaming-laptops',
  '100-inch-tv',
  'breast-pumps',
  'vibration-platform-machine',
  'hair-straightener',
  'laptop',
  'tablets',
]);

// True only for a /best/<slug> whose slug is in the allowlist. Slugs are stored
// lowercase + decoded so this matches regardless of how the URL was encoded.
export function isArBestSlugIndexed(slug: string): boolean {
  try {
    return AR_INDEXED_BEST_SLUGS.has(decodeURIComponent(slug).toLowerCase());
  } catch {
    // Malformed percent-encoding → treat as not indexed (safe default).
    return AR_INDEXED_BEST_SLUGS.has(slug.toLowerCase());
  }
}

// Path-based variant for the metadata helper / sitemap. Only /best/<slug> paths
// are eligible for indexing in Phase 3; every other /ar path stays noindex.
export function isArPathIndexed(path: string): boolean {
  const m = /^\/best\/(.+)$/.exec(path);
  return m ? isArBestSlugIndexed(m[1]) : false;
}
