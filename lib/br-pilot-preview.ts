// ============================================
// BR pilot PREVIEW adapter — LOCAL DEV ONLY (BR 1, 2026-09-26)
// ============================================
// WHY: the owner reviews the first 55 BR /pt pages in a browser BEFORE any BR data
// is written to Supabase (the shared products-text rule is deliberately deferred —
// study AMZ_AFF/Docs_MD/BR_PT_FOUNDATION_STUDY_v0_2.md §0.3). This adapter lets a
// LOCAL `next dev` read those pages from the pilot JSON built by
// AMZ_AFF/claude_code_files/br_pilot_preview_build_v1.py.
//
// SAFETY: active ONLY when the server env var BR_PT_PILOT_FILE points to a file.
// It is never set on Vercel, so in production every call returns null and the page
// uses the normal Supabase reads. Read-only; no network; no DB.
// Remove this file (and its 2 call sites in the /best page) once BR data lives in
// Supabase.
// ============================================

import { promises as fs } from 'fs';
import type { Product, KeywordProduct } from '@/lib/supabase';

export interface BrPilotPage {
  noun: string;
  qa_guide: { q: string; a: string }[];
  products: (Product & KeywordProduct)[];
}

let cache: Record<string, BrPilotPage> | null = null;

async function load(): Promise<Record<string, BrPilotPage> | null> {
  const file = process.env.BR_PT_PILOT_FILE;
  if (!file) return null;
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(file, 'utf-8')) as Record<string, BrPilotPage>;
    return cache;
  } catch (e) {
    console.error('[br-pilot-preview] cannot read BR_PT_PILOT_FILE:', e);
    return null;
  }
}

/** The pilot page for a keyword, or null (flag/file absent, or keyword not in pilot). */
export async function getBrPilotPage(keywordId: number): Promise<BrPilotPage | null> {
  const all = await load();
  return all?.[String(keywordId)] ?? null;
}
