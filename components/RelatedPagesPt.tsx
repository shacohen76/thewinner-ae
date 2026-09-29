// ============================================
// RelatedPagesPt.tsx — /pt (Brazil) "Mais recomendações" internal-link nav.
// Created 2026-09-29. Mirror of components/RelatedPages.tsx for the pt locale:
// server component (links are in the SSR HTML, crawlable), DETERMINISTIC selection
// seeded by the current slug (ISR-cache-safe, no hydration mismatch — never
// Math.random()). Links only to complete /pt pages (lib/related-pages-pt.ts), so a
// Brazilian reader never lands on an English page. No per-link geo: pt = Brazil.
// ============================================

import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RELATED_POOL_PT } from '@/lib/related-pages-pt';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface RelatedPagesPtProps {
  /** The current page's slug (decoded, lowercased) — excluded from the list. */
  currentSlug: string;
  /** How many links to show (same default as the EN nav). */
  count?: number;
}

export default async function RelatedPagesPt({ currentSlug, count = 18 }: RelatedPagesPtProps) {
  const pool = RELATED_POOL_PT.filter((p) => p.slug !== currentSlug);
  if (pool.length === 0) return null;
  const t = await getTranslations('BestPage');

  const seed = hash(currentSlug);
  const n = Math.min(count, pool.length);
  const picks = Array.from({ length: n }, (_, i) => pool[(seed + i) % pool.length]);

  return (
    <nav aria-label={t('morePicks')} className="bg-gray-50 border-t">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
          {t('morePicks')}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {picks.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/best/${p.slug}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Top 10 de {p.noun}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
