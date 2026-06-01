import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductList from '@/components/ProductList';
import ProductGallery from '@/components/ProductGallery';
import BackToTopLink from '@/components/BackToTopLink';
import {
  getKeywordBySlug,
  getProductsForKeyword,
} from '@/lib/supabase';
import {
  generatePageTitle,
  generatePageDescription,
  generateEnglishHeadline,
  generateSubHeadline,
  getCurrentYear,
  toTitleCase,
  CONFIG
} from '@/lib/utils';

// ============================================
// Keyword Page — /best/[slug]
// ============================================
// Created: 2026-03-19
// Main product comparison page. Shows top 10 products
// for a keyword with WWL points, buying guide, FAQ schema.
// Adapted from KSP: English LTR, ASIN-based, Amazon links.
// ============================================

export const revalidate = 86400; // Cache keyword pages for 24 hours

interface PageProps {
  params: { slug: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const keyword = await getKeywordBySlug(decodeURIComponent(params.slug));

  if (!keyword) {
    return { title: 'Not Found' };
  }

  return {
    title: generatePageTitle(keyword.keyword_text),
    description: generatePageDescription(keyword.keyword_text),
    alternates: {
      canonical: `/best/${params.slug}`,
      languages: {
        'en-AE': `${CONFIG.canonicalUrl}/best/${params.slug}`,
        'x-default': `${CONFIG.canonicalUrl}/best/${params.slug}`,
      },
    },
    openGraph: {
      title: generatePageTitle(keyword.keyword_text),
      description: generatePageDescription(keyword.keyword_text),
      url: `${CONFIG.canonicalUrl}/best/${params.slug}`,
    },
  };
}

export default async function ProductComparisonPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug).toLowerCase();
  const keyword = await getKeywordBySlug(slug);

  if (!keyword) {
    notFound();
  }

  const products = await getProductsForKeyword(keyword.id);
  const currentYear = getCurrentYear();

  // Get BYG (Buying Guide) from qa_guide
  // Handle both JSON array and string formats
  let buyingGuide: { q: string; a: string }[] = [];
  if (keyword.qa_guide) {
    if (Array.isArray(keyword.qa_guide)) {
      buyingGuide = keyword.qa_guide;
    } else if (typeof keyword.qa_guide === 'string') {
      try {
        const parsed = JSON.parse(keyword.qa_guide);
        if (Array.isArray(parsed)) {
          buyingGuide = parsed;
        }
      } catch (e) {
        console.error('Failed to parse qa_guide:', e);
      }
    }
  }

  // Prepare products data for ProductList
  const productsForList = products.map(p => ({
    asin: p.asin,
    title: p.title,
    description: p.description,
    image_url: p.image_url,
    wwl_points: p.wwl_points,
    rank: p.rank,
    price_at_scrape: p.price_at_scrape,
    is_on_discount: p.is_on_discount || false,
    discount_percentage: p.discount_percentage || null,
    is_prime: false, // TODO: add is_prime to DB schema if needed
  }));

  // Prepare gallery data
  const galleryProducts = products.map(p => ({
    asin: p.asin,
    title: p.title,
    image_url: p.image_url,
    rank: p.rank,
  }));

  // Generate headline — Title Case
  const mainHeadline = generateEnglishHeadline(keyword.keyword_text, currentYear);

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: toTitleCase(keyword.keyword_text) }]} />

      {/* Hero Section */}
      <section id="top" className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {mainHeadline}
          </h1>
          <p className="text-blue-100 text-lg max-w-3xl mx-auto leading-relaxed">
            {generateSubHeadline(keyword.keyword_text)}
          </p>
        </div>
      </section>

      {/* Products Section */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <ProductList products={productsForList} />
      </main>

      {/* Product Gallery Section */}
      <section className="bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 text-center">
            Quick Pick
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {mainHeadline}
          </p>
        </div>
      </section>
      <ProductGallery products={galleryProducts} />

      {/* Buying Guide Section with TOC */}
      {buyingGuide.length > 0 && (
        <section className="bg-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
              Buying Guide: {toTitleCase(keyword.keyword_text)}
            </h2>

            {/* Table of Contents */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 max-w-3xl mx-auto">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📋</span> Table of Contents
              </h3>
              <nav>
                <ol className="space-y-2">
                  {buyingGuide.map((item, index) => (
                    <li key={index}>
                      <a
                        href={`#q${index + 1}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                      >
                        <span className="text-gray-400">{index + 1}.</span>
                        {item.q}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            {/* Q&A Items */}
            <div className="space-y-6 max-w-3xl mx-auto">
              {buyingGuide.map((item, index) => (
                <div
                  key={index}
                  id={`q${index + 1}`}
                  className="bg-gray-50 rounded-xl p-6 scroll-mt-24"
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    {item.q}
                  </h3>
                  <p className="text-gray-600 leading-relaxed ps-9">{item.a}</p>
                </div>
              ))}
            </div>

            {/* Back to top — geo-aware (GEOS1). Renders "United Arab Emirates"
                in the cached SSR HTML; <BackToTopLink> swaps the geo name
                client-side post-hydration via tw_geo cookie. */}
            <div className="text-center mt-8">
              <BackToTopLink keyword={toTitleCase(keyword.keyword_text)} />
            </div>
          </div>
        </section>
      )}

      {/* FAQ Schema for SEO */}
      {buyingGuide.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: buyingGuide.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.a,
                },
              })),
            }),
          }}
        />
      )}
    </>
  );
}
