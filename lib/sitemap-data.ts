// ============================================
// Sitemap data + XML builders (shared by the index + chunk route handlers)
// ============================================
// 2026-08-25 (rerank-11 SEO): the flat app/sitemap.ts hit ~48.9K URLs (Google's 50k/file
// cap). We split via explicit route handlers instead of Next's generateSitemaps() because
// generateSitemaps did NOT serve a working /sitemap.xml index in this Next 14.2 + next-intl
// setup (the bare index 404'd; children only at /sitemap.xml/<id>). Route handlers render
// identical XML in dev and prod, so /sitemap.xml (index) + /sitemap/<id>.xml (chunks) are
// predictable and verifiable. Middleware excludes the `sitemap` prefix so next-intl never
// rewrites these. Structure:
//   /sitemap.xml            -> <sitemapindex> listing the chunks below
//   /sitemap/structural.xml -> static + category + localized (ar/ja) + blog
//   /sitemap/best-<i>.xml   -> English /best keyword pages, CHUNK_SIZE each
// ============================================

import { getAllKeywords, getTranslatedSlugs, MAIN_CATEGORIES, SUBCATEGORY_NAMES } from '@/lib/supabase';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';

export const CHUNK_SIZE = 20000; // English /best URLs per chunk — well under the 50k cap
const INDEXABLE_LOCALES = ['ar', 'ja'];

export interface SitemapEntry {
  url: string;
  changefreq: string;
  priority: number;
}

// Number of English /best chunks (>=1). Errors default to 1 so the index still renders.
export async function bestChunkCount(): Promise<number> {
  try {
    const keywords = await getAllKeywords();
    return Math.max(1, Math.ceil(keywords.length / CHUNK_SIZE));
  } catch (error) {
    console.error('sitemap bestChunkCount failed, defaulting to 1:', error);
    return 1;
  }
}

// All chunk ids in order: structural first, then best-0..best-(N-1).
export async function chunkIds(): Promise<string[]> {
  const n = await bestChunkCount();
  return ['structural', ...Array.from({ length: n }, (_, i) => `best-${i}`)];
}

export async function structuralEntries(): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  const out: SitemapEntry[] = [
    { url: base, changefreq: 'daily', priority: 1 },
    { url: `${base}/about`, changefreq: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, changefreq: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, changefreq: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changefreq: 'yearly', priority: 0.3 },
    { url: `${base}/blog`, changefreq: 'weekly', priority: 0.8 },
  ];
  for (const slug of Object.keys(MAIN_CATEGORIES)) out.push({ url: `${base}/category/${slug}`, changefreq: 'weekly', priority: 0.8 });
  for (const slug of Object.keys(SUBCATEGORY_NAMES)) out.push({ url: `${base}/category/${slug}`, changefreq: 'weekly', priority: 0.7 });

  // localized /best (ar/ja) — DB-driven (keyword has a translation with noun + BYG)
  try {
    const keywords = await getAllKeywords();
    for (const locale of INDEXABLE_LOCALES) {
      const slugs = await getTranslatedSlugs(locale);
      const seen = new Set<string>();
      for (const k of keywords) {
        const s = k.slug.toLowerCase();
        if (!slugs.has(s) || seen.has(s)) continue;
        seen.add(s);
        out.push({ url: `${base}/${locale}/best/${encodeURIComponent(k.slug)}`, changefreq: 'weekly', priority: 0.9 });
      }
    }
  } catch (error) {
    console.error('sitemap structuralEntries localized failed:', error);
  }

  for (const slug of getAllSlugs()) out.push({ url: `${base}/blog/${slug}`, changefreq: 'monthly', priority: 0.7 });
  return out;
}

export async function bestChunkEntries(index: number): Promise<SitemapEntry[]> {
  const base = CONFIG.siteUrl;
  try {
    const keywords = await getAllKeywords();
    const start = index * CHUNK_SIZE;
    return keywords.slice(start, start + CHUNK_SIZE).map((k) => ({
      url: `${base}/best/${encodeURIComponent(k.slug)}`,
      changefreq: 'weekly',
      priority: 0.9,
    }));
  } catch (error) {
    console.error(`sitemap bestChunkEntries(${index}) failed:`, error);
    return [];
  }
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function urlsetXml(entries: SitemapEntry[], lastmod: string): string {
  const body = entries
    .map((e) => `  <url><loc>${xmlEscape(e.url)}</loc><lastmod>${lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export function sitemapIndexXml(locs: string[], lastmod: string): string {
  const body = locs.map((l) => `  <sitemap><loc>${xmlEscape(l)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}
