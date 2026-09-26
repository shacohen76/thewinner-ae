import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getKeywordsByCategory, MAIN_CATEGORIES, SUBCATEGORY_NAMES, isMainCategory, getMainCategoryForSubcat, supabase } from '@/lib/supabase';
import { generateCategoryTitle, toTitleCase, CONFIG } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import { getBrPilotPage } from '@/lib/br-pilot-preview';

// ─── BR 1 (2026-09-26): /pt keyword cards ───
// A /pt category lists ONLY keywords that have a Portuguese page (a pt noun), labelled
// with that noun (the English keyword_text would leak English + link to pages that just
// redirect away). Nouns come from the local pilot preview (dev only) or Supabase
// keyword_translations(locale='pt'), in chunks of 25 ids (PostgREST gate).
async function getPtNouns(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const id of ids) {
    const pilot = await getBrPilotPage(id);
    if (pilot) out.set(id, pilot.noun);
  }
  const missing = ids.filter((id) => !out.has(id));
  for (let i = 0; i < missing.length; i += 25) {
    const { data } = await supabase
      .from('keyword_translations')
      .select('keyword_id, keyword_text')
      .eq('locale', 'pt')
      .in('keyword_id', missing.slice(i, i + 25));
    for (const r of data ?? []) if (r.keyword_text?.trim()) out.set(r.keyword_id, r.keyword_text.trim());
  }
  return out;
}

const capFirstPt = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1) : s);

// ============================================
// Category Page — /category/[slug]
// ============================================
// Created: 2026-03-20
// Handles BOTH main categories and subcategories:
// /category/computers-main  → shows subcat cards (laptops, phones, etc.)
// /category/laptops          → shows keyword cards
// Adapted from KSP: English LTR
// ============================================

// ML 3 (2026-07-17): 7 days → 6 hours. If a category ever caches empty, it now
// self-heals within hours instead of a week. Category pages are few (45) and rarely
// change, so the extra regenerations are negligible (~dozens/hour worst case).
// 2026-09-22 (Vercel cost fix): 6h → 7 days. Subcategory lists are now the top-50
// by clickouts (slow-moving), and the empty-cache risk above is handled at the
// source (readWithRetry THROWS at runtime → a failed render is never cached).
export const revalidate = 604800; // 7 days

// ML 3 (2026-07-17): render category pages ON-DEMAND (was: prerender all 45 at
// build). Prerendering hammered the DB concurrently at build, and the BIG
// subcategories (large-appliances / kitchen-appliances = 664 rows, sorted)
// intermittently hit the Postgres statement timeout → readWithRetry degraded them
// to empty → ONE random big category baked blank on every build (toys, then
// large-appliances — whack-a-mole). On-demand renders each on first request at
// RUNTIME, where there's no build-concurrency contention (the ~300ms query
// succeeds) and readWithRetry THROWS (not degrades) on a real error, so an empty is
// never cached. dynamicParams=true already serves every slug on demand; the long-
// tail /best pages have run this way since launch, so it's the proven pattern.
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: { slug: string; locale: string };
}

// Gradient CSS for inline styles (Tailwind can't handle dynamic class names)
const GRADIENT_STYLES: Record<string, string> = {
  'from-green-600 via-green-700 to-teal-800': 'linear-gradient(to bottom right, #16a34a, #047857, #115e59)',
  'from-amber-700 via-amber-800 to-yellow-900': 'linear-gradient(to bottom right, #b45309, #92400e, #78350f)',
  'from-blue-600 via-blue-700 to-indigo-800': 'linear-gradient(to bottom right, #2563eb, #1d4ed8, #3730a3)',
  'from-purple-600 via-purple-700 to-indigo-800': 'linear-gradient(to bottom right, #9333ea, #7e22ce, #3730a3)',
  'from-pink-500 via-pink-600 to-rose-700': 'linear-gradient(to bottom right, #ec4899, #db2777, #be123c)',
  'from-red-600 via-red-700 to-orange-800': 'linear-gradient(to bottom right, #dc2626, #b91c1c, #9a3412)',
  'from-teal-600 via-teal-700 to-emerald-800': 'linear-gradient(to bottom right, #0d9488, #0f766e, #065f46)',
  'from-gray-600 via-gray-700 to-slate-800': 'linear-gradient(to bottom right, #4b5563, #374151, #1e293b)',
};

