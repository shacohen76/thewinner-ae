// ============================================
// Sitemap — thewinner.ae
// Created: 2026-03-19
// Updated: 2026-05-05 (NW3: fixed Supabase 1000 row limit)
// 2026-08-25 (rerank-11 SEO): SPLIT into a sitemap index via generateSitemaps().
//   WHY: it had grown to ~48,900 URLs in ONE flat 8.5MB file — right against Google's
//   50,000-URL / 50MB per-file cap; one more batch of keywords would have silently
//   broken it. Now Next serves an index at /sitemap.xml pointing to /sitemap/<id>.xml:
//     • id 0        = structural: static + category + localized (ar/ja) + blog
//     • id 1..N     = English /best keyword pages, chunked at CHUNK_SIZE each
//   Split is BY TYPE (structural vs English /best), which also isolates the ar/ja
//   locale URLs into their own group — a step toward a future full per-language split.
//   robots.txt still points at /sitemap.xml (the index), so no other change is needed.
// ============================================

import { MetadataRoute } from 'next';
import { getAllKeywords, getTranslatedSlugs, MAIN_CATEGORIES, SUBCATEGORY_NAMES } from '@/lib/supabase';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';

// URLs per English-/best sub-sitemap. Well under Google's 50k/file cap, with headroom
// so a chunk never approaches the limit even as keywords grow.
const CHUNK_SIZE = 20000;
const INDEXABLE_LOCALES = ['ar', 'ja'];

// How many sub-sitemaps: id 0 (structural) + ceil(keywords / CHUNK_SIZE) English chunks.
export async function generateSitemaps(): Promise<{ id: number }[]> {
  let englishChunks = 1;
  try {
    const keywords = await getAllKeywords();
    englishChunks = Math.max(1, Math.ceil(keywords.length / CHUNK_SIZE));
  } catch (error) {
    console.error('generateSitemaps: keyword count failed, defaulting to 1 chunk:', error);
  }
  // ids: 0 = structural, 1..englishChunks = English /best chunks
  return Array.from({ length: englishChunks + 1 }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CONFIG.siteUrl;
  const now = new Date();

  // ── id 0: STRUCTURAL (static + categories + localized /best + blog) ──────────
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
      { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
      { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
      { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ];

    const mainCategoryPages: MetadataRoute.Sitemap = Object.keys(MAIN_CATEGORIES).map((slug) => ({
      url: `${baseUrl}/category/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8,
    }));
    const subcategoryPages: MetadataRoute.Sitemap = Object.keys(SUBCATEGORY_NAMES).map((slug) => ({
      url: `${baseUrl}/category/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7,
    }));

    // Localized /best pages (ar/ja): DB-driven — include the /<locale>/best URL for every
    // slug that has a translation (noun + BYG) in that locale. Same source the page robots
    // + hreflang read, so they agree. (Unchanged logic; just relocated into the index.)
    let localizedKeywordPages: MetadataRoute.Sitemap = [];
    try {
      const keywords = await getAllKeywords();
      for (const locale of INDEXABLE_LOCALES) {
        const slugs = await getTranslatedSlugs(locale);
        const seen = new Set<string>();
        const pages = keywords
          .filter((keyword) => slugs.has(keyword.slug.toLowerCase()))
          .filter((keyword) => {
            const s = keyword.slug.toLowerCase();
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
          })
          .map((keyword) => ({
            url: `${baseUrl}/${locale}/best/${encodeURIComponent(keyword.slug)}`,
            lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9,
          }));
        localizedKeywordPages = [...localizedKeywordPages, ...pages];
      }
    } catch (error) {
      console.error('Error building localized sitemap entries:', error);
    }

    const blogSlugs = getAllSlugs();
    const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
      url: `${baseUrl}/blog/${slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7,
    }));

    return [...staticPages, ...mainCategoryPages, ...subcategoryPages, ...localizedKeywordPages, ...blogPages];
  }

  // ── id >= 1: ENGLISH /best keyword pages, chunk (id - 1) ─────────────────────
  try {
    const keywords = await getAllKeywords();
    const start = (id - 1) * CHUNK_SIZE;
    return keywords.slice(start, start + CHUNK_SIZE).map((keyword) => ({
      url: `${baseUrl}/best/${encodeURIComponent(keyword.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
  } catch (error) {
    console.error(`Error building English /best sitemap chunk ${id}:`, error);
    return [];
  }
}
