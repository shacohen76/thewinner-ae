// ============================================
// Homepage — thewinner.ae
// ============================================
// Created: 2026-03-19
// Placeholder — will be expanded after keyword page is verified
// ============================================

import Link from 'next/link';
import { CONFIG, getCurrentYear } from '@/lib/utils';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Find The <span className="text-yellow-300">Winning</span> Product For You
          </h1>
          <p className="text-blue-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Smart and objective product comparison. We do the research — you pick the best.
          </p>
        </div>
      </section>

      {/* Temporary content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Coming Soon</h2>
          <p className="text-gray-500 mb-8">
            Full category navigation and product comparisons are being built.
            In the meantime, explore our product comparisons directly.
          </p>
          <p className="text-sm text-gray-400">
            © {getCurrentYear()} {CONFIG.siteName} — {CONFIG.siteTagline}
          </p>
        </div>
      </section>
    </>
  );
}
