import { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

// ============================================
// Privacy Policy — thewinner.ae
// Created: 2026-03-20
// UAE jurisdiction, Amazon Associates references
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
          <p className="text-gray-500 mb-8">Last updated: March 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Introduction</h2>
              <p className="leading-relaxed">
                Welcome to the Privacy Policy of &quot;The Winners&quot; (thewinner.ae). We respect your privacy and are committed to protecting your personal information.
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
                We may share information with Google Analytics, Google Tag Manager, and business partners (Amazon.ae). We do not sell personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. Security</h2>
              <p className="leading-relaxed">
                We take reasonable security measures to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Your Rights</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your information</li>
                <li>Withdraw consent for cookies</li>
              </ul>
              <p className="leading-relaxed mt-4">
                In accordance with the UAE Personal Data Protection Law (PDPL), you have the right to request access, correction, or deletion of your personal data. To exercise these rights, contact us at{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. External Links</h2>
              <p className="leading-relaxed">
                Our site contains links to external sites (including Amazon.ae). We are not responsible for the privacy practices of these sites.
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
