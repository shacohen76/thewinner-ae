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

// SIMPLE, mainstream, globally-searched products only (rebuilt 2026-09-06, owner
// req "worldwide, most-searchable, that make sense" — dropped niche AE-only slugs
// like via-ferrata / field-hockey / cigarette-cases). Every slug is VERIFIED
// against live GSC data so no link 404s. Wide niche spread on purpose.
export const RELATED_POOL: RelatedPage[] = [
  // Phones & tablets
  { slug: 'nokia-phone', name: 'Nokia Phones' },
  { slug: 'xiaomi-phones', name: 'Xiaomi Phones' },
  { slug: 'nothing-phone', name: 'Nothing Phones' },
  { slug: 'samsung-galaxy-phones', name: 'Samsung Galaxy Phones' },
  { slug: 'xiaomi-tablet', name: 'Xiaomi Tablets' },
  { slug: 'samsung-tablets', name: 'Samsung Tablets' },
  // Computers & accessories
  { slug: 'gaming-laptops', name: 'Gaming Laptops' },
  { slug: 'asus-laptops', name: 'ASUS Laptops' },
  { slug: 'macbook-air', name: 'MacBook Air' },
  { slug: 'power-bank', name: 'Power Banks' },
  { slug: 'phone-charger', name: 'Phone Chargers' },
  { slug: 'logitech-wireless-mouse', name: 'Logitech Wireless Mice' },
  { slug: 'portable-monitor', name: 'Portable Monitors' },
  // Audio & wearables
  { slug: 'airpods', name: 'AirPods' },
  { slug: 'xiaomi-earbuds', name: 'Xiaomi Earbuds' },
  { slug: 'jbl-headphones', name: 'JBL Headphones' },
  { slug: 'amazfit-watches', name: 'Amazfit Watches' },
  { slug: 'xiaomi-smartwatch', name: 'Xiaomi Smartwatches' },
  // Cameras & TV
  { slug: 'dslr-camera', name: 'DSLR Cameras' },
  { slug: 'instant-cameras', name: 'Instant Cameras' },
  { slug: 'fujifilm-digital-cameras', name: 'Fujifilm Cameras' },
  { slug: 'xiaomi-tvs', name: 'Xiaomi TVs' },
  // Home & kitchen
  { slug: 'steam-irons', name: 'Steam Irons' },
  { slug: 'tower-fan', name: 'Tower Fans' },
  { slug: 'vacuum-cleaners', name: 'Vacuum Cleaners' },
  { slug: 'roborock-vacuum-cleaners', name: 'Roborock Vacuum Cleaners' },
  { slug: 'coffee-machines', name: 'Coffee Machines' },
  { slug: 'kettles', name: 'Electric Kettles' },
  { slug: 'blenders', name: 'Blenders' },
  { slug: 'ninja-foodi', name: 'Ninja Foodi' },
  { slug: 'air-fryers', name: 'Air Fryers' },
  // Grooming & beauty
  { slug: 'electric-toothbrush', name: 'Electric Toothbrushes' },
  { slug: 'hair-straightener', name: 'Hair Straighteners' },
  { slug: 'electric-hair-brush', name: 'Electric Hair Brushes' },
  { slug: '2-in-1-shampoo-conditioner', name: '2-in-1 Shampoo & Conditioner' },
  { slug: 'razors', name: 'Razors' },
  { slug: 'night-cream-for-all-skin-types', name: 'Night Cream' },
  { slug: 'face-moisturizers', name: 'Face Moisturizers' },
  { slug: 'rasasi-hawas-perfume-for-men', name: 'Rasasi Hawas Perfume' },
  { slug: 'dolce-gabbana-parfum-men', name: 'Dolce & Gabbana Perfume' },
  { slug: 'my-perfume-perfume-100ml', name: 'Perfumes' },
  // Baby & pet
  { slug: 'milk-powder-for-baby', name: 'Baby Milk Powder' },
  { slug: 'baby-chairs', name: 'Baby Chairs' },
  { slug: 'cat-food', name: 'Cat Food' },
  { slug: 'dog-food', name: 'Dog Food' },
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
