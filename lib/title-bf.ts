// ============================================
// Black Friday twin pages — ALL headline/title/meta templates live HERE (one place)
// ============================================
// Created: 2026-11-10 (BF 1). Option A of BF_PAGES_PLAN_v0_1 §d (owner decision D1 pending —
// a different option is an edit of these four strings only).
// Rules: never mention the store or any store-branded sale event; brands stay Latin (keyword_text
// as stored); no %-off / price claims — the page shows no prices, so the copy only points to the
// current price at the store.
// ============================================

import { toTitleCase, CONFIG } from '@/lib/utils';

export function generateBfHeadline(keyword: string, year: number): string {
  return `10 Best ${toTitleCase(keyword)} – Black Friday Deals ${year}`;
}

export function generateBfSubHeadline(keyword: string, year: number): string {
  return `${toTitleCase(keyword)} — Our Ranked Picks & Buying Guide for Black Friday ${year}`;
}

export function generateBfPageTitle(keyword: string, year: number): string {
  return `${generateBfHeadline(keyword, year)} | ${CONFIG.siteName}`;
}

export function generateBfPageDescription(keyword: string, year: number): string {
  return `Our top 10 ${toTitleCase(keyword)} picks for Black Friday ${year}, compared side by side. Check each pick's current Black Friday price at the store before you buy.`;
}
