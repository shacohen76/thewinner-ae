// ============================================
// Black Friday twin pages — ALL BF texts live HERE (one place, one row per locale)
// ============================================
// Created: 2026-11-10 (BF 1). Headline = option A (owner D1). Extra BF copy = owner Q4.
// 2026-11-11: + ar / ja / pt / es rows (owner "very very important"). Each non-English row was
// native-checked by a separate reviewer (BF_PAGES_PLAN, UPDATE 2026-11-11). To add a language
// (fr/it/de/sv/nl via LOCALE SITE 1): add its code to BF_LOCALES (lib/bf-twin.ts) + a row below —
// the compiler refuses a BF locale without a row.
// Rules: never mention the store or any store-branded sale event (Arabic uses the generic
// "بلاك فرايدي", never a retailer's "White/Yellow Friday"); brands stay Latin (nouns as stored);
// no %-off / price claims — the page shows no prices, so the copy only points to the current
// price at the store. {noun} = keyword_text on en, the stored locale noun elsewhere.
// ============================================

import { toTitleCase, CONFIG } from '@/lib/utils';
import type { BfLocale } from '@/lib/bf-twin';

export interface BfCopy {
  headline: (noun: string, year: number) => string;
  subHeadline: (noun: string, year: number) => string;
  pageTitle: (noun: string, year: number) => string;
  description: (noun: string, year: number) => string;
  strip: (year: number) => { title: string; body: string };
  intro: (noun: string) => string;
  cardBadge: (year: number) => string;
}

const capFirst = (s: string, lang: string) => {
  const t = s.trim();
  return t ? t.charAt(0).toLocaleUpperCase(lang) + t.slice(1) : t;
};
const brand = CONFIG.siteName;

const EN: BfCopy = {
  headline: (n, y) => `10 Best ${toTitleCase(n)} – Black Friday Deals ${y}`,
  subHeadline: (n, y) => `${toTitleCase(n)} — Our Ranked Picks & Buying Guide for Black Friday ${y}`,
  pageTitle: (n, y) => `${EN.headline(n, y)} | ${brand}`,
  description: (n, y) => `Black Friday ${y}: our top 10 ${toTitleCase(n)}, compared side by side with honest pros and a quick buying guide. Check each pick's current Black Friday price at the store before you buy.`,
  strip: (y) => ({
    title: `Black Friday & Cyber Monday ${y}`,
    body: 'Deals change fast during Black Friday week — check the current price of each pick at the store before you buy.',
  }),
  intro: (n) => `Shopping for ${toTitleCase(n)} this Black Friday? We compared the most popular options and ranked our top 10, so you can shop the season with confidence.`,
  cardBadge: (y) => `BLACK FRIDAY PICK ${y}`,
};

const AR: BfCopy = {
  headline: (n, y) => `أفضل 10 ${n.trim()} – عروض بلاك فرايدي ${y}`,
  subHeadline: (n, y) => `${n.trim()} — اختياراتنا المرتّبة ودليل الشراء لموسم بلاك فرايدي ${y}`,
  pageTitle: (n, y) => `${AR.headline(n, y)} | ${brand}`,
  description: (n, y) => `بلاك فرايدي ${y}: أفضل 10 ${n.trim()} قارنّاها جنبًا إلى جنب، مع المزايا الحقيقية ودليل شراء سريع. تحقّق من السعر الحالي لكل اختيار في المتجر قبل الشراء.`,
  strip: (y) => ({
    title: `بلاك فرايدي وسايبر مونداي ${y}`,
    body: 'العروض تتغيّر بسرعة خلال أسبوع بلاك فرايدي — تحقّق من السعر الحالي لكل اختيار في المتجر قبل الشراء.',
  }),
  intro: (n) => `تبحث عن ${n.trim()} في بلاك فرايدي؟ قارنّا الخيارات الأكثر شعبية ورتّبنا أفضل 10 منها، لتتسوّق هذا الموسم بثقة.`,
  cardBadge: (y) => `اختيار بلاك فرايدي ${y}`,
};

const JA: BfCopy = {
  headline: (n, y) => `【${y}年ブラックフライデー】${n.trim()}のおすすめ10選`,
  subHeadline: (n, y) => `${n.trim()}のおすすめランキングと選び方ガイド｜ブラックフライデー${y}`,
  pageTitle: (n, y) => `${JA.headline(n, y)} | ${brand}`,
  description: (n, y) => `ブラックフライデー${y}に向けて、${n.trim()}のおすすめ10選を徹底比較。特長や選び方のポイントもまとめました。価格は変動するため、購入前にストアで最新の価格をご確認ください。`,
  strip: (y) => ({
    title: `ブラックフライデー＆サイバーマンデー${y}`,
    body: 'ブラックフライデー期間中は価格が頻繁に変わります。ご購入前に、各商品の最新価格をストアでご確認ください。',
  }),
  intro: (n) => `ブラックフライデーに${n.trim()}をお探しの方へ。人気の商品を比較し、おすすめのトップ10を厳選しました。商品選びの参考にご活用ください。`,
  cardBadge: (y) => `ブラックフライデー${y} おすすめ`,
};

const PT: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'pt-BR')}: os 10 melhores para a Black Friday ${y}`,
  subHeadline: (n, y) => `Nossa seleção ranqueada e guia de compra de ${n.trim()} para a Black Friday ${y}`,
  pageTitle: (n, y) => `${PT.headline(n, y)} no Brasil | ${brand}`,
  description: (n, y) => `Black Friday ${y}: comparamos as 10 melhores opções de ${n.trim()}, com prós e um guia de compra rápido. Confira o preço atual de cada opção na loja antes de comprar.`,
  strip: (y) => ({
    title: `Black Friday e Cyber Monday ${y}`,
    body: 'Os preços mudam rápido durante a semana da Black Friday. Confira o preço atual de cada opção na loja antes de comprar.',
  }),
  intro: (n) => `Procurando ${n.trim()} na Black Friday? Comparamos as opções mais populares e selecionamos as 10 melhores para você comprar com confiança.`,
  cardBadge: (y) => `ESCOLHA BLACK FRIDAY ${y}`,
};

const ES: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'es-ES')}: los 10 mejores para el Black Friday ${y}`,
  subHeadline: (n, y) => `Nuestra selección ordenada y guía de compra de ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y) => `${ES.headline(n, y)} en España | ${brand}`,
  description: (n, y) => `Black Friday ${y}: comparamos las 10 mejores opciones de ${n.trim()}, con sus ventajas y una guía de compra rápida. Consulta el precio actual en la tienda antes de comprar.`,
  strip: (y) => ({
    title: `Black Friday y Cyber Monday ${y}`,
    body: 'Los precios cambian rápido durante la semana del Black Friday: consulta el precio actual en la tienda antes de comprar.',
  }),
  intro: (n) => `¿Buscas ${n.trim()} para el Black Friday? Hemos comparado las opciones más populares y elegido las 10 mejores para que compres con confianza.`,
  cardBadge: (y) => `ELECCIÓN BLACK FRIDAY ${y}`,
};

export const BF_COPY: Record<BfLocale, BfCopy> = { en: EN, ar: AR, ja: JA, pt: PT, es: ES };

/** hreflang key per BF locale (matches lib/seo-alternates: en-AE, plain ar/ja, region for pt/es). */
export const BF_HREFLANG: Record<BfLocale, string> = { en: 'en-AE', ar: 'ar', ja: 'ja', pt: 'pt-BR', es: 'es-ES' };
