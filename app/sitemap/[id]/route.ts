// /sitemap/<id>.xml — one sitemap chunk (route handler). id ∈ { structural, best-0, best-1, … }.
// See lib/sitemap-data.ts. 2026-08-25 (rerank-11 SEO split).
import { CONFIG } from '@/lib/utils';
import { structuralEntries, bestChunkEntries, urlsetXml } from '@/lib/sitemap-data';

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.xml$/, '');
  const lastmod = new Date().toISOString();

  let entries;
  if (id === 'structural') {
    entries = await structuralEntries();
  } else if (/^best-\d+$/.test(id)) {
    entries = await bestChunkEntries(parseInt(id.slice(5), 10));
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
