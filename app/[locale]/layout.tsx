// ============================================
// Per-locale root layout — INTL1 Phase 1 (Increment B)
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — [locale] tree restructure)
//
// This is now the layout that actually renders <html>/<body>. It used to be
// app/layout.tsx; it moved DOWN one level into app/[locale]/ so that the html
// `lang`/`dir` attributes (and, in Phase 2, the message dictionary) are chosen
// per locale. The file at app/layout.tsx is now a thin passthrough that just
// returns children — Next still requires a root layout to exist, but the real
// document shell lives here where it has the active `locale` in scope.
//
// WHY THE SPLIT (and why it is safe for English rankings):
//   • With routing.localePrefix = 'as-needed' and the default locale `en`, the
//     middleware REWRITES "/" → "/en" internally (no redirect). So every
//     existing English URL keeps its exact path AND is now served by this
//     layout with locale='en' → lang="en-AE" dir="ltr": byte-identical to the
//     previous app/layout.tsx. Verified via SSR diff before commit.
//   • NextIntlClientProvider renders NO DOM of its own (it only provides React
//     context for useTranslations in client components). Phase 1 ships empty
//     message files, so it is inert today but ready for Phase 2 without another
//     layout edit.
//
// STATIC RENDERING: setRequestLocale(locale) opts every page under [locale]
// back into full static generation (SSG/ISR). Without it, calling locale-aware
// next-intl APIs would force these routes to dynamic rendering and we'd lose
// the 24h ISR cache that /best/[slug] depends on. generateStaticParams emits
// the known locales so the segment is statically known at build time.
//
// INVALID LOCALE: anything that is not a configured locale → notFound(), which
// renders the GLOBAL app/not-found.tsx (it carries its own <html>/<body>
// because it is outside this [locale] tree).
// ============================================

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import TrackingProvider from '@/components/TrackingProvider';
import LayoutShell from '@/components/LayoutShell';
import { CONFIG } from '@/lib/utils';
import { routing, type AppLocale } from '@/i18n/routing';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: `${CONFIG.siteName} — ${CONFIG.siteTagline}`,
    template: `%s | ${CONFIG.siteName}`,
  },
  description: 'The leading product comparison site for the UAE. Find the best products across electronics, appliances, computers, beauty and more.',
  keywords: ['product comparison', 'reviews', 'electronics', 'perfumes', 'baby', 'coffee', 'garden', 'sports', 'cosmetics', 'appliances', 'computers', 'gaming', 'UAE', 'Amazon'],
  authors: [{ name: CONFIG.siteName }],
  creator: CONFIG.siteName,
  metadataBase: new URL(CONFIG.canonicalUrl),

  alternates: {
    canonical: '/',
    languages: {
      'en-AE': CONFIG.canonicalUrl,
      'x-default': CONFIG.canonicalUrl,
    },
  },

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    url: CONFIG.canonicalUrl,
    siteName: CONFIG.siteName,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Locale → <html> attributes. Phase 1 only ships `en`; `ar` is pre-mapped so
// Phase 2 (RTL Arabic) is a one-line array change in i18n/routing.ts with no
// edit here.
const LOCALE_HTML: Record<string, { lang: string; dir: 'ltr' | 'rtl' }> = {
  en: { lang: 'en-AE', dir: 'ltr' },
  ar: { lang: 'ar-AE', dir: 'rtl' },
};

// Statically pre-render the document shell for every configured locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  // Guard against an unknown locale prefix → global 404.
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  // Enable static rendering for this request's locale.
  setRequestLocale(locale);

  // Loaded from messages/<locale>.json via i18n/request.ts. Empty in Phase 1.
  const messages = await getMessages();

  const html = LOCALE_HTML[locale] ?? LOCALE_HTML.en;

  return (
    <html lang={html.lang} dir={html.dir}>
      <head>
        {/* Structured Data — WebSite + Organization with geo signals */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': `${CONFIG.siteUrl}/#website`,
                  'url': CONFIG.siteUrl,
                  'name': CONFIG.siteName,
                  'description': 'The leading product comparison site for the UAE',
                  'inLanguage': 'en-AE',
                  'potentialAction': {
                    '@type': 'SearchAction',
                    'target': `${CONFIG.siteUrl}/best/{search_term_string}`,
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': `${CONFIG.siteUrl}/#organization`,
                  'name': CONFIG.siteName,
                  'url': CONFIG.siteUrl,
                  'areaServed': [
                    { '@type': 'Country', 'name': 'United Arab Emirates' },
                    { '@type': 'Country', 'name': 'Saudi Arabia' },
                    { '@type': 'Country', 'name': 'Bahrain' },
                    { '@type': 'Country', 'name': 'Kuwait' },
                    { '@type': 'Country', 'name': 'Oman' },
                    { '@type': 'Country', 'name': 'Qatar' },
                  ],
                  'contactPoint': {
                    '@type': 'ContactPoint',
                    'email': 'thewinners@atomicmail.io',
                    'contactType': 'customer service',
                    'availableLanguage': 'English',
                  },
                },
              ],
            }),
          }}
        />
        {/* HOTFIX 2026-05-23: Consent Mode v2 default-denied block removed —
            it was starving GA4 (denied default + GA4 tag not Consent-Mode-v2
            configured in GTM → no events ever fired). Returns to pre-Path B
            GTM behavior (implicit grant for everyone). Re-introduce only
            after GTM tag is properly configured for Consent Mode v2 AND
            CookieConsent.tsx update path is verified end-to-end.
            See AM1 decisions log entry GEOS1-HOTFIX-1. */}
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${CONFIG.gtmId}');
            `,
          }}
        />
      </head>
      <body className="bg-gray-50 min-h-screen flex flex-col overflow-x-hidden">
        {/* GTM noscript */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${CONFIG.gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense fallback={null}>
            <TrackingProvider>
              {/* LayoutShell picks Header+Footer+CookieConsent vs ReviewHeader+ReviewFooter
                  based on pathname. Non-review paths render byte-identical to before. */}
              <LayoutShell>{children}</LayoutShell>
            </TrackingProvider>
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
