import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductList from '@/components/ProductList';
import ProductGallery from '@/components/ProductGallery';
import BackToTopLink from '@/components/BackToTopLink';
import { unstable_cache } from 'next/cache';
import {
  getKeywordBySlug,
  getProductsForKeyword,
  getKeywordTranslation,
  hasBuyingGuide,
  getKeywordMarketplaceCount,
  getTopKeywordSlugs,
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
import {
  generateArabicHeadline,
  generateArabicSubHeadline,
  generateArabicPageTitle,
  generateArabicPageDescription,
} from '@/lib/title-ar';
import {
  generateJapaneseHeadline,
  generateJapaneseSubHeadline,
  generateJapanesePageTitle,
  generateJapanesePageDescription,
} from '@/lib/title-ja';
import { buildAlternates } from '@/lib/seo-alternates';
import RelatedPages from '@/components/RelatedPages';
import BestAuthorByline from '@/components/BestAuthorByline';
import { getTranslations } from 'next-intl/server';

// ============================================
// Keyword Page — /best/[slug] (internal route /[locale]/best/[market]/[slug])
// ============================================
// Created: 2026-03-19
// Main product comparison page. Shows top 10 products
// for a keyword with WWL points, buying guide, FAQ schema.
// Adapted from KSP: English LTR, ASIN-based, Amazon links.
//
// 2026-08-26 (feat/per-geo-static-best): the [market] segment was injected between
// best/ and [slug]. The PUBLIC URL stays /best/<slug>; middleware rewrites it to
// /<locale>/best/<market>/<slug> so Next caches one STATIC ISR variant per
// (locale × market × slug). The visitor's catalog now renders server-side in the
// first byte — the client-side GeoCatalog swap (and its flicker) is retired.
// ============================================

// Cache for 7 days (was 24h). With generateStaticParams (top slugs pre-built at
// build time) + dynamicParams (long tail on-demand), crawler/bot hits become CDN
// cache hits instead of cold DB renders — the load pattern that exhausted Disk IO.
export const revalidate = 86400; // 24h (was 604800/7d — a bad state self-heals overnight; KSP parity). 2026-09-05

// Slugs not pre-rendered below still render on first request, then cache.
export const dynamicParams = true;

// Pre-render the hottest English keyword pages at build. BOUNDED + English-only
// (see getTopKeywordSlugs) so build cost stays tiny and constant regardless of
// catalog size; Arabic (/ar) stays on-demand (noindex). Degrades to on-demand on
// any data hiccup — never fails the build.
// 2026-08-26 (feat/per-geo-static-best): with the [market] segment we prebuild ONLY
// the AE variant (market:'ae') of the top English slugs — the indexable catalog
// (bots pin to 'ae'). Every OTHER (market, locale) builds on-demand via
// dynamicParams, so build cost stays 250 pages, not 250×8.
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (params.locale !== 'en') return [];
  const slugs = await getTopKeywordSlugs(250);
  return slugs.map((slug) => ({ market: 'ae', slug }));
}

