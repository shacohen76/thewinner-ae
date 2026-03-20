// ============================================
// Homepage — thewinner.ae
// ============================================
// Created: 2026-03-20
// Adapted from KSP: English LTR, Amazon UAE market
// ============================================

import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import { CONFIG, getCurrentYear } from '@/lib/utils';

// Categories data — 8 main groups
const categories = [
  { name: 'Home Appliances', slug: 'appliances-main', icon: '🏠', color: 'from-green-500 to-green-600' },
  { name: 'Kitchen & Coffee', slug: 'kitchen-main', icon: '☕', color: 'from-amber-700 to-amber-800' },
  { name: 'Computers & Phones', slug: 'computers-main', icon: '💻', color: 'from-blue-500 to-blue-600' },
  { name: 'TV & Audio', slug: 'entertainment-main', icon: '📺', color: 'from-purple-500 to-purple-600' },
  { name: 'Beauty, Care & Family', slug: 'care-main', icon: '✨', color: 'from-pink-500 to-pink-600' },
  { name: 'Hobbies & Leisure', slug: 'hobbies-main', icon: '🎮', color: 'from-red-500 to-red-600' },
  { name: 'Home & Garden', slug: 'home-main', icon: '🏡', color: 'from-teal-500 to-teal-600' },
  { name: 'More', slug: 'other-main', icon: '📦', color: 'from-gray-500 to-gray-600' },
];

// Popular comparisons
const popularComparisons = [
  { title: 'Top 10 Best Portable Speakers', slug: 'portable-speakers', icon: '🔊', gradient: 'from-purple-500 to-indigo-600', description: 'Comprehensive comparison of Bluetooth portable speakers for every budget' },
  { title: 'Top 10 Best Coffee Machines', slug: 'coffee-machines', icon: '☕', gradient: 'from-amber-500 to-orange-600', description: 'From capsule to professional espresso machines for your home' },
  { title: 'Top 10 Best Washing Machines', slug: 'washing-machines', icon: '🧺', gradient: 'from-blue-500 to-cyan-600', description: 'Recommended washing machines for every budget and need' },
  { title: 'Top 10 Best Televisions', slug: 'televisions', icon: '📺', gradient: 'from-rose-500 to-red-600', description: '4K, OLED, QLED — all the leading technologies compared' },
  { title: 'Top 10 Best Earbuds', slug: 'earbuds', icon: '🎧', gradient: 'from-green-500 to-teal-600', description: 'Wireless earbuds for music, calls, and active lifestyles' },
  { title: 'Top 10 Best Hair Straighteners', slug: 'hair-straightener', icon: '💇', gradient: 'from-gray-600 to-gray-800', description: 'Professional-grade hair straighteners for salon results at home' },
];

// Popular search keywords
const popularSearches = [
  { text: 'Portable Speakers', slug: 'portable-speakers' },
  { text: 'Coffee Machines', slug: 'coffee-machines' },
  { text: 'Washing Machines', slug: 'washing-machines' },
  { text: 'Earbuds', slug: 'earbuds' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section with Smart Search */}
      <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Find The <span className="text-yellow-300">Winning</span> Product For You
          </h1>
          <p className="text-blue-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Smart and objective product comparison. We do the research — you pick the best.
          </p>

          {/* Smart Search Box */}
          <SearchBox className="max-w-2xl mx-auto" />

          {/* Popular Searches */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="text-blue-200 text-sm">Popular searches:</span>
            {popularSearches.map((search) => (
              <Link
                key={search.slug}
                href={`/best/${search.slug}`}
                className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-full text-sm transition-colors"
              >
                {search.text}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Browse by Category</h2>
            <p className="text-gray-500 text-lg">Choose a category and find the best products</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="bg-white border-2 border-gray-100 rounded-2xl p-6 text-center group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-200"
              >
                <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${cat.color} rounded-2xl flex items-center justify-center`}>
                  <span className="text-3xl">{cat.icon}</span>
                </div>
                <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Comparisons */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Popular Comparisons</h2>
            <p className="text-gray-500 text-lg">The most requested comparisons by our users</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularComparisons.map((comparison) => (
              <Link
                key={comparison.slug}
                href={`/best/${comparison.slug}`}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow overflow-hidden group"
              >
                <div className={`h-40 bg-gradient-to-br ${comparison.gradient} flex items-center justify-center`}>
                  <span className="text-6xl">{comparison.icon}</span>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-xl text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {comparison.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">{comparison.description}</p>
                  <div className="flex items-center text-blue-600 font-medium text-sm">
                    View Comparison
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-10">
            <Link
              href="/category/appliances-main"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-colors shadow-lg"
            >
              View All Comparisons
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Why Choose Us?</h2>
            <p className="text-gray-500 text-lg">We do the hard work for you</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">🔍</span>
              </div>
              <h3 className="font-bold text-xl text-gray-800 mb-3">In-Depth Research</h3>
              <p className="text-gray-500">
                We review and compare hundreds of products to find the very best in every category
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">⚖️</span>
              </div>
              <h3 className="font-bold text-xl text-gray-800 mb-3">Fully Objective</h3>
              <p className="text-gray-500">
                Our rankings are based on real performance, not advertising or marketing
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="font-bold text-xl text-gray-800 mb-3">Save Time & Money</h3>
              <p className="text-gray-500">
                Instead of spending hours on research, get the answer in minutes and find the best deal
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
