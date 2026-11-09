import type { MetadataRoute } from 'next';
import { CONFIG } from '@/lib/utils';

// Per-host robots.txt. Each Vercel project (thewinner.ae / thewinners.ae) builds
// with its own NEXT_PUBLIC_SITE_URL, so CONFIG.siteUrl already resolves to that
// host — the SAME base the sitemap route (app/sitemap.xml/route.ts) uses. This
// replaces the static public/robots.txt (2026-08-25), which hardcoded the
// thewinners.ae sitemap on BOTH hosts and became stale after the 2026-09-24
// switch to thewinner.ae as the primary, self-canonical domain. Each host now
// advertises its OWN sitemap, matching what its pages already self-canonicalize
// to. Crawl rules are unchanged: allow everything, disallow /api/.
export default function robots(): MetadataRoute.Robots {
  const base = CONFIG.siteUrl;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
