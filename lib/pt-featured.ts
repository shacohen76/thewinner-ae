// ============================================
// /pt featured links — BR 1 (2026-09-26)
// ============================================
// The home page + footer link to a few "popular" /best pages. The en/ar/ja lists
// point at UAE-catalog slugs that have no Brazilian page, so /pt uses its own list of
// BR pages (all have a pt noun + BR catalog). Labels live in messages/pt.json
// (Home.searches.<slug>, Home.comparisons.<slug>, Footer.popularItems.<slug>).
// Swap slugs here as BR grows — no other code change needed.
// ============================================

export const PT_POPULAR_SEARCHES = ['gaming-laptops', 'air-fryers', 'smart-watches', 'baby-bottles'];

export const PT_POPULAR_COMPARISONS = [
  { slug: 'gaming-laptops', icon: '💻', gradient: 'from-purple-500 to-indigo-600' },
  { slug: 'air-fryers', icon: '🍟', gradient: 'from-amber-500 to-orange-600' },
  { slug: 'smart-watches', icon: '⌚', gradient: 'from-blue-500 to-cyan-600' },
  { slug: 'vacuum-cleaners', icon: '🧹', gradient: 'from-rose-500 to-red-600' },
  { slug: 'baby-bottles', icon: '🍼', gradient: 'from-green-500 to-teal-600' },
  { slug: 'dog-food', icon: '🐶', gradient: 'from-gray-600 to-gray-800' },
];

export const PT_FOOTER_POPULAR = ['gaming-laptops', 'air-fryers', 'smart-watches', 'vacuum-cleaners'];
