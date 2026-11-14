/**
 * Blog data utilities — HYBRID (files + Supabase), 2026-11-14.
 *
 * Original 47 posts stay as static files (content/blog/posts/*.md + posts.json) and are
 * UNTOUCHED. NEW posts live in Supabase table `public.blog_posts` and are merged in at
 * request time (ISR-cached). On a slug clash the FILE wins. Every DB read is wrapped in
 * try/catch and degrades to files-only — a Supabase failure can never 500 the blog or fail
 * the build (the sitemap's /best URLs + structural pages are unaffected; see lib/sitemap-data.ts).
 *
 * Multi-language: rows carry a `locale` (default 'en'). The reader is locale-aware with an
 * English fallback, so the data layer is ready for localized posts. SERVING stays English-only
 * today (middleware 307s /ar|/ja/blog → prefix-less English; localized blog is a future flip) —
 * the pages call the reader with the default 'en'.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { supabase } from './supabase';

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
  locale: string;
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
  source: 'file' | 'db';
}

export interface BlogPost extends BlogPostMeta {
  content: string;       // raw markdown body (after frontmatter)
  htmlContent: string;   // rendered HTML
}

const DEFAULT_LOCALE = 'en';

// ── Paths ──────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');
const POSTS_JSON = path.join(CONTENT_DIR, 'posts.json');
const AUTHORS_JSON = path.join(CONTENT_DIR, 'authors.json');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');

// ── Authors (static file — same for file + DB posts) ─────────────────────────

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

function resolveAuthor(authorId: string): BlogAuthor {
  const authors = getAuthors();
  return (
    authors[authorId] || {
      id: authorId,
      name: 'Staff Writer',
      role: 'Writer',
      bio: '',
      avatar: '/team/default.jpg',
      color: 'blue',
    }
  );
}

// ── File posts (static, cached — all locale 'en') ────────────────────────────

let _filePostsMetaCache: BlogPostMeta[] | null = null;

function getFilePostsMeta(): BlogPostMeta[] {
  if (_filePostsMetaCache) return _filePostsMetaCache;
  const raw = fs.readFileSync(POSTS_JSON, 'utf-8');
  const data = JSON.parse(raw);

  const posts: BlogPostMeta[] = data.posts.map((p: any) => {
    const wordCount = p.target_words || 2000;
    return {
      ...p,
      locale: p.locale || DEFAULT_LOCALE,
      author: resolveAuthor(p.author_id),
      read_time: Math.ceil(wordCount / 250),
      source: 'file' as const,
    };
  });

  posts.sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  _filePostsMetaCache = posts;
  return posts;
}

// ── DB posts (live read, never throws → [] on any failure) ───────────────────

const DB_COLUMNS =
  'id,slug,locale,title,tier,author_id,description,quick_answer,tags,publish_date,target_words,internal_links,product_links,content_md,hero_image_url,hero_image_credit,status';

function mapDbRow(row: any): BlogPostMeta {
  const wordCount = row.target_words || 2000;
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale || DEFAULT_LOCALE,
    title: row.title,
    tier: typeof row.tier === 'number' ? row.tier : parseInt(row.tier, 10) || 3,
    author_id: row.author_id,
    author: resolveAuthor(row.author_id),
    description: row.description || '',
    quick_answer: row.quick_answer || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    publish_date: row.publish_date,
    target_words: wordCount,
    internal_links: Array.isArray(row.internal_links) ? row.internal_links : [],
    product_links: Array.isArray(row.product_links) ? row.product_links : [],
    read_time: Math.ceil(wordCount / 250),
    source: 'db',
  };
}

/** All published DB posts for a locale. Returns [] on ANY error (files-only fallback). */
async function getDbPostsMeta(locale: string): Promise<BlogPostMeta[]> {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(DB_COLUMNS)
      .eq('status', 'published')
      .eq('locale', locale);
    if (error) {
      console.error('blog getDbPostsMeta failed (files-only fallback):', error.message);
      return [];
    }
    return (data || []).map(mapDbRow);
  } catch (err) {
    console.error('blog getDbPostsMeta threw (files-only fallback):', err);
    return [];
  }
}

/** One published DB post (full body) by slug+locale. null if not found / on error. */
async function getDbPostBySlug(slug: string, locale: string): Promise<BlogPost | null> {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`${DB_COLUMNS},content_md`)
      .eq('slug', slug)
      .eq('locale', locale)
      .eq('status', 'published')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('blog getDbPostBySlug failed:', error.message);
      return null;
    }
    if (!data) return null;
    const meta = mapDbRow(data);
    const content = (data as any).content_md || '';
    const htmlContent = await renderMarkdown(content);
    return {
      ...meta,
      read_time: Math.ceil(content.split(/\s+/).length / 250) || meta.read_time,
      content,
      htmlContent,
    };
  } catch (err) {
    console.error('blog getDbPostBySlug threw:', err);
    return null;
  }
}

