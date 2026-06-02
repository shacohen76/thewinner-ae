import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
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

export default function ContactPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = useTranslations('Contact');
  const tNav = useTranslations('Nav');

  return (
    <>
      <Breadcrumbs items={[{ label: tNav('contact') }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
              ✉️
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">{t('title')}</h1>
            <p className="text-xl text-gray-500">{t('subtitle')}</p>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="bg-blue-50 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-3">{t('emailTitle')}</h2>
              <p className="text-gray-600">
                {t('emailIntro')}
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
                <h3 className="font-bold text-gray-800 mb-2">{t('suggestions.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('suggestions.desc')}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-800 mb-2">{t('partnerships.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('partnerships.desc')}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-800 mb-2">{t('report.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('report.desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
