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

module.exports = nextConfig
