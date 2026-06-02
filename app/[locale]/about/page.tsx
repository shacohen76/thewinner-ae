import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
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

export default function AboutPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = useTranslations('About');
  const tNav = useTranslations('Nav');

  return (
    <>
      <Breadcrumbs items={[{ label: tNav('about') }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
              🏆
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              {t('title', { siteName: CONFIG.siteName })}
            </h1>
            <p className="text-xl text-gray-500">{t('subtitle')}</p>
          </div>

          {/* Mission */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('missionTitle')}</h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              {t('mission', { siteName: CONFIG.siteName })}
            </p>
          </section>

          {/* How We Work */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('howWeWorkTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="font-bold text-gray-800 mb-2">{t('work.research.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('work.research.desc')}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">⚖️</div>
                <h3 className="font-bold text-gray-800 mb-2">{t('work.objective.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('work.objective.desc')}
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="font-bold text-gray-800 mb-2">{t('work.recommendations.title')}</h3>
                <p className="text-gray-600 text-sm">
                  {t('work.recommendations.desc')}
                </p>
              </div>
            </div>
          </section>

          {/* Our Values */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('valuesTitle')}</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">{t('values.reliability.term')}</span>
                  <span className="text-gray-600">{t('values.reliability.desc')}</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">{t('values.transparency.term')}</span>
                  <span className="text-gray-600">{t('values.transparency.desc')}</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="font-bold text-gray-800">{t('values.consumerFirst.term')}</span>
                  <span className="text-gray-600">{t('values.consumerFirst.desc')}</span>
                </div>
              </li>
            </ul>
          </section>

          {/* Team Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('teamTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('teamIntro')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <img src="/team/alex.jpg" alt="Alex" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Alex</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.alex.role')}</p>
                <p className="text-xs text-gray-400">{t('team.alex.bio')}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <img src="/team/adham.jpg" alt="Adham" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Adham</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.adham.role')}</p>
                <p className="text-xs text-gray-400">{t('team.adham.bio')}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <img src="/team/mariam.jpg" alt="Mariam" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Mariam</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.mariam.role')}</p>
                <p className="text-xs text-gray-400">{t('team.mariam.bio')}</p>
              </div>
              <div className="bg-pink-50 rounded-xl p-4 text-center">
                <img src="/team/fatima.jpg" alt="Fatima" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Fatima</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.fatima.role')}</p>
                <p className="text-xs text-gray-400">{t('team.fatima.bio')}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <img src="/team/abdulla.jpg" alt="Abdulla" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Abdulla</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.abdulla.role')}</p>
                <p className="text-xs text-gray-400">{t('team.abdulla.bio')}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 text-center">
                <img src="/team/sara.jpg" alt="Sara" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                <h3 className="font-bold text-gray-800">Sara</h3>
                <p className="text-sm text-gray-500 mb-2">{t('team.sara.role')}</p>
                <p className="text-xs text-gray-400">{t('team.sara.bio')}</p>
              </div>
            </div>
          </section>

          {/* Affiliate Disclosure */}
          <section className="bg-gray-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3">{t('disclosureTitle')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('disclosure')}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