interface PageProps {
  params: { slug: string; locale: string; market: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const keyword = await getKeywordBySlug(decodeURIComponent(params.slug));

  if (!keyword) {
    return { title: 'Not Found' };
  }

  // INTL1 (DB-driven auto-index, no allowlist). Translation fills in stages:
  // noun first (qa_guide empty), then BYG, then WWL. A page is READY TO INDEX
  // only once its editorial text is localized = noun AND BYG present (WWL can
  // lag, English bullets fall back). We compute this for EVERY non-English locale
  // (ar, ja) because the reciprocal hreflang cluster is emitted identically on
  // every version of the page; on a localized page the same flag also drives its
  // own robots index/noindex. So a page indexes automatically once noun+BYG are
  // published, no deploy.
  // INTL1 JP Phase 2 (2026-07-06): added the parallel `ja` lookup + generic dispatch.
  const [arTr, jaTr] = await Promise.all([
    getKeywordTranslation(keyword.id, 'ar'),
    getKeywordTranslation(keyword.id, 'ja'),
  ]);
  const nounAr = arTr?.keyword_text?.trim() || null;
  const nounJa = jaTr?.keyword_text?.trim() || null;
  const arIndexed = !!nounAr && hasBuyingGuide(arTr?.qa_guide);
  // INTL1 JP (2026-07-09): a /ja page indexes only if it ALSO has a JP catalog.
  // Without JP products a JP visitor gets dead amazon.co.jp links (the AE catalog
  // falls back), so keep those pages out of the index. AE-catalog locales (ar→ae)
  // need no such gate — the AE catalog is always present. Only query when a ja
  // translation exists (the only indexing candidates).
  const jaCatalogCount = nounJa ? await getKeywordMarketplaceCount(keyword.id, 'jp') : 0;
  const jaIndexed = !!nounJa && hasBuyingGuide(jaTr?.qa_guide) && jaCatalogCount >= 1;
  const indexedLocales = [
    ...(arIndexed ? ['ar'] : []),
    ...(jaIndexed ? ['ja'] : []),
  ];
  const alternates = buildAlternates(`/best/${params.slug}`, params.locale, indexedLocales);
  const localePrefix = params.locale === 'en' ? '' : `/${params.locale}`;
  const ogUrl = `${CONFIG.canonicalUrl}${localePrefix}/best/${params.slug}`;

  // Localized page (any non-English locale) with NO noun yet → English fallback
  // content, NOINDEX (keep an untranslated localized page out of search).
  const englishFallbackNoindex = (): Metadata => ({
    // 2026-08-26: title.absolute bypasses the layout's "%s | The Winners" template.
    // generatePageTitle already appends the brand, so a plain string would double it
    // ("… | The Winners | The Winners"). Mirrors the ar/ja returns.
    title: { absolute: generatePageTitle(keyword.keyword_text) },
    description: generatePageDescription(keyword.keyword_text),
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: generatePageTitle(keyword.keyword_text),
      description: generatePageDescription(keyword.keyword_text),
      url: ogUrl,
    },
  });

  if (params.locale === 'ar') {
    // The Arabic <title>/desc show as soon as the noun exists; but the page is
    // INDEXED only when arIndexed (noun + BYG). title.absolute bypasses the
    // layout's "%s | The Winners" template.
    if (nounAr) {
      const arTitle = generateArabicPageTitle(nounAr, getCurrentYear());
      const arDesc = generateArabicPageDescription(nounAr);
      return {
        title: { absolute: arTitle },
        description: arDesc,
        alternates,
        robots: { index: arIndexed, follow: true },
        openGraph: { title: arTitle, description: arDesc, url: ogUrl },
      };
    }
    return englishFallbackNoindex();
  }

  if (params.locale === 'ja') {
    // Japanese <title>/desc show once the noun exists; INDEXED only when
    // jaIndexed (noun + BYG). Same gate as Arabic — no per-page deploy.
    if (nounJa) {
      const jaTitle = generateJapanesePageTitle(nounJa, getCurrentYear());
      const jaDesc = generateJapanesePageDescription(nounJa);
      return {
        title: { absolute: jaTitle },
        description: jaDesc,
        alternates,
        robots: { index: jaIndexed, follow: true },
        openGraph: { title: jaTitle, description: jaDesc, url: ogUrl },
      };
    }
    return englishFallbackNoindex();
  }

  // English — unchanged (no robots key → layout default index applies).
  return {
    // 2026-08-26: title.absolute bypasses the layout's "%s | The Winners" template —
    // generatePageTitle already appends the brand, so a plain string doubled it
    // ("… | The Winners | The Winners"). OG title below keeps the plain value (OG
    // does not use the template). Same treatment as the ar/ja returns.
    title: { absolute: generatePageTitle(keyword.keyword_text) },
    description: generatePageDescription(keyword.keyword_text),
    alternates,
    openGraph: {
      title: generatePageTitle(keyword.keyword_text),
      description: generatePageDescription(keyword.keyword_text),
      url: ogUrl,
    },
  };
}

