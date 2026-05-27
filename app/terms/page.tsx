import { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

// ============================================
// Terms of Use
// Created: 2026-03-20
// Last Modified: 2026-05-23 (GEOS1 — affiliate disclosure strengthened to
// FTC / UK CMA / EU UCPD standards + consumer-protection carve-out added
// for visitors outside the UAE)
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
          <p className="text-gray-500 mb-8">Last updated: May 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By accessing and using the &quot;The Winners&quot; website ({new URL(CONFIG.siteUrl).hostname}), you agree to these terms of use. If you do not agree, please refrain from using the site.
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. Affiliate Links &amp; Partnerships</h2>
              <p className="leading-relaxed mb-3">
                <strong>Affiliate disclosure</strong> (per US FTC §255, UK CMA, and EU UCPD guidance):
              </p>
              <p className="leading-relaxed mb-3">
                The Site contains affiliate links to the Amazon Associates Program, including the regional Amazon storefronts amazon.ae, amazon.sa, amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.ca, amazon.com.au, amazon.sg, amazon.com.br, amazon.pl, amazon.se, amazon.ie, amazon.com.be, and amazon.nl. The specific storefront you are routed to is determined automatically based on your country.
              </p>
              <p className="leading-relaxed mb-3">
                When you click an affiliate link and make a qualifying purchase, we may earn a commission at no additional cost to you. <strong>As Amazon Associates we earn from qualifying purchases.</strong>
              </p>
              <p className="leading-relaxed">
                Receiving commissions does not influence our editorial recommendations or product rankings. Products are selected based on data-driven criteria, not commission rates.
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
              <p className="leading-relaxed mb-3">
                These terms are governed by the laws of the United Arab Emirates. Any disputes arising from the use of this site shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.
              </p>
              <p className="leading-relaxed italic">
                Nothing in this section shall override mandatory consumer-protection rights you may have under the laws of your country of residence. Visitors in the European Union, the United Kingdom, California, and other jurisdictions with mandatory consumer-protection laws retain those rights regardless of the choice-of-law clause above.
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
