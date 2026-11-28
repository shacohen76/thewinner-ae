// ============================================
// HomeFromBlog.tsx — homepage "From Our Blog" card row.
// Server component → <a href="/blog/…"> links are in the raw SSR HTML (crawlable).
// Posts are a hand-picked static set (lib/home-featured HOME_TOP_POSTS); no DB.
// Rendered on the English home only (the blog is served in English today).
// ============================================

import { Link } from '@/i18n/navigation';
import type { BlogPick } from '@/lib/home-featured';

interface Props {
  title: string;
  sub: string;
  cta: string;
  posts: BlogPick[];
}

export default function HomeFromBlog({ title, sub, cta, posts }: Props) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">{title}</h2>
          <p className="text-gray-500 text-lg">{sub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 group"
            >
              <h3 className="font-bold text-lg text-gray-800 mb-3 leading-snug group-hover:text-blue-600 transition-colors">
                {p.title}
              </h3>
              <span className="inline-flex items-center text-blue-600 font-medium text-sm">
                {cta}
                <svg className="w-4 h-4 ms-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
