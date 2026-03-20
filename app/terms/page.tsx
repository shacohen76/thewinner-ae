import { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

// ============================================
// Terms of Use — thewinner.ae
// Created: 2026-03-20
// UAE jurisdiction, Amazon Associates references
// ============================================

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of Use for The Winners — rules for using our product comparison site.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Terms of Use' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Terms of Use</h1>
          <p className="text-gray-500 mb-8">Last updated: March 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By accessing and using the &quot;The Winners&quot; website (thewinner.ae), you agree to these terms of use. If you do not agree, please refrain from using the site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. Description of Service</h2>
              <p className="leading-relaxed">
                The site provides information and comparisons between various products. The information is intended to help you make informed purchasing decisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. Limitation of Liability</h2>
              <p className="leading-relaxed">
                The information is provided &quot;as is.&quot; We do not guarantee complete accuracy. Prices and availability may change — verify on the retailer&apos;s site before purchasing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. Affiliate Links & Partnerships</h2>
              <p className="leading-relaxed">
                The site participates in the Amazon Associates Program. When you buy through a link on our site, we may receive a commission. Receiving commissions does not affect our rankings.
                As an Amazon Associates we earn from qualifying purchases.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. Intellectual Property</h2>
              <p className="leading-relaxed">
                All content on the site is the property of The Winners. No copying or distribution without written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. Prohibited Use</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Illegal activity</li>
                <li>Automated scraping (Web Scraping)</li>
                <li>Attempting to breach security</li>
                <li>Use that disrupts normal site operation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Governing Law</h2>
              <p className="leading-relaxed">
                These terms are governed by the laws of the United Arab Emirates. Any disputes arising from the use of this site shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. Changes to Terms</h2>
              <p className="leading-relaxed">
                We may update these terms from time to time. Continued use of the site constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">9. Contact</h2>
              <p className="leading-relaxed">
                For questions about our terms of use, contact us at{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
