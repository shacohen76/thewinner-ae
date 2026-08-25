// /sitemap.xml — sitemap INDEX (route handler). See lib/sitemap-data.ts for why we use
// explicit handlers instead of generateSitemaps(). 2026-08-25 (rerank-11 SEO split).
import { CONFIG } from '@/lib/utils';
import { chunkIds, sitemapIndexXml } from '@/lib/sitemap-data';

export const revalidate = 3600; // regenerate at most hourly

export async function GET() {
  const base = CONFIG.siteUrl;
  const lastmod = new Date().toISOString();
  const ids = await chunkIds();
  const xml = sitemapIndexXml(ids.map((id) => `${base}/sitemap/${id}.xml`), lastmod);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
