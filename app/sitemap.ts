// ============================================
// Sitemap — thewinner.ae
// Created: 2026-03-19
// Updated: 2026-05-05 (NW3: fixed Supabase 1000 row limit)
// Generates sitemap.xml with all keyword pages
// ============================================

import { MetadataRoute } from 'next';
import { getAllKeywords, getTranslatedSlugs, MAIN_CATEGORIES, SUBCATEGORY_NAMES } from '@/lib/supabase';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CONFIG.siteUrl;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Main category pages
  const mainCategoryPages: MetadataRoute.Sitemap = Object.keys(MAIN_CATEGORIES).map((slug) => ({
    url: `${baseUrl}/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Subcategory pages
  const subcategoryPages: MetadataRoute.Sitemap = Object.keys(SUBCATEGORY_NAMES).map((slug) => ({
    url: `${baseUrl}/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Dynamic keyword pages from database
  let keywordPages: MetadataRoute.Sitemap = [];

  // INTL1: localized /best pages. DB-driven (no allowlist) — include the
  // /<locale>/best URL for every slug that has a translation (noun + BYG) in that
  // locale, so translating a page (push to DB) adds it to the sitemap
  // automatically, no deploy. Same per-domain host (baseUrl) as the English
  // entries; hreflang lives in the page <link> tags. Same source the page
  // robots + hreflang read, so they agree.
  // INTL1 JP Phase 2 (2026-07-06): generalized from ar-only to a locale list so
  // /ja is emitted the same way. Add a locale here when it launches.
  const INDEXABLE_LOCALES = ['ar', 'ja'];
  let localizedKeywordPages: MetadataRoute.Sitemap = [];

  try {
    const keywords = await getAllKeywords();
    keywordPages = keywords.map((keyword) => ({
      url: `${baseUrl}/best/${encodeURIComponent(keyword.slug)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));

    for (const locale of INDEXABLE_LOCALES) {
      const slugs = await getTranslatedSlugs(locale);
      // Dedupe by slug: the keywords table can hold >1 row for the same slug
      // (e.g. casing variants), which would otherwise emit a duplicate URL.
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
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.9,
        }));
      localizedKeywordPages = [...localizedKeywordPages, ...pages];
    }
  } catch (error) {
    console.error('Error fetching keywords for sitemap:', error);
  }

  // Blog post pages
  const blogSlugs = getAllSlugs();
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...mainCategoryPages, ...subcategoryPages, ...keywordPages, ...localizedKeywordPages, ...blogPages];
}
