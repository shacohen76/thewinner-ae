// /sitemap/<id>.xml — one sitemap chunk (route handler). id ∈ { structural, best-0, best-1, … }.
// See lib/sitemap-data.ts. 2026-08-25 (rerank-11 SEO split).
import { CONFIG } from '@/lib/utils';
import { structuralEntries, allowlistEntries, urlsetXml } from '@/lib/sitemap-data';

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.xml$/, '');
  const lastmod = new Date().toISOString();

  let entries;
  if (id === 'structural') {
    entries = await structuralEntries();
  } else if (id === 'indexable-en' || id === 'indexable-ar' || id === 'indexable-ja') {
    // keep-best-~1K (2026-09-10): the three per-locale "indexable" sitemaps
    // listed by the index — only allowlisted pages (seo_index_allowlist).
    entries = await allowlistEntries(id.slice('indexable-'.length) as 'en' | 'ar' | 'ja');
  } else if (id === 'ja' || id === 'ar') {
    // Back-compat: the standalone /sitemap/ar.xml, /ja.xml submitted to GSC now
    // serve the same allowlisted set (identical to indexable-ar / indexable-ja).
    entries = await allowlistEntries(id);
  } else {
    return new Response('Not found', { status: 404 });
  }

  // CONFIG referenced so the handler shares the same base-url source as the index.
  void CONFIG;
  return new Response(urlsetXml(entries, lastmod), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
