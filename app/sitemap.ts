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

  try {
    const keywords = await getAllKeywords();
    keywordPages = keywords.map((keyword) => ({
      url: `${baseUrl}/best/${encodeURIComponent(keyword.slug)}`,
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

  return [...staticPages, ...mainCategoryPages, ...subcategoryPages, ...keywordPages, ...blogPages];
}
