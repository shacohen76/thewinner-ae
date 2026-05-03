import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllSlugs, getPostBySlug, getRelatedPosts } from '@/lib/blog';
import AuthorBio from '@/components/blog/AuthorBio';
import ReadingProgress from '@/components/blog/ReadingProgress';
import TableOfContents from '@/components/blog/TableOfContents';
import BlogCard from '@/components/blog/BlogCard';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thewinner.ae';
const CANONICAL_URL = process.env.NEXT_PUBLIC_CANONICAL_URL || SITE_URL;
const SITE_NAME = 'The Winners';

// ── Static params ──────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.description,
    authors: [{ name: post.author.name }],
    alternates: { canonical: `${CANONICAL_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${CANONICAL_URL}/blog/${post.slug}`,
      siteName: SITE_NAME,
      locale: 'en_AE',
      type: 'article',
      publishedTime: post.publish_date,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
    },
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 3);

  // Format date
  const pubDate = new Date(post.publish_date);
  const formattedDate = pubDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Tier badge info
  const tierLabels: Record<number, string> = {
    1: 'Shopping Guide',
    2: 'Category Deep Dive',
    3: 'Lifestyle',
    4: 'Entertainment',
  };
  const tierColors: Record<number, string> = {
    1: 'bg-green-100 text-green-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-purple-100 text-purple-700',
    4: 'bg-amber-100 text-amber-700',
  };

  return (
    <>
      <ReadingProgress />

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
            <Link href="/blog" className="hover:text-blue-600 transition-colors">
              Blog
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-800 font-medium truncate max-w-[200px]">
              {post.title}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10">
          {/* Main content */}
          <article className="min-w-0">
            {/* Post header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${tierColors[post.tier] || 'bg-gray-100 text-gray-700'}`}
                >
                  {tierLabels[post.tier] || 'Article'}
                </span>
                <span className="text-sm text-gray-400">
                  {post.read_time} min read
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 leading-tight">
                {post.title}
              </h1>

              <p className="text-lg text-gray-500 mb-6">{post.description}</p>

              {/* Author + date row */}
              <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {post.author.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{post.author.name}</div>
                  <div className="text-sm text-gray-400">
                    {formattedDate} · Last reviewed April 2026
                  </div>
                </div>
              </div>
            </header>

            {/* Quick answer box */}
            {post.quick_answer && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-blue-800 text-sm">Quick Answer</span>
                </div>
                <p className="text-blue-900 text-sm leading-relaxed">{post.quick_answer}</p>
              </div>
            )}

            {/* Article body */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:text-gray-800 prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-100
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-gray-600 prose-p:leading-relaxed
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-800
                prose-ul:text-gray-600 prose-ol:text-gray-600
                prose-li:leading-relaxed
                prose-blockquote:border-blue-300 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                prose-img:rounded-xl prose-img:shadow-md"
              dangerouslySetInnerHTML={{ __html: post.htmlContent }}
            />

            {/* Tags */}
            <div className="mt-10 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Author bio */}
            <AuthorBio author={post.author} />

            {/* Related posts */}
            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  You Might Also Like
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {related.map((rp) => (
                    <BlogCard key={rp.slug} post={rp} compact />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar — TOC (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents html={post.htmlContent} />
            </div>
          </aside>
        </div>
      </div>

      {/* JSON-LD: Article + FAQ + Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Article',
                '@id': `${SITE_URL}/blog/${post.slug}#article`,
                headline: post.title,
                description: post.description,
                url: `${SITE_URL}/blog/${post.slug}`,
                datePublished: post.publish_date,
                dateModified: '2026-04-01',
                author: {
                  '@type': 'Person',
                  name: post.author.name,
                  jobTitle: post.author.role,
                },
                publisher: {
                  '@type': 'Organization',
                  name: SITE_NAME,
                  url: SITE_URL,
                },
                mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
                wordCount: post.content?.split(/\s+/).length || post.target_words,
                inLanguage: 'en-AE',
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: SITE_URL,
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Blog',
                    item: `${SITE_URL}/blog`,
                  },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: post.title,
                    item: `${SITE_URL}/blog/${post.slug}`,
                  },
                ],
              },
            ],
          }),
        }}
      />
    </>
  );
}
