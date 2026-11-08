// ============================================================================
// lib/native-locales.ts — EU single-language locales (/pl, /es, …) — EU NATIVE 1
// ----------------------------------------------------------------------------
// Created: 2026-11-08 (EU NATIVE 1, plan AMZ_AFF/Docs_MD/EU_NATIVE_PLAN_v0_1_2026_11_08.md).
//
// An EU native locale = a URL language axis (/pl/best/<english-slug>) over a store catalog
// that already exists (keyword_products.marketplace = pl | es | …, built by ML 6.x). Page text
// comes from the language overlays only: keyword_translations(L) (noun + BYG) and
// product_translations(L) (title, specs, WWL). Same owner rules as /pt (BR 1, D2/D3):
//   • slugs stay English · never 404 · never English on the page (no noun → redirect to the
//     English page; no BYG/WWL → section hidden; no products → native empty state + store search).
//
// PINNED TO ITS OWN MARKETS (no fan-out): a locale here renders ONLY its `markets` (first =
// crawlers + visitors from any other country). Without this a geo-followed locale gets one
// ISR copy per CATALOG_MARKETPLACES entry (16) — see lib/cache-tags.ts bestPageCopies.
//
// FLAG: build-time NEXT_PUBLIC_EU_NATIVE_LOCALES = comma list (e.g. "pl" or "pl,es"). Unset /
// empty (default) → no EU locale exists anywhere: routing, middleware, sitemap, switcher and
// every page render byte-identically to before. Only codes in READY below can be enabled
// (each needs messages/<code>.json + native-QA'd templates).
//
// Templates: nouns are stored in the SINGULAR search form (as pt), so every template keeps the
// noun in a slot that needs no plural / case change ("{Noun}: …", "…: {noun}").
// ⚠ DRAFT copy — native-speaker QA required before any page indexes (owner rule, as pt).
// No template names Amazon / Prime (owner rule 2026-10-01).
// ============================================================================

import { EU_NATIVE_LOCALES_RAW } from './feature-flags';

export interface NativeLocale {
  code: string;
  /** Catalog markets this locale renders. [0] = crawlers + visitors outside these countries. */
  markets: string[];
  /** <html lang>, hreflang, og:locale, date formatting. */
  htmlLang: string;
  ogLocale: string;
  languageName: string;
  changeLanguageLabel: string;
  headline: (noun: string, year: number) => string;
  subHeadline: (noun: string, date?: Date) => string;
  /** <title> (geo-in-title rule D13: single-country locales name the country). */
  pageTitle: (noun: string, year: number, brand?: string) => string;
  description: (noun: string) => string;
  emptyText: (noun: string) => string;
  emptyCta: (noun: string) => string;
}

function capFirst(s: string, lang: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toLocaleUpperCase(lang) + t.slice(1) : t;
}

const ES_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Polish month names in the nominative (used after "aktualizacja:", no case change needed).
const PL_MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

const PL: NativeLocale = {
  code: 'pl',
  markets: ['pl'],
  htmlLang: 'pl-PL',
  ogLocale: 'pl_PL',
  languageName: 'Polski',
  changeLanguageLabel: 'Zmień język',
  // "Głośnik JBL: ranking 10 najlepszych modeli 2026"
  headline: (n, y) => `${capFirst(n, 'pl-PL')}: ranking 10 najlepszych modeli ${y}`,
  // "Recenzje, porównanie i poradnik zakupowy: głośnik JBL · aktualizacja: listopad 2026"
  subHeadline: (n, d = new Date()) =>
    `Recenzje, porównanie i poradnik zakupowy: ${n.trim()} · aktualizacja: ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y, brand = 'The Winners') => `${PL.headline(n, y)} w Polsce | ${brand}`,
  description: (n) =>
    `Porównaliśmy 10 najlepszych modeli w kategorii: ${n.trim()}. Obiektywny wybór, który pomoże Ci kupić właściwy model.`,
  emptyText: (n) => `Przygotowujemy nasz wybór w kategorii: ${n.trim()}.`,
  emptyCta: (n) => `Szukaj: ${n.trim()}`,
};

const ES: NativeLocale = {
  code: 'es',
  markets: ['es'],
  htmlLang: 'es-ES',
  ogLocale: 'es_ES',
  languageName: 'Español',
  changeLanguageLabel: 'Cambiar idioma',
  // "Freidora de aire Ninja: los 10 mejores de 2026"
  headline: (n, y) => `${capFirst(n, 'es-ES')}: los 10 mejores de ${y}`,
  // "Análisis, comparativa y guía de compra de freidora de aire Ninja · actualizado en noviembre de 2026"
  subHeadline: (n, d = new Date()) =>
    `Análisis, comparativa y guía de compra de ${n.trim()} · actualizado en ${ES_MONTHS[d.getMonth()]} de ${d.getFullYear()}`,
  pageTitle: (n, y, brand = 'The Winners') => `${ES.headline(n, y)} en España | ${brand}`,
  description: (n) =>
    `Comparamos las 10 mejores opciones de ${n.trim()} en España. Una selección objetiva para que elijas el modelo adecuado con confianza.`,
  emptyText: (n) => `Estamos preparando nuestra selección de ${n.trim()}.`,
  emptyCta: (n) => `Buscar ${n.trim()}`,
};

/** Locales that CAN be enabled (have messages/<code>.json). Add fr/it/de/nl/sv here as each lands
 *  (planned markets: fr → ['fr','be'], nl → ['nl','be'], de → ['de'], it → ['it'], sv → ['se']). */
const READY: Record<string, NativeLocale> = { pl: PL, es: ES };

/** Enabled EU native locales, in flag order (unknown / not-ready codes ignored). */
export const EU_NATIVE_LOCALES: NativeLocale[] = EU_NATIVE_LOCALES_RAW
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((c, i, a) => !!READY[c] && a.indexOf(c) === i)
  .map((c) => READY[c]);

export const EU_NATIVE_CODES: string[] = EU_NATIVE_LOCALES.map((l) => l.code);

/** locale → its pinned markets, for every ENABLED EU native locale ({} when the flag is off). */
export const EU_NATIVE_LOCALE_MARKETS: Record<string, string[]> = Object.fromEntries(
  EU_NATIVE_LOCALES.map((l) => [l.code, l.markets]),
);

export function getEuNativeLocale(locale: string): NativeLocale | null {
  return EU_NATIVE_LOCALES.find((l) => l.code === locale) ?? null;
}

/** Single-language locales follow the "never English on the page" rules: pt (BR 1) + EU native. */
export function isSingleLanguageLocale(locale: string): boolean {
  return locale === 'pt' || !!getEuNativeLocale(locale);
}
