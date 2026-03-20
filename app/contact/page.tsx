import { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

// ============================================
// Contact Page — thewinner.ae
// Created: 2026-03-20
// ============================================

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with us — we would love to hear from you.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Contact' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
              ✉️
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Contact Us</h1>
            <p className="text-xl text-gray-500">We&apos;d love to hear from you!</p>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="bg-blue-50 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-3">📧 Email</h2>
              <p className="text-gray-600">
                For questions, suggestions or partnerships, send us an email:
              </p>
              <a
                href="mailto:thewinners@atomicmail.io"
                className="text-blue-600 font-medium hover:underline text-lg mt-2 block"
              >
                thewinners@atomicmail.io
              </a>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-800 mb-2">💡 Suggestions</h3>
                <p className="text-gray-600 text-sm">
                  Have an idea for a new category or a product we should add? We&apos;d love to hear it!
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-800 mb-2">🤝 Partnerships</h3>
                <p className="text-gray-600 text-sm">
                  Interested in a business partnership? Get in touch and we&apos;ll be happy to discuss.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-800 mb-2">🐛 Report an Issue</h3>
                <p className="text-gray-600 text-sm">
                  Found an error on the site or inaccurate information? Let us know and we&apos;ll fix it right away.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
