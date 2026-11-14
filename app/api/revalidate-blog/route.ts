// ============================================
// On-demand ISR revalidation for the HYBRID blog — /api/revalidate-blog
// ============================================
// Created: 2026-11-14 (AMZ blog no-PR flow — 1:1 port of the KSP hybrid).
// WHY: new blog posts live in Supabase `blog_posts` and render via ISR. The post PAGE is
// live on first hit (dynamicParams), but the /blog INDEX + sitemap lag up to `revalidate`
// (1h). This endpoint forces an immediate refresh of the index, the post, and the sitemap
// so a just-published post is fully visible within seconds.
//
// AUTH: Bearer <REVALIDATE_SECRET> (falls back to CRON_SECRET) — the SAME secret the existing
// /api/revalidate route uses, so NO new Vercel env var is needed.
//
// USAGE:
//   curl -X POST https://thewinner.ae/api/revalidate-blog \
//     -H "Authorization: Bearer $REVALIDATE_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"slug":"how-to-shop-online-safely"}'
//   (slug optional — omit to refresh just the index + sitemap.)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.REVALIDATE_SECRET || process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body → index + sitemap only
  }

  const slug =
    typeof body.slug === 'string' && body.slug.trim() && !body.slug.includes('/')
      ? body.slug.trim()
      : undefined;

  const revalidated: string[] = [];
  const bump = (p: string) => {
    revalidatePath(p);
    revalidated.push(p);
  };

  // Blog index (prefix-less English + the internal /en rewrite target — the extra is a
  // harmless no-op if it holds no cache entry, matching /api/revalidate's approach).
  bump('/blog');
  bump('/en/blog');

  if (slug) {
    bump(`/blog/${slug}`);
    bump(`/en/blog/${slug}`);
  }

  // Sitemap: the structural chunk carries the blog URLs; refresh it + the index.
  bump('/sitemap.xml');
  bump('/sitemap/structural.xml');

  return NextResponse.json({
    ok: true,
    slug: slug ?? null,
    revalidated,
    timestamp: new Date().toISOString(),
  });
}
