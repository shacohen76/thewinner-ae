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
  metadataBase: new URL('https://thewinner.ae'),

  alternates: {
    canonical: '/',
  },

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    url: 'https://thewinner.ae',
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
    <html lang="en" dir="ltr">
      <head>
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
      <body className="bg-gray-50 min-h-screen flex flex-col">
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
