// INTL1 Phase 1 (2026-05-30): wrap config with the next-intl plugin so the
// App Router picks up i18n/request.ts for per-request locale + messages.
// Adds NO behavior change on its own — routing only activates once the
// [locale] tree + middleware land (Phase 1 Increment B). All existing config
// below is unchanged.
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images-eu.ssl-images-amazon.com',
        pathname: '/**',
      },
    ],
    unoptimized: true,
  },

  // NOTE: www → non-www redirect is handled by Vercel domain settings,
  // NOT here in Next.js config. This avoids redirect chain issues
  // with Google Search Console and Google Ads page feeds.
  // In Vercel: add thewinner.ae as primary domain,
  // www.thewinner.ae will auto-redirect at edge level.
}

module.exports = withNextIntl(nextConfig)
