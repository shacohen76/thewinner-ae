// ============================================
// RelatedPages.tsx — bottom-of-page "More top picks" internal-link nav.
// Created 2026-09-05. Server component → the links are in the raw SSR HTML
// (crawlable). Selection is DETERMINISTIC (seeded by the current slug): stable
// across renders, ISR-cache-safe, no server/client hydration mismatch — never
// use Math.random() here (that was the React #425 bug fixed in b94c4cb).
// ============================================

import { Link } from '@/i18n/navigation';
import { RELATED_POOL, RELATED_GEOS } from '@/lib/related-pages';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface RelatedPagesProps {
  /** The current page's slug (decoded, lowercased) — excluded from the list. */
  currentSlug: string;
  /** How many links to show. */
  count?: number;
}

export default function RelatedPages({ currentSlug, count = RELATED_GEOS.length }: RelatedPagesProps) {
  const pool = RELATED_POOL.filter((p) => p.slug !== currentSlug);
  if (pool.length === 0) return null;

  const seed = hash(currentSlug);
  const n = Math.min(count, pool.length);
  const picks = Array.from({ length: n }, (_, i) => ({
    ...pool[(seed + i) % pool.length],
    geo: RELATED_GEOS[(seed + i) % RELATED_GEOS.length],
  }));

  return (
    <nav aria-label="More top picks" className="bg-gray-50 border-t">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
          More top picks
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {picks.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/best/${p.slug}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                10 Best {p.name} in {p.geo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
