// ============================================
// Search API — /api/search
// Created: 2026-03-19
// Returns matching keywords for autocomplete
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { searchKeywords } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchKeywords(query, 6);

  return NextResponse.json({
    results: results.map(kw => ({
      keyword_text: kw.keyword_text,
      slug: kw.slug,
    })),
  });
}
