// ============================================
// BestAuthorByline.tsx — E-E-A-T byline for /best pages (2026-09-05).
// Reuses the blog author set (content/blog/authors.json + AuthorAvatar) so each
// best-page shows a real editor with a photo, role, and "Updated" date — the
// "who + when" signal Google's product-review systems look for. Server component
// → rendered into the SSR HTML (crawlable). Author is chosen DETERMINISTICALLY
// by slug so a given page always shows the same editor (stable, cache-safe).
// ============================================

import authorsData from '@/content/blog/authors.json';
import AuthorAvatar from '@/components/blog/AuthorAvatar';

// Same gradient palette the blog uses for the initials fallback.
const AUTHOR_GRADIENTS: Record<string, string> = {
  'sarah-al-rashid': 'from-rose-500 to-red-600',
  'omar-hassan': 'from-blue-500 to-blue-600',
  'lina-mikhail': 'from-pink-500 to-pink-600',
  'youssef-nabil': 'from-green-500 to-green-600',
  'dina-karam': 'from-amber-500 to-amber-600',
  'tariq-sayed': 'from-purple-500 to-purple-600',
  'peter-gods': 'from-slate-600 to-zinc-800',
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface BestAuthorBylineProps {
  /** Current page slug — seeds the deterministic author pick. */
  slug: string;
  /** Localized "By" label. */
  byLabel: string;
  /** Localized "Updated {month} {year}" string, already formatted. */
  updatedText: string;
}

export default function BestAuthorByline({ slug, byLabel, updatedText }: BestAuthorBylineProps) {
  const authors = authorsData.authors;
  if (!authors || authors.length === 0) return null;
  const author = authors[hash(slug) % authors.length];
  const gradient = AUTHOR_GRADIENTS[author.id] || 'from-gray-500 to-gray-600';

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6">
      <div className="flex items-center gap-3">
        <AuthorAvatar
          name={author.name}
          avatar={author.avatar}
          sizeClass="w-10 h-10 text-sm"
          gradientClass={gradient}
        />
        <div className="text-sm text-gray-600 leading-tight">
          <div>
            {byLabel}{' '}
            <span className="font-semibold text-gray-800">{author.name}</span>
            <span className="text-gray-500"> · {author.role}</span>
          </div>
          <div className="text-gray-400">{updatedText}</div>
        </div>
      </div>
    </div>
  );
}
