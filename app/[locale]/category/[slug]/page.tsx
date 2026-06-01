import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getKeywordsByCategory, MAIN_CATEGORIES, SUBCATEGORY_NAMES, isMainCategory, getMainCategoryForSubcat } from '@/lib/supabase';
import { generateCategoryTitle, toTitleCase, CONFIG } from '@/lib/utils';

// ============================================
// Category Page — /category/[slug]
// ============================================
// Created: 2026-03-20
// Handles BOTH main categories and subcategories:
// /category/computers-main  → shows subcat cards (laptops, phones, etc.)
// /category/laptops          → shows keyword cards
// Adapted from KSP: English LTR
// ============================================

export const revalidate = 86400; // Cache category pages for 24 hours

interface PageProps {
  params: { slug: string };
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

  if (isMainCategory(slug)) {
    const main = MAIN_CATEGORIES[slug];
    return {
      title: generateCategoryTitle(main.label),
      description: main.description,
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

  return {
    title: generateCategoryTitle(subcat.name),
    description: `Product comparisons in ${subcat.name} — find the best for you`,
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
        <Breadcrumbs items={[{ label: main.label }]} />

        {/* Hero */}
        <section style={getGradientStyle(main.gradient)} className="text-white py-12">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
                {main.icon}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{main.label}</h1>
                <p className="text-white/80 mt-1">{activeSubs.length} subcategories</p>
              </div>
            </div>
            <p className="text-white/90 text-lg max-w-2xl mt-4">{main.description}</p>
          </div>
        </section>

        {/* Subcategory Cards */}
        <main className="max-w-6xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Choose a Subcategory</h2>
            <p className="text-gray-500">Select a category to view product comparisons</p>
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
                      {sub.name}
                    </h3>
                    <div className="flex items-center justify-end">
                      <span className="text-blue-600 text-sm font-medium flex items-center">
                        View Category
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
            <h2 className="text-2xl font-bold text-gray-800 mb-6">More Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {otherMains.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-medium text-gray-700">{cat.label}</span>
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

  const dbKeywords = await getKeywordsByCategory(slug);
  const keywords = dbKeywords.map(kw => ({
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
        ...(parent ? [{ label: parent.label, href: `/category/${parentSlug}` }] : []),
        { label: subcat.name },
      ]} />

      {/* Hero */}
      <section style={getGradientStyle(gradient)} className="text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
              {subcat.icon}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{subcat.name}</h1>
              <p className="text-white/80 mt-1">{keywords.length} product comparisons</p>
            </div>
          </div>
          <p className="text-white/90 text-lg max-w-2xl mt-4">
            Product comparisons in {subcat.name} — find the best for you
          </p>
        </div>
      </section>

      {/* Keywords Grid */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Comparisons in This Category</h2>
          <p className="text-gray-500">Choose a comparison to see the top 10 best products</p>
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
                      10 products
                    </span>
                    <span className="text-blue-600 text-sm font-medium flex items-center">
                      View Comparison
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <h3 className="text-xl font-bold text-gray-800 mb-2">Coming Soon!</h3>
            <p className="text-gray-500">We&apos;re working on adding comparisons to this category</p>
          </div>
        )}
      </main>

      {/* Sibling Subcategories */}
      {siblingSubcats.length > 0 && (
        <section className="bg-white py-12 border-t">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {parent ? `More in ${parent.label}` : 'More Categories'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {siblingSubcats.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-medium text-gray-700">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
