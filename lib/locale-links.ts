// ============================================
// locale-links.ts — cross-LANGUAGE internal links ("in other languages" nav).
// Created 2026-09-29 (owner): every page (home + /best) links to 3 pages in EACH of
// the other supported languages, with NATIVE anchor text, so every locale (en, ja,
// ar, pt) is connected to every other one for crawlers and users.
//
// Pool = slugs that are live in ALL four locales (verified 2026-09-29: HTTP 200, no
// fallback redirect on /, /ja, /ar, /pt). Owner rule: every pool page must be INDEXED —
// the ones that were noindex were added to seo_index_allowlist the same day. Only add a
// slug after re-checking all four locales (and allowlisting any noindex one).
// Nouns = keyword_translations(<locale>).keyword_text; anchors reuse each locale's own
// headline style (ja "…のおすすめ10選", ar "أفضل 10 …", pt "Top 10 de … no Brasil").
// Static on purpose (cacheable, no DB read on the hot path).
// ============================================

export type LinkLocale = 'en' | 'ja' | 'ar' | 'pt';

interface CrossLinkSlug {
  slug: string;
  en: string;   // English display name (plural, title case)
  ja: string;
  ar: string;
  pt: string;   // singular search form (pt template never needs a plural)
}

// 2026-09-29 owner picks: gaming-laptops OUT; dolce-gabbana-parfum-men + samsung-tablet-
// for-watching-movies IN. ⚠ Both are live (200) but NOT on the SEO index allowlist in every
// locale (noindex: D&G on ja/ar, Samsung on en/ja/ar) — links still help users/crawl paths;
// add them to seo_index_allowlist if they should rank.
export const CROSS_LOCALE_POOL: CrossLinkSlug[] = [
  { slug: 'air-fryers',      en: 'Air Fryers',      ja: 'ノンフライヤー',         ar: 'قلايات هوائية',        pt: 'air fryer' },
  { slug: 'dolce-gabbana-parfum-men', en: 'Dolce & Gabbana Perfume', ja: 'ドルチェ&ガッバーナ 香水 メンズ', ar: 'عطور دولتشي آند غابانا للرجال', pt: 'perfume Dolce & Gabbana para homens' },
  { slug: 'samsung-tablet-for-watching-movies', en: 'Samsung Tablets For Watching Movies', ja: 'サムスン タブレット 映画鑑賞用', ar: 'أجهزة تابلت Samsung لمشاهدة الأفلام', pt: 'tablet Samsung para assistir filmes' },
  { slug: 'smart-watches',   en: 'Smartwatches',    ja: 'スマートウォッチ',       ar: 'ساعات ذكية',           pt: 'smartwatch' },
  { slug: 'vacuum-cleaners', en: 'Vacuum Cleaners', ja: '掃除機',                ar: 'مكانس كهربائية',       pt: 'aspirador de pó' },
  { slug: 'coffee-machines', en: 'Coffee Machines', ja: 'コーヒーメーカー',       ar: 'ماكينات القهوة',       pt: 'máquina de café' },
  { slug: 'earbuds',         en: 'Earbuds',         ja: 'イヤホン',              ar: 'سماعات الأذن',         pt: 'fones de ouvido sem fio' },
  { slug: 'tablets',         en: 'Tablets',         ja: 'タブレット',            ar: 'أجهزة تابلت',          pt: 'tablet' },
  // 2026-09-29 owner: keep (was noindex on ja/ar → owner: "just index them").
  { slug: 'robot-vacuum-and-mop', en: 'Robot Vacuums & Mops', ja: 'ロボット掃除機とモップ', ar: 'روبوتات الشفط والمسح', pt: 'aspirador de piso robô' },
];

/** Native group label, <html lang>, direction and anchor template per locale.
 *  2026-09-29 (owner): every anchor NAMES THE GEO in its own language — ja → Japan,
 *  ar → the Emirates + Saudi (the Arabic pages serve both), pt → Brazil. English pages
 *  serve many countries, so the en anchor takes a rotating geo (same list as the EN
 *  "More top picks", lib/related-pages RELATED_GEOS) passed in by the component. */
export const LOCALE_LINK_META: Record<LinkLocale, {
  label: string; dir: 'ltr' | 'rtl'; anchor: (noun: string, enGeo: string) => string; path: (slug: string) => string;
}> = {
  en: { label: 'English',            dir: 'ltr', anchor: (n, g) => `10 Best ${n} in ${g}`,                 path: (s) => `/best/${s}` },
  ja: { label: '日本語',              dir: 'ltr', anchor: (n) => `日本の${n}おすすめ10選`,                  path: (s) => `/ja/best/${s}` },
  ar: { label: 'العربية',            dir: 'rtl', anchor: (n) => `أفضل 10 ${n} في الإمارات والسعودية`,      path: (s) => `/ar/best/${s}` },
  pt: { label: 'Português (Brasil)', dir: 'ltr', anchor: (n) => `Top 10 de ${n} no Brasil`,               path: (s) => `/pt/best/${s}` },
};

export const LINK_LOCALES: LinkLocale[] = ['en', 'ja', 'ar', 'pt'];
