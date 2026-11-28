// ============================================================
// home-featured.ts — STATIC data for the homepage "magazine" sections.
// Created 2026-11-28 (homepage magazine PR).
//
// WHY: the homepage should hand crawlers a rich set of plain <a href> internal
// links (top guides + blog posts + videos) instead of leaning only on sitemaps.
// COST GUARD: this is a COMMITTED STATIC snapshot — the homepage imports it
// synchronously, so there are ZERO per-request Supabase calls on the home (same
// discipline as lib/related-pages.ts / lib/store-tags.generated.json). The home
// stays statically prerendered per locale; no DB on the hot path, no new routes.
//
// ── TOP /best GUIDES (HOME_TOP_BEST) ─────────────────────────────────────────
// Covers every locale the home serves: en, ar, ja, pt, de, es, fr, it, nl, pl, sv.
// Source = our own ranking data, intersected with a curated MAINSTREAM set so the
// home shows broad, sensible categories (owner's standing "worldwide, most-
// searchable, that make sense" rule — see lib/related-pages.ts). Native anchors
// per locale (en uses curated English labels):
//   • en, pt, de, es, fr, it, nl, pl, sv → public.sitemap_top_slugs, ranked by `rk`.
//   • ar, ja                             → public.seo_index_allowlist (active), by `score`.
// Only currently-ranking slugs are emitted, so a page that loses its products
// simply drops out of the NEXT snapshot instead of becoming a dead/thin link.
//
// REFRESH (monthly, or after a big ranking shift): run `node scripts/gen-home-featured.mjs`
// (reads .env.local; a READ, no write window needed) → it rewrites
// home-featured.generated.json → open a small PR. The generator holds the MAINSTREAM
// set, the per-locale source, the curated EN labels and the bad-noun exclusions.
//
// ── FROM OUR BLOG (HOME_TOP_POSTS) ───────────────────────────────────────────
// A hand-picked set of our strongest evergreen guides from content/blog/posts.json.
// House rule for anything shown on the home (owner via Manager 6.10, 2026-11-28):
// no prices, and never surface "Amazon"/"Prime Day" in the text — so posts whose
// TITLE names Amazon or a price are deliberately excluded here. English only for
// now (the blog is served in English; localized blog is a separate, future flip).
// ============================================================

import featured from './home-featured.generated.json';

export interface FeaturedLink {
  /** /best slug — the public, market-less URL is /best/<slug>. */
  slug: string;
  /** Anchor text: curated English label (en) or the native noun (ar/ja). */
  name: string;
}

const HOME_TOP_BEST: Record<string, FeaturedLink[]> = featured as Record<string, FeaturedLink[]>;

/** Top /best guides for a locale, or [] when we have no curated set for it
 *  (e.g. pt / single-language locales keep their own existing featured lists). */
export function getTopBest(locale: string): FeaturedLink[] {
  return HOME_TOP_BEST[locale] ?? [];
}

export interface BlogPick {
  /** /blog slug (file post in content/blog/posts.json). */
  slug: string;
  /** The real post title (good anchor text; verified Amazon-free + price-free). */
  title: string;
}

// 6 evergreen, broadly-useful guides that map to our strongest categories.
// Titles copied verbatim from content/blog/posts.json (kept in sync by hand).
export const HOME_TOP_POSTS: BlogPick[] = [
  { slug: 'how-to-compare-products', title: 'How to Compare Products Like a Pro Before You Buy' },
  { slug: 'guide-to-buying-a-laptop', title: 'A Guide to Buying Your Next Laptop — What to Look For in 2026' },
  { slug: 'how-to-pick-wireless-earbuds', title: 'How to Pick the Perfect Wireless Earbuds for Every Budget' },
  { slug: 'guide-to-air-fryers', title: 'A Guide to Air Fryers — Size, Wattage, and What Nobody Tells You' },
  { slug: 'how-to-choose-vacuum-cleaner', title: 'How to Choose the Right Vacuum Cleaner for Your Home' },
  { slug: 'guide-to-smart-tvs', title: 'A Guide to Smart TVs — Screen Size, Resolution, and What Actually Matters' },
];
