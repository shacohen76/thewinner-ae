import { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

// ============================================
// Privacy Policy
// Created: 2026-03-20
// Last Modified: 2026-05-23 (GEOS1 — added GDPR + CCPA coverage for non-Gulf
// visitors now that we monetize 13 Amazon Associates programs globally)
// ============================================

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for The Winners — learn how we collect, use and protect your information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Privacy Policy' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: May 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Introduction</h2>
              <p className="leading-relaxed">
                Welcome to the Privacy Policy of &quot;The Winners&quot; ({new URL(CONFIG.siteUrl).hostname}). We respect your privacy and are committed to protecting your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. Information We Collect</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Technical information:</strong> IP address, browser type, device, operating system.</li>
                <li><strong>Usage information:</strong> Pages viewed, links clicked.</li>
                <li><strong>Cookies:</strong> Small files to improve your experience.</li>
                <li><strong>Tracking parameters:</strong> gclid and fbclid for tracking traffic sources.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. Use of Information</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Improving user experience</li>
                <li>Traffic analysis</li>
                <li>Marketing effectiveness tracking</li>
                <li>Affiliate commission calculation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. Cookies</h2>
              <p className="leading-relaxed">
                The site uses essential cookies, analytics (Google Analytics), and marketing cookies. You can manage your preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. Third Parties</h2>
              <p className="leading-relaxed">
                We may share information with Google Analytics, Google Tag Manager, Vercel (our hosting provider, with edge servers globally), Supabase (our database provider), and Amazon Associates business partners across multiple regional Amazon storefronts (amazon.ae, amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.ca, amazon.com.au, amazon.sg, amazon.com.br, amazon.pl, amazon.se, amazon.ie, amazon.com.be). We do not sell your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. Security</h2>
              <p className="leading-relaxed">
                We take reasonable security measures to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Your Rights &amp; Applicable Law</h2>
              <p className="leading-relaxed mb-4">
                The Site is operated from the United Arab Emirates and primarily serves UAE residents under the UAE Personal Data Protection Law (PDPL). However, visitors from outside the UAE may be entitled to additional rights under their local laws, which we honor where applicable.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">UAE Residents (PDPL)</h3>
              <p className="leading-relaxed">
                Under PDPL you have the right to request access, correction, or deletion of your personal data, and to withdraw consent.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">European Economic Area &amp; United Kingdom (GDPR / UK GDPR)</h3>
              <p className="leading-relaxed mb-2">If you are located in the EEA or the UK, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>access the personal data we hold about you;</li>
                <li>request rectification or erasure of your personal data;</li>
                <li>restrict or object to processing;</li>
                <li>data portability;</li>
                <li>withdraw consent at any time (where processing is based on consent);</li>
                <li>lodge a complaint with your local supervisory authority.</li>
              </ul>
              <p className="leading-relaxed mt-3">
                <strong>Legal basis for processing</strong> (GDPR Article 6): (a) your consent for analytics and marketing cookies, which you can withdraw at any time via the cookie settings, and (b) our legitimate interest in operating the Site, securing it, and improving user experience.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">California Residents (CCPA / CPRA)</h3>
              <p className="leading-relaxed mb-2">If you are a California resident, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>know what personal information we collect, sell, or share;</li>
                <li>delete personal information we hold about you;</li>
                <li>opt out of the &quot;sale&quot; or &quot;sharing&quot; of personal information (including the use of affiliate-tracking cookies for cross-context advertising);</li>
                <li>non-discrimination for exercising these rights.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Data retention</h3>
              <p className="leading-relaxed">
                Session and click-tracking data is retained for up to 24 months for analytics and affiliate attribution purposes; longer where required by legal compliance.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">International data transfers</h3>
              <p className="leading-relaxed">
                Your data may be transferred to and processed in countries other than your own, including the United States and the European Union, by our service providers (Vercel, Supabase, Google, Amazon). Where applicable, such transfers rely on appropriate safeguards such as Standard Contractual Clauses or equivalent mechanisms.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Exercising your rights</h3>
              <p className="leading-relaxed">
                Email us at{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>
                . We will respond within 30 days as required by GDPR and CCPA. Please include enough information for us to verify your identity (e.g., approximate dates of visits, country, browser/device).
              </p>

              <p className="leading-relaxed mt-4 italic">
                Where local mandatory consumer-protection or data-protection laws conflict with this Privacy Policy, the local mandatory law prevails.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. External Links</h2>
              <p className="leading-relaxed">
                Our site contains links to external sites (including the various regional Amazon storefronts we partner with — amazon.ae, amazon.com, amazon.co.uk, amazon.de, and others depending on your country). We are not responsible for the privacy practices of these sites; please consult their privacy policies directly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">9. Changes to Policy</h2>
              <p className="leading-relaxed">
                We may update this policy from time to time. Changes will be posted on this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">10. Contact</h2>
              <p className="leading-relaxed">
                For questions about our privacy policy, contact us at{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
