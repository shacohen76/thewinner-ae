import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  getKeywordBySlug,
  getProductsForKeyword,
} from '@/lib/supabase';
import {
  generatePageDescription,
  generateEnglishHeadline,
  generateSubHeadline,
  getCurrentYear,
  toTitleCase,
  CONFIG,
} from '@/lib/utils';
import { getGeoConfig, getProgramConfig } from '@/lib/geo-config';
import type { GeoProgram } from '@/lib/geo-config';
import ReviewProductList from '@/components/review/ReviewProductList';
import ReviewProductGallery from '@/components/review/ReviewProductGallery';
import ReviewBackToTopLink from '@/components/review/ReviewBackToTopLink';
import ReviewCrossLinkBanner from '@/components/review/ReviewCrossLinkBanner';
import CountryBand from '@/components/review/CountryBand';
import {
  REVIEW_PROGRAMS,
  REVIEW_TOPICS,
  TOPIC_LABEL,
  PROGRAM_COUNTRY_CODE,
  isReviewProgram,
  isReviewTopic,
  otherTopic,
} from '@/components/review/program-display';

// ============================================
// Review Page — /review/[program]/[topic]
// ============================================
// Created: 2026-05-26
// Purpose: Amazon Associates program-verification pages. Server-renders
// the program's affiliate tag + marketplace domain directly into the HTML
// so Amazon reviewers (or their bots) can confirm the tag without running
// JavaScript. Each program (except 'ae', which is already approved) gets
// 2 pages — one per REVIEW_TOPICS entry — for 30 statically generated
// pages total.
//
// Hard guarantees this page upholds:
//   1. Every "Show Offer" <a href> contains the program's tag in raw HTML
//      (NO buildAffiliateUrl(), NO client-side rewriting)
//   2. TrackingProvider is no-op on /review/* (see TrackingProvider.tsx)
//   3. Header/Footer are geo-specific (see LayoutShell.tsx)
//   4. <meta name="robots" content="noindex,follow"> — keeps Google out
//   5. Adds program-country areaServed JSON-LD so the country signal is
//      strong even for reviewers who inspect structured data
//
// Submit URL to Amazon: https://thewinners.ae/review/{program}/jbl-speakers
// (jbl-speakers is the primary; banner links to the laptops counterpart).
// ============================================

// Refuse any [program]/[topic] combo not in our static list.
// generateStaticParams + dynamicParams=false → unknown segments 404 at
// the routing layer before this page function runs.
export const dynamicParams = false;

// Static at build time. Re-runs only on redeploy — fine, content is
// stable; product data updates flow through the live /best/* pages.
export const revalidate = 86400;

interface PageProps {
  params: { program: string; topic: string };
}

export function generateStaticParams() {
  const out: { program: string; topic: string }[] = [];
  for (const program of REVIEW_PROGRAMS) {
    for (const topic of REVIEW_TOPICS) {
      out.push({ program, topic });
    }
  }
  return out;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isReviewProgram(params.program) || !isReviewTopic(params.topic)) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }
  const names = getGeoConfig(PROGRAM_COUNTRY_CODE[params.program]);
  const topicLabel = TOPIC_LABEL[params.topic];
  return {
    title: `10 Best ${topicLabel} Of ${getCurrentYear()} — ${names.backToTopGeo} — ${CONFIG.siteName}`,
    description: generatePageDescription(topicLabel),
    // 2026-05-27: flipped to index:true. Goal: let Google index the 30 review
    // pages so they capture geo-modified queries ("best laptops in Canada")
    // and so each indexed URL is one more public proof to Amazon that the
    // program-specific tag is in the source. Each review page has enough
    // unique geo content (CountryBand, country name in header/footer/headline/
    // cross-link/back-to-top/disclosure/copyright + areaServed JSON-LD + per-
    // country marketplace domain in every Amazon link) to differentiate from
    // the other 14 program variants without needing hreflang. If Search
    // Console flags duplicate-content collapse in the next ~4 weeks, add
    // hreflang as a reactive fix (~25 lines in generateMetadata). See
    // AMAZON_PROGRAM_REVIEW_PAGES_SPEC_v2_1.md for rationale.
    robots: { index: true, follow: true },
    // No canonical, no openGraph, no alternates — these aren't SEO pages.
  };
}

