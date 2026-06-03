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
  // ── Phase 3 INDEXED SET — top 100 by 30-day traffic (expanded 2026-06-03) ──
  // Translated /best keywords ordered by sessions. All have an Arabic buying
  // guide + headline; product titles/WWL average ~98%/97% Arabic coverage
  // (gaps fall back to English per product). Superset of the original launch-15.
  // Expand further by adding slugs here after watching GSC on this set.
  'earbuds',
  'tefal-iron',
  'mobile-phones',
  'laptops',
  'nokia-phone',
  'steam-irons',
  'air-fryers',
  'xiaomi-watches',
  'gaming-laptops',
  '100-inch-tv',
  'breast-pumps',
  'xiaomi-tablet',
  'vibration-platform-machine',
  'hair-straightener',
  'laptop',
  'tablets',
  'via-ferrata-set',
  'tennis-shoes',
  'field-hockey-shoes',
  'skateboarding-shoes',
  'ink-tank-printers',
  'xiaomi-smartwatch',
  'steam-iron',
  '2-in-1-shampoo-conditioner',
  'mini-velo-bikes',
  'sunscreen',
  'powerful-laptop',
  'snorkel-vests',
  'facial-sunscreen',
  'steam-cleaners',
  'tan-enhancers-accelerators',
  'tower-fan',
  'lavazza-coffee',
  'water-flosser',
  'oppo-phone',
  'pacifiers',
  'wig-head-stands',
  'soaps',
  'xiaomi-speaker',
  'instant-coffee',
  'rasasi-hawas-perfume-for-men',
  'samsung-phones',
  'xiaomi-vacuum-cleaners',
  '65w-charger',
  'cigarette-cases',
  'fat-burners',
  'perfume-for-men',
  'thunderbolt-cables',
  'car-air-freshener',
  'cordless-vacuum',
  'dishwashers',
  'new-balance-sneakers',
  'robot-vacuums',
  'student-laptops',
  'trimmers',
  'butterfly-table-tennis-racket',
  'dog-food',
  'electric-air-duster',
  'ipl-hair-removal',
  'portable-nebulizer',
  'portable-projector',
  'perfumes-for-men',
  'scales',
  'smart-watches',
  'torch-lights',
  'volleyball-shoes',
  'weight-lifting-gloves',
  'wireless-carplay-adapter',
  'formula',
  'irons',
  'nasal-irrigators',
  'turkish-coffee-machines',
  'coffee-machines',
  'garmin-smartwatch',
  'interdental-brushes',
  'lighters',
  'power-bank',
  'walking-pad',
  'anti-aging-cream',
  'asus-vivobook',
  'cellulite-massagers',
  'cordless-screwdrivers',
  'earbuds-with-noise-cancellation',
  'karaoke-microphones',
  'nothing-phone',
  'pool-toys',
  'printers',
  'roborock',
  'vacuum-cleaners',
  'wifi-mesh-system',
  "women's-perfume",
  'dreame-vacuum-cleaners',
  'electric-toothbrushes',
  'instant-cameras',
  'jbl-headphones',
  'open-ear-headphones',
  'projectors',
  'sleep-earbuds',
  'tool-bags',
  'wireless-earbuds',
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
