// ============================================
// Sitemap — thewinner.ae
// Created: 2026-03-19
// Updated: 2026-05-05 (NW3: fixed Supabase 1000 row limit)
// Generates sitemap.xml with all keyword pages
// ============================================

import { MetadataRoute } from 'next';
import { getAllKeywords, MAIN_CATEGORIES, SUBCATEGORY_NAMES } from '@/lib/supabase';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';
import { isArBestSlugIndexed } from '@/lib/intl1-ar-indexed';

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

  // INTL1 Phase 3.2: Arabic /best pages. Discovery-only entries (hreflang lives
  // in the page <link> tags, shipped in 3.1 — single source of truth). Uses the
  // SAME per-domain host (baseUrl) as the English entries above, keeping each
  // domain's sitemap internally self-sufficient (one GSC property per domain;
  // cross-domain canonicalization to thewinners.ae is handled by the page
  // canonical tags, exactly as the English entries already rely on).
  // GATED on the indexing allowlist: only allowlisted slugs appear, so with the
  // empty allowlist this stays EMPTY and the sitemap is byte-identical (no-op).
  // Populated in PR 3.3 alongside the noindex flip.
  let arKeywordPages: MetadataRoute.Sitemap = [];

  try {
    const keywords = await getAllKeywords();
    keywordPages = keywords.map((keyword) => ({
      url: `${baseUrl}/best/${encodeURIComponent(keyword.slug)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
    // Dedupe by slug: the keywords table can hold >1 row for the same slug
    // (e.g. casing variants), which would otherwise emit a duplicate /ar URL.
    const seenArSlugs = new Set<string>();
    arKeywordPages = keywords
      .filter((keyword) => isArBestSlugIndexed(keyword.slug))
      .filter((keyword) => {
        const s = keyword.slug.toLowerCase();
        if (seenArSlugs.has(s)) return false;
        seenArSlugs.add(s);
        return true;
      })
      .map((keyword) => ({
        url: `${baseUrl}/ar/best/${encodeURIComponent(keyword.slug)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      }));
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

  return [...staticPages, ...mainCategoryPages, ...subcategoryPages, ...keywordPages, ...arKeywordPages, ...blogPages];
}