export default async function ReviewPage({ params }: PageProps) {
  if (!isReviewProgram(params.program) || !isReviewTopic(params.topic)) {
    notFound();
  }

  const program = params.program as Exclude<GeoProgram, 'ae'>;
  const topic = params.topic;

  // Resolve the program's tag + marketplace domain from geo-config.
  // ALWAYS read from PROGRAMS map — never construct tag strings manually.
  const cfg = getProgramConfig(program);
  const names = getGeoConfig(PROGRAM_COUNTRY_CODE[program]);

  // Fetch the same keyword + products as /best/[topic] uses.
  const keyword = await getKeywordBySlug(topic);
  if (!keyword) {
    // A REVIEW_TOPICS slug is missing from Supabase — log and 404 rather
    // than ship a broken page to an Amazon reviewer.
    console.error(`[review] keyword not found in DB: ${topic}`);
    notFound();
  }

  const products = await getProductsForKeyword(keyword.id);
  const currentYear = getCurrentYear();
  const topicLabel = TOPIC_LABEL[topic];

  // Pre-compute the affiliate URL once per product. www. prefix matches
  // the live buildAffiliateUrl() convention; tag + domain come straight
  // from PROGRAMS[program] — single source of truth.
  const productsForList = products.map(p => ({
    asin: p.asin,
    title: p.title,
    description: p.description,
    image_url: p.image_url,
    wwl_points: p.wwl_points,
    rank: p.rank,
    affiliateUrl: `https://www.${cfg.amazonDomain}/dp/${p.asin}?tag=${cfg.defaultTag}`,
  }));

  const galleryProducts = productsForList.map(p => ({
    asin: p.asin,
    title: p.title,
    image_url: p.image_url,
    rank: p.rank,
    affiliateUrl: p.affiliateUrl,
  }));

  // Buying guide (same shape as /best/[slug])
  let buyingGuide: { q: string; a: string }[] = [];
  if (keyword.qa_guide) {
    if (Array.isArray(keyword.qa_guide)) {
      buyingGuide = keyword.qa_guide;
    } else if (typeof keyword.qa_guide === 'string') {
      try {
        const parsed = JSON.parse(keyword.qa_guide);
        if (Array.isArray(parsed)) buyingGuide = parsed;
      } catch (e) {
        console.error('Failed to parse qa_guide:', e);
      }
    }
  }

  const mainHeadline = generateEnglishHeadline(topicLabel, currentYear);
  const sibling = otherTopic(topic);

  return (
    <>
      {/* Geo indicator strip — first thing below the header */}
      <CountryBand program={program} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: `${names.backToTopGeo} Reviews`, href: `/review/${program}/${topic}` },
        { label: topicLabel },
      ]} />

      {/* Cross-link banner — top */}
      <div className="max-w-5xl mx-auto px-4">
        <ReviewCrossLinkBanner
          program={program}
          otherTopic={sibling}
          countryDisplay={names.backToTopGeo}
        />
      </div>

      {/* Hero */}
      <section id="top" className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {mainHeadline}
          </h1>
          <p className="text-blue-100 text-lg max-w-3xl mx-auto leading-relaxed">
            {generateSubHeadline(topicLabel)} — for {names.countryName}
          </p>
        </div>
      </section>

      {/* Products */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <ReviewProductList products={productsForList} />
      </main>

      {/* Quick Pick gallery */}
      <section className="bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 text-center">
            Quick Pick
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {mainHeadline} — {names.backToTopGeo}
          </p>
        </div>
      </section>
      <ReviewProductGallery products={galleryProducts} />

      {/* Buying Guide */}
      {buyingGuide.length > 0 && (
        <section className="bg-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
              Buying Guide: {toTitleCase(topicLabel)}
            </h2>

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
                  <p className="text-gray-600 leading-relaxed pl-9">{item.a}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <ReviewBackToTopLink
                topicLabel={topicLabel}
                countryDisplay={names.backToTopGeo}
              />
            </div>
          </div>
        </section>
      )}

      {/* Cross-link banner — bottom */}
      <div className="max-w-5xl mx-auto px-4">
        <ReviewCrossLinkBanner
          program={program}
          otherTopic={sibling}
          countryDisplay={names.backToTopGeo}
        />
      </div>

      {/* FAQ Schema (same as /best/[slug]) */}
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

      {/* Program-country JSON-LD — explicitly tells crawlers / reviewers
          which country this page serves, overriding the root layout's
          GCC-only areaServed signal. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            'name': mainHeadline,
            'inLanguage': 'en',
            'audience': {
              '@type': 'Audience',
              'geographicArea': {
                '@type': 'Country',
                'name': names.backToTopGeo,
              },
            },
            'about': {
              '@type': 'Thing',
              'name': topicLabel,
            },
            'isPartOf': {
              '@type': 'WebSite',
              'name': CONFIG.siteName,
              'url': CONFIG.siteUrl,
            },
            'mainEntityOfPage': {
              '@type': 'CollectionPage',
              'areaServed': {
                '@type': 'Country',
                'name': names.backToTopGeo,
              },
            },
          }),
        }}
      />
    </>
  );
}
