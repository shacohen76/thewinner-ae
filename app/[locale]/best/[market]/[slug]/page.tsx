import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
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
import {
  generatePortugueseHeadline,
  generatePortugueseSubHeadline,
  generatePortuguesePageTitle,
  generatePortuguesePageDescription,
} from '@/lib/title-pt';
import { getBrPilotPage } from '@/lib/br-pilot-preview';
import { getProgramConfig } from '@/lib/geo-config';
import { buildAlternates } from '@/lib/seo-alternates';
import { catalogTag, catalogCopyTag } from '@/lib/cache-tags';
import { getIndexAllowlist, isAllowlisted } from '@/lib/index-allowlist';
import RelatedPages from '@/components/RelatedPages';
import BestAuthorByline from '@/components/BestAuthorByline';
import { getTranslations } from 'next-intl/server';
import { getShopeeForPage } from '@/lib/shopee';

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
// 2026-09-22 (Vercel cost fix): back to 7 days (was 24h since 2026-09-05). With up
// to 19 per-market/locale copies per slug, a 24h timer re-rendered every copy a bot
// or visitor touched EVERY DAY — the top ISR-write cost driver — and bought no
// product freshness (the products read below is unstable_cache'd for 7d anyway).
// Real changes must SIGNAL a refresh (POST /api/revalidate); the timer is only a
// backstop for a missed signal.
export const revalidate = 604800; // 7d (was 86400/24h 2026-09-05 → 7d 2026-09-22)

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

// ─── BR 1 (2026-09-26): 'pt' = Brazilian Portuguese, a SINGLE-LANGUAGE market ───
// /pt exists only when NEXT_PUBLIC_BR_PT_ENABLED=1 (lib/feature-flags) and is pinned
// to the 'br' catalog (amazon.com.br). Owner rules (study BR_PT_FOUNDATION_STUDY_v0_2 §0):
//   • never 404 and never show English on /pt:
//       - no pt noun yet        → temporary redirect to the same slug's English page
//       - noun, no BR products  → Portuguese page + amazon.com.br search button (pt noun)
//       - missing BYG / WWL     → Portuguese page, those sections simply hidden
//   • no AE never-empty fallback on /pt (it would show UAE products / English titles)
//   • pt pages are NOINDEX during the pilot (no pt allowlist yet).
// The two read helpers below prefer the LOCAL pilot preview (dev only, env
// BR_PT_PILOT_FILE — lib/br-pilot-preview.ts) and otherwise read Supabase as usual.
async function readTranslation(keywordId: number, locale: string) {
  if (locale === 'pt') {
    const pilot = await getBrPilotPage(keywordId);
    if (pilot) return { keyword_text: pilot.noun, qa_guide: pilot.qa_guide as unknown };
  }
  return getKeywordTranslation(keywordId, locale);
}

