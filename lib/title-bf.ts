// ============================================
// Black Friday twin pages — ALL BF texts live HERE (one place)
// ============================================
// Created: 2026-11-10 (BF 1). Headline = option A (owner D1). Extra BF copy = owner Q4.
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
  return `Black Friday ${year}: our top 10 ${toTitleCase(keyword)}, compared side by side with honest pros and a quick buying guide. Check each pick's current Black Friday price at the store before you buy.`;
}

/** Strip above the product list (title line + body). */
export function generateBfStrip(year: number): { title: string; body: string } {
  return {
    title: `Black Friday & Cyber Monday ${year}`,
    body: 'Deals change fast during Black Friday week — check the current price of each pick at the store before you buy.',
  };
}

/** Intro line under the strip. */
export function generateBfIntro(keyword: string): string {
  return `Shopping for ${toTitleCase(keyword)} this Black Friday? We compared the most popular options and ranked our top 10, so you can shop the season with confidence.`;
}

/** Chip on every product card. */
export function generateBfCardBadge(year: number): string {
  return `BLACK FRIDAY PICK ${year}`;
}