// ── Merge (file wins on slug clash within a locale) ──────────────────────────

async function getMergedPostsMeta(locale: string = DEFAULT_LOCALE): Promise<BlogPostMeta[]> {
  const filePosts = getFilePostsMeta().filter((p) => p.locale === locale);
  const dbPosts = await getDbPostsMeta(locale);
  const bySlug = new Map<string, BlogPostMeta>();
  for (const p of dbPosts) bySlug.set(p.slug, p); // DB first…
  for (const p of filePosts) bySlug.set(p.slug, p); // …file overwrites → file wins
  return Array.from(bySlug.values()).sort((a, b) => b.publish_date.localeCompare(a.publish_date));
}

// ── Markdown rendering (shared by file + DB bodies) ──────────────────────────

async function renderMarkdown(content: string): Promise<string> {
  const { remark } = await import('remark');
  const remarkHtml = (await import('remark-html')).default;

  // remark-slug adds id attributes to headings (needed for TOC scroll-spy)
  let remarkSlug: any = null;
  try {
    remarkSlug = (await import('remark-slug')).default;
  } catch {
    // remark-slug not installed — TOC falls back to client-side ids
  }

  let pipeline = remark();
  if (remarkSlug) pipeline = pipeline.use(remarkSlug);
  pipeline = pipeline.use(remarkHtml, { sanitize: false });

  const result = await pipeline.process(content);
  return result.toString();
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get all post metadata (file + DB merged), newest first. */
export async function getAllPosts(locale: string = DEFAULT_LOCALE): Promise<BlogPostMeta[]> {
  return getMergedPostsMeta(locale);
}

/** All slugs (file + DB) for generateStaticParams / sitemap. Degrades to file slugs on DB error. */
export async function getAllSlugs(locale: string = DEFAULT_LOCALE): Promise<string[]> {
  return (await getMergedPostsMeta(locale)).map((p) => p.slug);
}

/**
 * Get a single post with full content by slug. FILE wins on clash; otherwise falls back to a
 * published DB row. Returns null if neither exists.
 */
export async function getPostBySlug(
  slug: string,
  locale: string = DEFAULT_LOCALE,
): Promise<BlogPost | null> {
  // 1) File post (only for the default locale — file posts are English).
  if (locale === DEFAULT_LOCALE) {
    const meta = getFilePostsMeta().find((p) => p.slug === slug);
    if (meta) {
      const mdPath = path.join(POSTS_DIR, `${slug}.md`);
      if (fs.existsSync(mdPath)) {
        const raw = fs.readFileSync(mdPath, 'utf-8');
        const { content } = matter(raw);
        const htmlContent = await renderMarkdown(content);
        const read_time = Math.ceil(content.split(/\s+/).length / 250);
        return { ...meta, read_time, content, htmlContent };
      }
      // meta exists but .md missing — fall through to DB (rare).
    }
  }

  // 2) DB post.
  return getDbPostBySlug(slug, locale);
}

/** Related posts (file + DB merged) from internal_links + same-tier fallback. */
export async function getRelatedPosts(
  slug: string,
  limit = 3,
  locale: string = DEFAULT_LOCALE,
): Promise<BlogPostMeta[]> {
  const posts = await getMergedPostsMeta(locale);
  const current = posts.find((p) => p.slug === slug);
  if (!current) return [];

  const related: BlogPostMeta[] = [];
  for (const linkSlug of current.internal_links) {
    const found = posts.find((p) => p.slug === linkSlug);
    if (found && found.slug !== slug) related.push(found);
    if (related.length >= limit) break;
  }

  if (related.length < limit) {
    const sameTier = posts.filter(
      (p) => p.tier === current.tier && p.slug !== slug && !related.find((r) => r.slug === p.slug),
    );
    for (const p of sameTier) {
      related.push(p);
      if (related.length >= limit) break;
    }
  }

  return related.slice(0, limit);
}

// ── File-only helpers (not currently request-critical; kept for API stability) ─

/** All unique tags across file posts. */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  for (const p of getFilePostsMeta()) for (const t of p.tags) tagSet.add(t);
  return Array.from(tagSet).sort();
}

export function getPostsByTag(tag: string): BlogPostMeta[] {
  return getFilePostsMeta().filter((p) => p.tags.includes(tag));
}

export function getPostsByTier(tier: number): BlogPostMeta[] {
  return getFilePostsMeta().filter((p) => p.tier === tier);
}

export function getAuthor(id: string): BlogAuthor | null {
  const authors = getAuthors();
  return authors[id] || null;
}

export function getPostsByAuthor(authorId: string): BlogPostMeta[] {
  return getFilePostsMeta().filter((p) => p.author_id === authorId);
}
