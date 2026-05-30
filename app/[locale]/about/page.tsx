import { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

// ============================================
// About Page — thewinner.ae
// Created: 2026-03-20
// Adapted from KSP: English, UAE market, renamed team
// ============================================

export const metadata: Metadata = {
  title: 'About',
  description: `Learn about us — ${CONFIG.siteName} is the leading product comparison platform for the UAE.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'About' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
              🏆
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              About {CONFIG.siteName}
            </h1>
            <p className="text-xl text-gray-500">The leading product comparison platform for the UAE</p>
          </div>

          {/* Mission */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Mission</h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              At &quot;{CONFIG.siteName}&quot; we believe every consumer deserves reliable and objective information before making a purchase.
              Our mission is to save you hours of research and give you the bottom line —
              what are the best products in every category.
            </p>
          </section>

          {/* How We Work */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">How We Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="font-bold text-gray-800 mb-2">In-Depth Research</h3>
                <p className="text-gray-600 text-sm">
                  We review hundreds of products and analyze technical specs, user reviews and sales data
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">⚖️</div>
                <h3 className="font-bold text-gray-800 mb-2">Objective Comparison</h3>
                <p className="text-gray-600 text-sm">
                  Our rankings are based on real-world performance, not payments or advertising
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="font-bold text-gray-800 mb-2">Clear Recommendations</h3>
                <p className="text-gray-600 text-sm">
                  We explain simply why each product is recommended and who it&apos;s best suited for
                </p>
              </div>
            </div>
          </section>

          {/* Our Values */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Values</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">Reliability</span>
                  <span className="text-gray-600"> — Our information is accurate and up-to-date. We don&apos;t recommend products we wouldn&apos;t buy ourselves.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">Transparency</span>
                  <span className="text-gray-600"> — We&apos;re open about how we earn. When you buy through our links, we may receive a commission.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">Consumer First</span>
                  <span className="text-gray-600"> — Every decision we make is evaluated from your perspective — the consumers.</span>
                </div>
              </li>
            </ul>
          </section>

          {/* Team Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Team</h2>
            <p className="text-gray-600 mb-6">Meet the expert reviewers behind our recommendations:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <img src="/team/alex.jpg" alt="Alex" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Alex</h3>
                <p className="text-sm text-gray-500 mb-2">Technology Expert</p>
                <p className="text-xs text-gray-400">Loves gadgets and gaming. Reviews computers, smartphones and gaming gear.</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <img src="/team/adham.jpg" alt="Adham" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Adham</h3>
                <p className="text-sm text-gray-500 mb-2">Home Appliances Expert</p>
                <p className="text-xs text-gray-400">Cooking and baking enthusiast. Reviews kitchen appliances, coffee machines and home electronics.</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <img src="/team/mariam.jpg" alt="Mariam" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Mariam</h3>
                <p className="text-sm text-gray-500 mb-2">Audio Expert</p>
                <p className="text-xs text-gray-400">Musician and sound enthusiast. Reviews speakers, headphones and audio systems.</p>
              </div>
              <div className="bg-pink-50 rounded-xl p-4 text-center">
                <img src="/team/fatima.jpg" alt="Fatima" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Fatima</h3>
                <p className="text-sm text-gray-500 mb-2">Beauty & Home Expert</p>
                <p className="text-xs text-gray-400">Interior design and beauty lover. Reviews beauty products, skincare and home accessories.</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <img src="/team/abdulla.jpg" alt="Abdulla" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Abdulla</h3>
                <p className="text-sm text-gray-500 mb-2">Sports & Fitness Expert</p>
                <p className="text-xs text-gray-400">Athlete and fitness trainer. Reviews smartwatches, fitness equipment and sports electronics.</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 text-center">
                <img src="/team/sara.jpg" alt="Sara" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Sara</h3>
                <p className="text-sm text-gray-500 mb-2">Family & Kids Expert</p>
                <p className="text-xs text-gray-400">Mother of three. Reviews baby products, toys and family essentials.</p>
              </div>
            </div>
          </section>

          {/* Affiliate Disclosure */}
          <section className="bg-gray-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Disclosure</h2>
            <p className="text-gray-600 leading-relaxed">
              We work with premium partners to ensure great results for our users.
              We may receive a commission separately and never on the behalf of our users.
              The commissions we receive do not affect our rankings or recommendations —
              those are based solely on product quality and suitability for your needs.
              As an Amazon Associates we earn from qualifying purchases.
              Loyalty and trust above all, always.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
