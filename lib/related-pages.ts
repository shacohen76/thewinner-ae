// ============================================
// related-pages.ts — curated pool for the bottom-of-page "More top picks" nav.
// Created 2026-09-05.
// WHY: internal links today all point at category pages, never BETWEEN best-pages.
// This gives Google real crawl paths + descriptive anchors among our strongest
// pages. Slugs are VERIFIED against live GSC data (2026-09-05) so no link 404s.
// The pool is static on purpose (cacheable, no DB read on the hot path).
// ============================================

export interface RelatedPage {
  slug: string;
  name: string;
}

// 32 top pages: highest-clicked (GSC) + owner-picked branded/high-intent slugs.
export const RELATED_POOL: RelatedPage[] = [
  { slug: 'nokia-phone', name: 'Nokia Phones' },
  { slug: 'tan-enhancers-accelerators', name: 'Tan Accelerators' },
  { slug: 'rasasi-hawas-perfume-for-men', name: 'Rasasi Hawas Perfume' },
  { slug: 'xiaomi-smartwatch', name: 'Xiaomi Smartwatches' },
  { slug: 'xiaomi-tablet', name: 'Xiaomi Tablets' },
  { slug: 'tefal-iron', name: 'Tefal Irons' },
  { slug: 'tennis-shoes', name: 'Tennis Shoes' },
  { slug: 'xiaomi-phones', name: 'Xiaomi Phones' },
  { slug: 'nothing-phone', name: 'Nothing Phones' },
  { slug: 'electric-air-duster', name: 'Electric Air Dusters' },
  { slug: 'steam-irons', name: 'Steam Irons' },
  { slug: 'xiaomi-vacuum-cleaners', name: 'Xiaomi Vacuum Cleaners' },
  { slug: 'david-beckham-parfum', name: 'David Beckham Parfum' },
  { slug: 'tower-fan', name: 'Tower Fans' },
  { slug: '2-in-1-shampoo-conditioner', name: '2-in-1 Shampoo & Conditioner' },
  { slug: 'thunderbolt-cables', name: 'Thunderbolt Cables' },
  { slug: 'amazfit-watches', name: 'Amazfit Watches' },
  { slug: 'kimbo-coffee-beans', name: 'Kimbo Coffee Beans' },
  { slug: 'karaoke-microphones', name: 'Karaoke Microphones' },
  { slug: 'field-hockey-shoes', name: 'Field Hockey Shoes' },
  { slug: 'earbuds', name: 'Earbuds' },
  { slug: 'tablets', name: 'Tablets' },
  { slug: 'electric-toothbrush', name: 'Electric Toothbrushes' },
  { slug: 'running-shoes', name: 'Running Shoes' },
  { slug: 'air-fryers', name: 'Air Fryers' },
  { slug: 'body-sunscreen', name: 'Body Sunscreen' },
  { slug: 'smart-door-lock', name: 'Smart Door Locks' },
  { slug: 'womens-perfume', name: "Women's Perfume" },
  { slug: 'baby-chairs', name: 'Baby Chairs' },
  { slug: '83-inch-smart-tv', name: '83" Smart TVs' },
  { slug: 'jbl-portable-speaker', name: 'JBL Portable Speakers' },
  { slug: 'hugo-boss-perfume-for-men', name: 'Hugo Boss Perfume for Men' },
  // Strong cross-category adds (2026-09-06) — GSC-verified / owner strong picks.
  { slug: 'roborock-vacuum-cleaners', name: 'Roborock Vacuum Cleaners' },
  { slug: 'via-ferrata-set', name: 'Via Ferrata Sets' },
  { slug: 'butterfly-table-tennis-racket', name: 'Butterfly Table Tennis Rackets' },
  { slug: 'my-perfume-perfume-100ml', name: 'Perfumes' },
];

// Geos rotated into the anchor text ("… in {geo}") — the FULL set of program /
// monitored markets (2026-09-06), so the nav showcases the whole geo reach
// (UAE → Saudi → Japan → Brazil). RelatedPages shows one link per geo, so each
// market appears once. Source of truth = MARKETPLACES in amz_purchase_scraper_geo.py
// (+ Brazil, which has a live amazon.com.br touchpoint).
export const RELATED_GEOS: string[] = [
  'UAE', 'Saudi Arabia', 'USA', 'UK', 'Canada', 'Ireland',
  'Australia', 'Singapore', 'Japan', 'Germany', 'France', 'Spain',
  'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Brazil',
];
