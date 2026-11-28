// ============================================
// HomeTopBest.tsx — homepage "Popular Buying Guides" link grid.
// Server component → every <a href="/best/…"> is in the raw SSR HTML (crawlable,
// no JS needed). Data is a static per-locale snapshot (lib/home-featured) ranked
// by our own click/GSC score; no DB on the hot path. Native anchors per locale.
// ============================================

import { Link } from '@/i18n/navigation';
import type { FeaturedLink } from '@/lib/home-featured';

interface Props {
  title: string;
  sub: string;
  items: FeaturedLink[];
}

export default function HomeTopBest({ title, sub, items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">{title}</h2>
          <p className="text-gray-500 text-lg">{sub}</p>
        </div>

        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <li key={it.slug}>
              <Link
                href={`/best/${it.slug}`}
                className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-colors"
              >
                <span className="font-medium text-sm leading-snug">{it.name}</span>
                <svg className="w-4 h-4 shrink-0 text-gray-400 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
