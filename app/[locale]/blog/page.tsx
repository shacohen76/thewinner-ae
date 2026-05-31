import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getAllPosts, getAllTags } from '@/lib/blog';
import BlogCard from '@/components/blog/BlogCard';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thewinner.ae';
const CANONICAL_URL = process.env.NEXT_PUBLIC_CANONICAL_URL || SITE_URL;
const SITE_NAME = 'The Winners';

export const metadata: Metadata = {
  title: `Blog | ${SITE_NAME}`,
  description:
    'Expert buying guides, product tips, and honest advice from our team of reviewers. Learn how to shop smarter in the UAE.',
  alternates: { canonical: `${CANONICAL_URL}/blog` },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description:
      'Expert buying guides, product tips, and honest advice from our team of reviewers.',
    url: `${CANONICAL_URL}/blog`,
    siteName: SITE_NAME,
    locale: 'en_AE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `Blog | ${SITE_NAME}`,
    description:
      'Expert buying guides, product tips, and honest advice from our team of reviewers.',
  },
};

// Tier labels + colors for filter chips
const TIER_INFO: Record<number, { label: string; color: string }> = {
  1: { label: 'Shopping Guides', color: 'bg-green-100 text-green-700 border-green-200' },
  2: { label: 'Category Deep Dives', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  3: { label: 'Lifestyle', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  4: { label: 'Recipes & Entertainment', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export default function BlogIndexPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);

  const posts = getAllPosts();

  // Group by tier for section headers
  const tiers = [1, 2, 3, 4];

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-800 font-medium">Blog</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            The Winners Blog
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Expert buying guides, honest product advice, and tips from our team — 
            everything you need to shop smarter in the UAE.
          </p>
        </div>
      </section>

      {/* Posts by tier */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {tiers.map((tier) => {
          const tierPosts = posts.filter((p) => p.tier === tier);
          if (tierPosts.length === 0) return null;
          const info = TIER_INFO[tier];

          return (
            <section key={tier} className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${info.color}`}
                >
                  {info.label}
                </span>
                <span className="text-sm text-gray-400">
                  {tierPosts.length} {tierPosts.length === 1 ? 'article' : 'articles'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tierPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* JSON-LD for Blog listing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            '@id': `${SITE_URL}/blog#blog`,
            url: `${SITE_URL}/blog`,
            name: `${SITE_NAME} Blog`,
            description:
              'Expert buying guides, product tips, and honest advice for UAE shoppers.',
            publisher: {
              '@type': 'Organization',
              name: SITE_NAME,
              url: SITE_URL,
            },
            blogPost: posts.slice(0, 10).map((p) => ({
              '@type': 'BlogPosting',
              headline: p.title,
              url: `${SITE_URL}/blog/${p.slug}`,
              datePublished: p.publish_date,
              author: {
                '@type': 'Person',
                name: p.author.name,
              },
            })),
          }),
        }}
      />
    </>
  );
}