function getGradientStyle(gradient: string): React.CSSProperties {
  return { background: GRADIENT_STYLES[gradient] || 'linear-gradient(to bottom right, #4b5563, #374151, #1e293b)' };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug;

  // 2026-09-02: localize the category <title>/description for non-English locales.
  // The visible page already localizes via next-intl (Categories/CategoryDesc/
  // Subcategories namespaces); generateMetadata previously used the English
  // MAIN_CATEGORIES/SUBCATEGORY_NAMES fields, so /ar + /ja pages shipped English
  // <title> tags. Reuse the same translations here (fallback to English for 'en').
  const isLocalized = params.locale !== 'en';
  const tCat = await getTranslations({ locale: params.locale, namespace: 'Categories' });
  const tDesc = await getTranslations({ locale: params.locale, namespace: 'CategoryDesc' });
  const tSub = await getTranslations({ locale: params.locale, namespace: 'Subcategories' });
  const tPage = await getTranslations({ locale: params.locale, namespace: 'CategoryPage' });

  // BR 1: /pt → Portuguese title suffix + self-canonical (no en-AE cluster). Others unchanged.
  if (params.locale === 'pt') {
    const tMeta = await getTranslations({ locale: 'pt', namespace: 'Meta' });
    const name = isMainCategory(slug) ? tCat(slug) : SUBCATEGORY_NAMES[slug] ? tSub(slug) : null;
    if (!name) return { title: tMeta('categorySuffix') };
    return {
      title: `${name} — ${CONFIG.siteName} | ${tMeta('categorySuffix')}`,
      description: isMainCategory(slug) ? tDesc(slug) : tPage('subcatIntro', { name }),
      alternates: { canonical: `/pt/category/${slug}` },
    };
  }

  if (isMainCategory(slug)) {
    const main = MAIN_CATEGORIES[slug];
    return {
      title: generateCategoryTitle(isLocalized ? tCat(slug) : main.label),
      description: isLocalized ? tDesc(slug) : main.description,
      alternates: {
        canonical: `/category/${slug}`,
        languages: {
          'en-AE': `${CONFIG.canonicalUrl}/category/${slug}`,
          'x-default': `${CONFIG.canonicalUrl}/category/${slug}`,
        },
      },
    };
  }

  const subcat = SUBCATEGORY_NAMES[slug];
  if (!subcat) return { title: 'Not Found' };

  const subName = isLocalized ? tSub(slug) : subcat.name;
  return {
    title: generateCategoryTitle(subName),
    description: isLocalized ? tPage('subcatIntro', { name: subName }) : `Product comparisons in ${subcat.name} — find the best for you`,
    alternates: {
      canonical: `/category/${slug}`,
      languages: {
        'en-AE': `${CONFIG.canonicalUrl}/category/${slug}`,
        'x-default': `${CONFIG.canonicalUrl}/category/${slug}`,
      },
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const slug = params.slug;

  // INTL1 slice 5b: localize category names + page chrome. Chrome strings go
  // through t() in every locale (en values in messages are byte-exact); the
  // category NAMES use the localized dictionary, with English from the existing
  // TS constants (English path unchanged).
  // INTL1 JP Phase 2 (2026-07-06): was ar-only; now any non-English locale
  // (ja, …) uses its own dictionary for category/subcategory names.
  const isLocalized = params.locale !== 'en';
  const tPage = await getTranslations({ locale: params.locale, namespace: 'CategoryPage' });
  const tCat = await getTranslations({ locale: params.locale, namespace: 'Categories' });
  const tDesc = await getTranslations({ locale: params.locale, namespace: 'CategoryDesc' });
  const tSub = await getTranslations({ locale: params.locale, namespace: 'Subcategories' });
  const catLabel = (s: string, fallback: string) => (isLocalized ? tCat(s) : fallback);
  const catDesc = (s: string, fallback: string) => (isLocalized ? tDesc(s) : fallback);
  const subLabel = (s: string, fallback: string) => (isLocalized ? tSub(s) : fallback);

  // ── MODE 1: Main category → show subcategory cards ──
  if (isMainCategory(slug)) {
    const main = MAIN_CATEGORIES[slug];
    const activeSubs = main.subcategories;

    // Other main categories for nav
    const otherMains = Object.entries(MAIN_CATEGORIES)
      .filter(([s]) => s !== slug)
      .map(([s, c]) => ({ slug: s, ...c }));

    return (
      <>
        <Breadcrumbs items={[{ label: catLabel(slug, main.label) }]} />

        {/* Hero */}
        <section style={getGradientStyle(main.gradient)} className="text-white py-12">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
                {main.icon}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{catLabel(slug, main.label)}</h1>
                <p className="text-white/80 mt-1">{tPage('subcategoriesCount', { count: activeSubs.length })}</p>
              </div>
            </div>
            <p className="text-white/90 text-lg max-w-2xl mt-4">{catDesc(slug, main.description)}</p>
          </div>
        </section>

        {/* Subcategory Cards */}
        <main className="max-w-6xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{tPage('chooseSubcategory')}</h2>
            <p className="text-gray-500">{tPage('chooseSubcategoryHint')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSubs.map((subcatSlug) => {
              const sub = SUBCATEGORY_NAMES[subcatSlug] || { name: subcatSlug, icon: '📦' };
              return (
                <Link
                  key={subcatSlug}
                  href={`/category/${subcatSlug}`}
                  className="bg-white rounded-2xl shadow-md overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group"
                >
                  <div className="h-32 flex items-center justify-center" style={getGradientStyle(main.gradient)}>
                    <span className="text-5xl">{sub.icon}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                      {subLabel(subcatSlug, sub.name)}
                    </h3>
                    <div className="flex items-center justify-end">
                      <span className="text-blue-600 text-sm font-medium flex items-center">
                        {tPage('viewCategory')}
                        <svg className="w-4 h-4 ms-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </main>

        {/* Other Main Categories */}
        <section className="bg-white py-12 border-t">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{tPage('moreCategories')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {otherMains.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-medium text-gray-700">{catLabel(cat.slug, cat.label)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── MODE 2: Subcategory → show keyword cards ──
  const subcat = SUBCATEGORY_NAMES[slug];
  if (!subcat) {
    notFound();
  }

  // ML 3 (2026-07-17): the empty-category bug is fixed at the source — the narrowed
  // SELECT in getKeywordsByCategory no longer times out, and readWithRetry throws at
  // RUNTIME on a real DB error (so a failed render isn't cached) while degrading at
  // BUILD. So no page-level throw here: a genuine 0 (rare) still renders "Coming
  // Soon" below, and transient errors are handled in the query, not by failing the
  // whole prerender.
  // 2026-09-22 (Vercel cost fix): returns at most CATEGORY_LIST_LIMIT (50) keywords —
  // top real program-country clickouts first (see getKeywordsByCategory). Was every
  // keyword A→Z (~1,000 cards, ~2.5MB HTML per ISR rebuild).
  const dbKeywords = await getKeywordsByCategory(slug);
  const isPt = params.locale === 'pt';
  const tMeta = isPt ? await getTranslations({ locale: 'pt', namespace: 'Meta' }) : null;
  const ptNouns = isPt ? await getPtNouns(dbKeywords.map((kw) => kw.id)) : null;
  const keywords = isPt
    ? dbKeywords
        .filter((kw) => ptNouns!.has(kw.id))
        .map((kw) => ({
          text: capFirstPt(ptNouns!.get(kw.id)!),
          slug: kw.slug,
          icon: subcat.icon,
          description: tMeta!('compareCard', { noun: ptNouns!.get(kw.id)! }),
        }))
    : dbKeywords.map(kw => ({
        text: toTitleCase(kw.keyword_text),
        slug: kw.slug,
        icon: subcat.icon,
        description: `Compare ${toTitleCase(kw.keyword_text)} — find the best for you`
      }));

  // Find parent main category for breadcrumb + gradient
  const parentSlug = getMainCategoryForSubcat(slug);
  const parent = parentSlug ? MAIN_CATEGORIES[parentSlug] : null;
  const gradient = parent?.gradient || 'from-gray-600 via-gray-700 to-slate-800';

  // Other subcats in same parent for nav
  const siblingSubcats = parent
    ? parent.subcategories.filter(s => s !== slug).map(s => ({ slug: s, ...SUBCATEGORY_NAMES[s] }))
    : [];

  return (
    <>
      <Breadcrumbs items={[
        ...(parent ? [{ label: catLabel(parentSlug as string, parent.label), href: `/category/${parentSlug}` }] : []),
        { label: subLabel(slug, subcat.name) },
      ]} />

      {/* Hero */}
      <section style={getGradientStyle(gradient)} className="text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
              {subcat.icon}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{subLabel(slug, subcat.name)}</h1>
              <p className="text-white/80 mt-1">{tPage('comparisonsCount', { count: keywords.length })}</p>
            </div>
          </div>
          <p className="text-white/90 text-lg max-w-2xl mt-4">
            {tPage('subcatIntro', { name: subLabel(slug, subcat.name) })}
          </p>
        </div>
      </section>

      {/* Keywords Grid */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{tPage('comparisonsHere')}</h2>
          <p className="text-gray-500">{tPage('comparisonsHereHint')}</p>
        </div>

        {keywords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keywords.map((kw) => (
              <Link
                key={kw.slug}
                href={`/best/${kw.slug}`}
                className="bg-white rounded-2xl shadow-md overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group"
              >
                <div className="h-32 flex items-center justify-center" style={getGradientStyle(gradient)}>
                  <span className="text-5xl">{kw.icon}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {kw.text}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">{kw.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                      {tPage('products10')}
                    </span>
                    <span className="text-blue-600 text-sm font-medium flex items-center">
                      {tPage('viewComparison')}
                      <svg className="w-4 h-4 ms-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🔍</div>
            {/* BR 1: pt strings on /pt; English unchanged elsewhere */}
            <h3 className="text-xl font-bold text-gray-800 mb-2">{tMeta ? tMeta('comingSoon') : 'Coming Soon!'}</h3>
            <p className="text-gray-500">{tMeta ? tMeta('comingSoonSub') : <>We&apos;re working on adding comparisons to this category</>}</p>
          </div>
        )}
      </main>

      {/* Sibling Subcategories */}
      {siblingSubcats.length > 0 && (
        <section className="bg-white py-12 border-t">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {tMeta
                ? (parent ? tMeta('moreIn', { label: catLabel(parentSlug as string, parent.label) }) : tMeta('moreCategories'))
                : (parent ? `More in ${parent.label}` : 'More Categories')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {siblingSubcats.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-medium text-gray-700">{isPt ? subLabel(cat.slug, cat.name) : cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