export default async function ProductComparisonPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug).toLowerCase();
  const keyword = await getKeywordBySlug(slug);

  if (!keyword) {
    notFound();
  }

  // 2026-08-26 (feat/per-geo-static-best): the product SET is now server-rendered
  // per market (was a client swap). Wrap ONLY the products read in a TAGGED
  // unstable_cache — key includes market+locale so each variant caches separately,
  // and the shared tag `catalog:<slug>` lets /api/revalidate purge EVERY variant of
  // a slug in one call (mirrors app/api/catalog/route.ts). getProductsForKeyword
  // still retry-then-THROWS on a real DB error; a throw is NOT cached (propagates),
  // so the empty-guard below still only fires on a genuine 0-membership render.
  // searchFallback: a non-AE market with no native products falls back to the AE
  // catalog rendered with Amazon SEARCH links (never a dead cross-marketplace /dp).
  const { products, searchFallback } = await unstable_cache(
    async () => {
      let products = await getProductsForKeyword(keyword.id, params.locale, params.market);
      let searchFallback = false;
      if (params.market !== 'ae' && products.length === 0) {
        products = await getProductsForKeyword(keyword.id, params.locale, 'ae');
        searchFallback = true;
      }
      return { products, searchFallback };
    },
    ['catalog', slug, params.market, params.locale],
    { tags: [`catalog:${slug}`], revalidate: 604800 },
  )();

  // English keyword for the searchFallback query (slugs are always English).
  const keywordEn = slug.replace(/-/g, ' ').trim();

  // 2026-08-24 GUARD (post organic-collapse incident, 2026-08-21): never bake an EMPTY
  // English /best page into the 7-day ISR cache. getProductsForKeyword already
  // retry-then-throws on a real DB error, so an empty array here means a genuine
  // 0-membership render. A thin/empty 200 that ISR caches for 7 days is exactly what
  // tanked organic on 2026-08-21 — a mid-migrate empty got baked and Googlebot dropped
  // the mass-changed pages, collapsing impressions ~40K/day -> ~0. 404 the empty page
  // instead: honest for a truly-empty page, and it can never be served as a thin
  // indexable page. Localized (ar/ja) untranslated pages already noindex in
  // generateMetadata, so scope this to the indexable English base. Pairs with
  // amz_revalidate_v1.py GUARD 1 (never revalidate a slug below --min-products).
  if (params.locale === 'en' && products.length === 0) {
    notFound();
  }

  const currentYear = getCurrentYear();

  // INTL1 Phase 2C slice 4: prefer the translated buying guide for this locale,
  // falling back to the English qa_guide when no localized row exists yet.
  const translation = await getKeywordTranslation(keyword.id, params.locale);
  const qaGuideSource = translation?.qa_guide ?? keyword.qa_guide;

  // Get BYG (Buying Guide) from qa_guide
  // Handle both JSON array and string formats
  let buyingGuide: { q: string; a: string }[] = [];
  if (qaGuideSource) {
    if (Array.isArray(qaGuideSource)) {
      buyingGuide = qaGuideSource;
    } else if (typeof qaGuideSource === 'string') {
      try {
        const parsed = JSON.parse(qaGuideSource);
        if (Array.isArray(parsed)) {
          buyingGuide = parsed;
        }
      } catch (e) {
        console.error('Failed to parse qa_guide:', e);
      }
    }
  }

  // Prepare products data for ProductList. 2026-09-05: cap to the top 10 by rank
  // HERE (catalog can hold up to 15 memberships) so the visible list AND the
  // ItemList schema below both use the same 10 — no "10 Best" page showing 11/12.
  const productsForList = [...products]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map(p => ({
      asin: p.asin,
      title: p.title,
      description: p.description,
      image_url: p.image_url,
      wwl_points: p.wwl_points,
      bullet_points: p.bullet_points,   // 2026-08-28: feature specs → "…for Nerds"
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

  // INTL1 slice 5 / JP Phase 2 (2026-07-06): localized hero from the stored noun
  // phrase via the native-confirmed templates, dispatched by locale. English path
  // is unchanged when there's no localized translation (noun stays null → English
  // generators). `translation` above was fetched for params.locale.
  const noun = (params.locale !== 'en' && translation?.keyword_text)
    ? translation.keyword_text
    : null;
  const headingName = noun ?? toTitleCase(keyword.keyword_text);
  let mainHeadline: string;
  let subHeadline: string;
  if (noun && params.locale === 'ja') {
    mainHeadline = generateJapaneseHeadline(noun, currentYear);
    subHeadline = generateJapaneseSubHeadline(noun);
  } else if (noun && params.locale === 'ar') {
    mainHeadline = generateArabicHeadline(noun, currentYear);
    subHeadline = generateArabicSubHeadline(noun);
  } else {
    mainHeadline = generateEnglishHeadline(keyword.keyword_text, currentYear);
    subHeadline = generateSubHeadline(keyword.keyword_text);
  }
  const tBest = await getTranslations({ locale: params.locale, namespace: 'BestPage' });

  // 2026-09-05 E-E-A-T: author byline + freshness. Date is formatted per-locale;
  // the page regenerates within its ISR window so month-granularity is honest.
  const updatedDate = new Date().toLocaleDateString(
    params.locale === 'en' ? 'en-US' : params.locale,
    { month: 'long', year: 'numeric' },
  );
  const bylineBy = tBest('by');
  const bylineRole = tBest('reviewerRole');
  const bylineUpdated = tBest('updated', { date: updatedDate });
  const consNote = tBest('consNote');

  // 2026-09-05: canonical (market-less) URL for this page, used in BreadcrumbList.
  const pageUrl = `${CONFIG.canonicalUrl}${params.locale === 'en' ? '' : '/' + params.locale}/best/${params.slug}`;

  return (
    // 2026-08-26 (feat/per-geo-static-best): the product SET is now chosen server-side
    // by params.market (middleware-injected per geo), so there is no client swap and
    // no provider wrapper — the correct catalog is in the SSR HTML. searchFallback +
    // keywordEn are passed to the consumers (was React context from GeoCatalog).
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: headingName }]} />

      {/* Hero Section */}
      <section id="top" className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {mainHeadline}
          </h1>
          <p className="text-blue-100 text-lg max-w-3xl mx-auto leading-relaxed">
            {subHeadline}
          </p>
        </div>
      </section>

      {/* Author byline + freshness (E-E-A-T, 2026-09-05) */}
      <BestAuthorByline slug={slug} byLabel={bylineBy} role={bylineRole} updatedText={bylineUpdated} />

      {/* Products Section */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <ProductList products={productsForList} searchFallback={searchFallback} keywordEn={keywordEn} />
      </main>

      {/* Product Gallery Section */}
      <section className="bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 text-center">
            {tBest('quickPick')}
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {mainHeadline}
          </p>
        </div>
      </section>
      <ProductGallery products={galleryProducts} searchFallback={searchFallback} keywordEn={keywordEn} />

      {/* Buying Guide Section with TOC */}
      {buyingGuide.length > 0 && (
        <section className="bg-white border-t">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
              {tBest('buyingGuide', { keyword: headingName })}
            </h2>

            {/* Table of Contents */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 max-w-3xl mx-auto">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📋</span> {tBest('tableOfContents')}
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
              <BackToTopLink keyword={headingName} />
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

      {/* ItemList schema — marks up the ranked products (2026-09-05) */}
      {productsForList.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: mainHeadline,
              numberOfItems: productsForList.length,
              itemListElement: productsForList.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'Product',
                  name: p.title,
                  ...(p.image_url ? { image: p.image_url } : {}),
                  // Pros = our genuine "Why We Love It" points; cons = the one honest,
                  // always-true caveat (availability varies by market). (2026-09-05)
                  ...(p.wwl_points && p.wwl_points.length > 0
                    ? {
                        positiveNotes: {
                          '@type': 'ItemList',
                          itemListElement: p.wwl_points.map((note, n) => ({
                            '@type': 'ListItem', position: n + 1, name: note,
                          })),
                        },
                        negativeNotes: {
                          '@type': 'ItemList',
                          itemListElement: [{ '@type': 'ListItem', position: 1, name: consNote }],
                        },
                      }
                    : {}),
                },
              })),
            }),
          }}
        />
      )}

      {/* BreadcrumbList schema — matches the visual breadcrumbs (2026-09-05) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: CONFIG.canonicalUrl },
              { '@type': 'ListItem', position: 2, name: headingName, item: pageUrl },
            ],
          }),
        }}
      />

      {/* How we choose (E-E-A-T methodology) + related internal links (2026-09-05) */}
      <section className="bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-lg font-bold text-gray-800 mb-2">{tBest('howWeChoseTitle')}</h2>
          <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">{tBest('howWeChoseBody')}</p>
        </div>
      </section>
      <RelatedPages currentSlug={slug} />
    </>
  );
}
