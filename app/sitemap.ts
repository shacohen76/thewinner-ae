// ============================================
// Sitemap — thewinner.ae
// Created: 2026-03-19
// Updated: 2026-05-05 (NW3: sitemap index + pagination fix)
// Generates sitemap index with multiple child sitemaps
// Next.js generateSitemaps() → /sitemap.xml (index),
//   /sitemap/0.xml (static+categories+blog),
//   /sitemap/1.xml (keywords 1-5000),
//   /sitemap/2.xml (keywords 5001-10000), etc.
// ============================================

import { MetadataRoute } from 'next';
import { getAllKeywords, MAIN_CATEGORIES, SUBCATEGORY_NAMES } from '@/lib/supabase';
import { getAllSlugs } from '@/lib/blog';
import { CONFIG } from '@/lib/utils';

const KEYWORDS_PER_SITEMAP = 5000;

export async function generateSitemaps() {
  const keywords = await getAllKeywords();
  const keywordChunks = Math.ceil(keywords.length / KEYWORDS_PER_SITEMAP);

  // id 0 = static + categories + blog
  // id 1..N = keyword chunks
  const sitemaps = [{ id: 0 }];
  for (let i = 0; i < keywordChunks; i++) {
    sitemaps.push({ id: i + 1 });
  }
  return sitemaps;
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CONFIG.siteUrl;

  // Sitemap 0: static pages + categories + blog
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
      { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
      { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
      { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ];

    const mainCategoryPages: MetadataRoute.Sitemap = Object.keys(MAIN_CATEGORIES).map((slug) => ({
      url: `${baseUrl}/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const subcategoryPages: MetadataRoute.Sitemap = Object.keys(SUBCATEGORY_NAMES).map((slug) => ({
      url: `${baseUrl}/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    const blogSlugs = getAllSlugs();
    const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
      url: `${baseUrl}/blog/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    return [...staticPages, ...mainCategoryPages, ...subcategoryPages, ...blogPages];
  }

  // Sitemap 1..N: keyword pages in chunks of 5,000
  try {
    const keywords = await getAllKeywords();
    const start = (id - 1) * KEYWORDS_PER_SITEMAP;
    const chunk = keywords.slice(start, start + KEYWORDS_PER_SITEMAP);

    return chunk.map((keyword) => ({
      url: `${baseUrl}/best/${encodeURIComponent(keyword.slug)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
  } catch (error) {
    console.error('Error fetching keywords for sitemap chunk:', error);
    return [];
  }
}
