/**
 * Blog data utilities
 * Reads posts.json + authors.json at build time, parses markdown frontmatter.
 * No Supabase dependency — blog content is static files.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BlogAuthor {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatar: string;
  color: string;
}

export interface BlogPostMeta {
  id: number;
  slug: string;
  title: string;
  tier: number;
  author_id: string;
  author: BlogAuthor;
  description: string;
  quick_answer: string;
  tags: string[];
  publish_date: string;
  target_words: number;
  internal_links: string[];
  product_links: string[];
  read_time: number;
}

export interface BlogPost extends BlogPostMeta {
  content: string;       // raw markdown body (after frontmatter)
  htmlContent: string;   // rendered HTML
}

// ── Paths ──────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');
const POSTS_JSON = path.join(CONTENT_DIR, 'posts.json');
const AUTHORS_JSON = path.join(CONTENT_DIR, 'authors.json');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');

// ── Loaders ────────────────────────────────────────────────────────────────

let _authorsCache: Record<string, BlogAuthor> | null = null;

function getAuthors(): Record<string, BlogAuthor> {
  if (_authorsCache) return _authorsCache;
  const raw = fs.readFileSync(AUTHORS_JSON, 'utf-8');
  const data = JSON.parse(raw);
  const map: Record<string, BlogAuthor> = {};
  for (const a of data.authors) {
    map[a.id] = a;
  }
  _authorsCache = map;
  return map;
}

let _postsMetaCache: BlogPostMeta[] | null = null;

function getPostsMeta(): BlogPostMeta[] {
  if (_postsMetaCache) return _postsMetaCache;
  const raw = fs.readFileSync(POSTS_JSON, 'utf-8');
  const data = JSON.parse(raw);
  const authors = getAuthors();

  const posts: BlogPostMeta[] = data.posts.map((p: any) => {
    const author = authors[p.author_id] || {
      id: p.author_id,
      name: 'Staff Writer',
      role: 'Writer',
      bio: '',
      avatar: '/team/default.jpg',
      color: 'blue',
    };
    const wordCount = p.target_words || 2000;
    return {
      ...p,
      author,
      read_time: Math.ceil(wordCount / 250),
    };
  });

  // Sort by publish_date descending (newest first)
  posts.sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  _postsMetaCache = posts;
  return posts;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get all post metadata (for index page, sitemaps, etc.)
 */
export function getAllPosts(): BlogPostMeta[] {
  return getPostsMeta();
}

/**
 * Get all unique tags across all posts
 */
export function getAllTags(): string[] {
  const posts = getPostsMeta();
  const tagSet = new Set<string>();
  for (const p of posts) {
    for (const t of p.tags) tagSet.add(t);
  }
  return Array.from(tagSet).sort();
}

/**
 * Get posts filtered by tag
 */
export function getPostsByTag(tag: string): BlogPostMeta[] {
  return getPostsMeta().filter((p) => p.tags.includes(tag));
}

/**
 * Get posts by tier
 */
export function getPostsByTier(tier: number): BlogPostMeta[] {
  return getPostsMeta().filter((p) => p.tier === tier);
}

/**
 * Get a single post with full content by slug.
 * Returns null if slug not found or markdown file missing.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const meta = getPostsMeta().find((p) => p.slug === slug);
  if (!meta) return null;

  const mdPath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) return null;

  const raw = fs.readFileSync(mdPath, 'utf-8');
  const { content } = matter(raw);

  // Render markdown to HTML
  const { remark } = await import('remark');
  const remarkHtml = (await import('remark-html')).default;

  // remark-slug adds id attributes to headings (needed for TOC scroll-spy)
  let remarkSlug: any = null;
  try {
    remarkSlug = (await import('remark-slug')).default;
  } catch {
    // remark-slug not installed — TOC will use client-side fallback
  }

  let pipeline = remark();
  if (remarkSlug) pipeline = pipeline.use(remarkSlug);
  pipeline = pipeline.use(remarkSlug).use(remarkHtml, { sanitize: false });

  const result = await pipeline.process(content);
  const htmlContent = result.toString();

  // Recalculate read time from actual content
  const wordCount = content.split(/\s+/).length;
  const read_time = Math.ceil(wordCount / 250);

  return {
    ...meta,
    read_time,
    content,
    htmlContent,
  };
}

/**
 * Get all slugs (for generateStaticParams)
 */
export function getAllSlugs(): string[] {
  return getPostsMeta().map((p) => p.slug);
}

/**
 * Get related posts for a given slug (from internal_links + same-tier fallback)
 */
export function getRelatedPosts(slug: string, limit = 3): BlogPostMeta[] {
  const posts = getPostsMeta();
  const current = posts.find((p) => p.slug === slug);
  if (!current) return [];

  // First try internal_links
  const related: BlogPostMeta[] = [];
  for (const linkSlug of current.internal_links) {
    const found = posts.find((p) => p.slug === linkSlug);
    if (found && found.slug !== slug) related.push(found);
    if (related.length >= limit) break;
  }

  // Fill with same-tier posts if needed
  if (related.length < limit) {
    const sameTier = posts.filter(
      (p) => p.tier === current.tier && p.slug !== slug && !related.find((r) => r.slug === p.slug)
    );
    for (const p of sameTier) {
      related.push(p);
      if (related.length >= limit) break;
    }
  }

  return related.slice(0, limit);
}

/**
 * Get author by ID
 */
export function getAuthor(id: string): BlogAuthor | null {
  const authors = getAuthors();
  return authors[id] || null;
}

/**
 * Get all posts by a specific author
 */
export function getPostsByAuthor(authorId: string): BlogPostMeta[] {
  return getPostsMeta().filter((p) => p.author_id === authorId);
}
