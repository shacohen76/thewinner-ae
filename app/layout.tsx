import type { Metadata } from 'next';
import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import TrackingProvider from '@/components/TrackingProvider';
import { CONFIG } from '@/lib/utils';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AE" dir="ltr">
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
        {/* Google Consent Mode v2 — default-denied state set BEFORE GTM loads.
            For non-Gulf visitors, this stays denied until they click Accept All
            in the cookie banner. Gulf visitors get an immediate auto-update to
            granted in CookieConsent.tsx on mount (banner doesn't show for them).
            Required by EU ePrivacy/GDPR + mandatory for Google Ads since Mar 2024. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                analytics_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 500
              });
            `,
          }}
        />
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
        <Suspense fallback={null}>
          <TrackingProvider>
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <CookieConsent />
          </TrackingProvider>
        </Suspense>
      </body>
    </html>
  );
}