async function readProducts(keywordId: number, locale: string, market: string) {
  if (locale === 'pt') {
    const pilot = await getBrPilotPage(keywordId);
    if (pilot) return pilot.products;
  }
  return getProductsForKeyword(keywordId, locale, market);
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const keyword = await getKeywordBySlug(decodeURIComponent(params.slug));

  if (!keyword) {
    return { title: 'Not Found' };
  }

  // BR 1 (2026-09-26): /pt is its own single-language page (BR catalog, no English
  // counterpart) → self-canonical, no hreflang cluster, NOINDEX during the pilot.
  if (params.locale === 'pt') {
    const ptTr = await readTranslation(keyword.id, 'pt');
    const nounPt = ptTr?.keyword_text?.trim() || null;
    const ptUrl = `${CONFIG.canonicalUrl}/pt/best/${params.slug}`;
    const title = nounPt ? generatePortuguesePageTitle(nounPt, getCurrentYear()) : 'The Winners';
    const description = nounPt ? generatePortuguesePageDescription(nounPt) : '';
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: ptUrl },
      robots: { index: false, follow: true },
      openGraph: { title, description, url: ptUrl, locale: 'pt_BR' },
    };
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
  const arComplete = !!nounAr && hasBuyingGuide(arTr?.qa_guide);
  // INTL1 JP (2026-07-09): a /ja page indexes only if it ALSO has a JP catalog.
  // Without JP products a JP visitor gets dead amazon.co.jp links (the AE catalog
  // falls back), so keep those pages out of the index. AE-catalog locales (ar→ae)
  // need no such gate — the AE catalog is always present. Only query when a ja
  // translation exists (the only indexing candidates).
  const jaCatalogCount = nounJa ? await getKeywordMarketplaceCount(keyword.id, 'jp') : 0;
  const jaComplete = !!nounJa && hasBuyingGuide(jaTr?.qa_guide) && jaCatalogCount >= 1;

  // 2026-09-10 (SEO index allowlist — keep-best-~1K recovery): a page indexes
  // only if it is ALSO on its locale's allowlist (seo_index_allowlist), so most
  // thin/low-CTR pages get noindex,follow (they stay live; affiliate clicks
  // unaffected; reversible). Each locale is INDEPENDENT — ar/ja index on their
  // OWN list regardless of the English decision, and vice-versa. FAIL-OPEN: an
  // empty/unavailable allowlist does not restrict (isAllowlisted returns true),
  // so a DB hiccup can never deindex the whole site. The complete-gate (noun+BYG
  // for ar/ja) is still ANDed, so ar/ja never over-index untranslated pages.
  const allow = await getIndexAllowlist();
  const slugLc = decodeURIComponent(params.slug).toLowerCase();
  const enIndexed = isAllowlisted(allow, 'en', slugLc);
  const arIndexed = arComplete && isAllowlisted(allow, 'ar', slugLc);
  const jaIndexed = jaComplete && isAllowlisted(allow, 'ja', slugLc);
  const indexedLocales = [
    ...(arIndexed ? ['ar'] : []),
    ...(jaIndexed ? ['ja'] : []),
  ];
  const alternates = buildAlternates(`/best/${params.slug}`, params.locale, indexedLocales, enIndexed);
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

  // English — index gated by the allowlist (2026-09-10 keep-best-~1K). Was
  // "no robots key → layout default index"; now noindex,follow unless the slug
  // is on the English allowlist. follow keeps link equity flowing to the kept
  // winners. enIndexed is fail-open (true when the allowlist is unavailable).
  return {
    // 2026-08-26: title.absolute bypasses the layout's "%s | The Winners" template —
    // generatePageTitle already appends the brand, so a plain string doubled it
    // ("… | The Winners | The Winners"). OG title below keeps the plain value (OG
    // does not use the template). Same treatment as the ar/ja returns.
    title: { absolute: generatePageTitle(keyword.keyword_text) },
    description: generatePageDescription(keyword.keyword_text),
    alternates,
    robots: { index: enIndexed, follow: true },
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

  // BR 1 (2026-09-26): /pt without a Portuguese noun → never English on /pt, never
  // 404 (owner) → temporary redirect to the same slug's English page.
  const isPt = params.locale === 'pt';
  const translation = await readTranslation(keyword.id, params.locale);
  if (isPt && !translation?.keyword_text?.trim()) {
    redirect(`/best/${params.slug}`);
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
      let products = await readProducts(keyword.id, params.locale, params.market);
      let searchFallback = false;
      // BR 1: no AE fallback on /pt — the UAE catalog would show English titles and
      // products that don't exist on amazon.com.br. /pt renders its own empty state.
      if (params.market !== 'ae' && products.length === 0 && !isPt) {
        products = await getProductsForKeyword(keyword.id, params.locale, 'ae');
        searchFallback = true;
      }
      return { products, searchFallback };
    },
    // 2026-09-23 (scoped refresh signals): each copy's data now carries TWO tags —
    // the shared slug tag (unscoped purge, unchanged behaviour) + a per-copy tag, so
    // /api/revalidate can refresh ONE language/market without marking every copy.
    // Key bumped 'catalog' → 'catalog-v2' so all entries are re-created with both tags.
    ['catalog-v2', slug, params.market, params.locale],
    { tags: [catalogTag(slug), catalogCopyTag(slug, params.market, params.locale)], revalidate: 604800 },
  )();

  // English keyword for the searchFallback query (slugs are always English).
  // BR 1: on /pt the search query is the Portuguese noun (amazon.com.br is searched in pt).
  const keywordEn = isPt ? translation!.keyword_text!.trim() : slug.replace(/-/g, ' ').trim();

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
  // (translation for params.locale is read at the top — BR 1 needs it for the /pt redirect.)
  // BR 1: /pt never falls back to the English buying guide (section hidden instead).
  const qaGuideSource = isPt ? translation?.qa_guide : (translation?.qa_guide ?? keyword.qa_guide);

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

  // Prepare gallery data — 2026-09-05: cap to top 10 by DB rank + renumber the badge
  // sequentially (1..N) so the gallery never shows raw DB-rank holes either.
  const galleryProducts = [...products]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((p, i) => ({
      asin: p.asin,
      title: p.title,
      image_url: p.image_url,
      rank: i + 1,
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
  if (noun && isPt) {
    mainHeadline = generatePortugueseHeadline(noun, currentYear);   // BR 1
    subHeadline = generatePortugueseSubHeadline(noun);
  } else if (noun && params.locale === 'ja') {
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
    params.locale === 'en' ? 'en-US' : isPt ? 'pt-BR' : params.locale,
    { month: 'long', year: 'numeric' },
  );
  const bylineBy = tBest('by');
  const bylineRole = tBest('reviewerRole');
  const bylineUpdated = tBest('updated', { date: updatedDate });

  // 2026-09-05: canonical (market-less) URL for this page, used in BreadcrumbList.
  const pageUrl = `${CONFIG.canonicalUrl}${params.locale === 'en' ? '' : '/' + params.locale}/best/${params.slug}`;

  // 2026-09-09 (Shopee test): SEA visitors (market==='sg') get a Shopee CTA in
  // parallel to Amazon. Fails closed → {} when no active link / non-SEA, so this
  // never affects any other geo or the Amazon path.
  const shopee = await getShopeeForPage(slug, params.market);

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
        {/* Shopee CTA now renders per-card (under each Amazon button), SEA only. */}
        {isPt && productsForList.length === 0 ? (
          // BR 1: noun but no BR products yet → Portuguese empty state with an
          // amazon.com.br search (pt noun, program default tag). Never the AE fallback.
          <div className="text-center py-12">
            <p className="text-gray-700 mb-4">{`Estamos preparando nossa seleção de ${keywordEn}.`}</p>
            <a
              href={`https://www.${getProgramConfig('br').amazonDomain}/s?k=${encodeURIComponent(keywordEn)}&tag=${getProgramConfig('br').defaultTag}`}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-6 py-3 rounded-lg"
            >
              {`Ver ${keywordEn} na Amazon.com.br`}
            </a>
          </div>
        ) : (
          <ProductList products={productsForList} searchFallback={searchFallback} keywordEn={keywordEn} shopee={shopee} pageSlug={slug} pinMarket={isPt ? 'br' : undefined} />
        )}
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
      {/* BR 1: pinMarket 'br' on /pt → owner link rule (BR /dp · amazon.es search · else BR /dp + BR tag) */}
      <ProductGallery products={galleryProducts} searchFallback={searchFallback} keywordEn={keywordEn} pinMarket={isPt ? 'br' : undefined} />

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

      {/* ItemList schema — a PLAIN list of the ranked product names only.
          2026-09-06: reverted from `@type: Product` per item. Google requires a
          Product to carry offers/review/aggregateRating, but Amazon Associates
          terms bar us from showing prices/reviews, so Product markup only produced
          the "Product snippets" GSC warning (177 items) and could never render a
          rich result for us. A plain ItemList of names is valid + warning-free.
          (Prices/reviews structured data are planned for the future shopping site,
          not this one.) Visible pros ("Why We Love It") + cons line stay as page
          text — they were never dependent on this markup. */}
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
                name: p.title,
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
      {/* BR 1: RelatedPages is English-only (lib/related-pages) → hidden on /pt until localized */}
      {!isPt && <RelatedPages currentSlug={slug} />}
    </>
  );
}
