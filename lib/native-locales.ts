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
  /** <title> (geo-in-title rule D13: name the country). `market` = the catalog market this copy
   *  renders (multi-market locales name THAT market's country: /fr → France | Belgique). */
  pageTitle: (noun: string, year: number, market?: string) => string;
  description: (noun: string, market?: string) => string;
  emptyText: (noun: string) => string;
  emptyCta: (noun: string) => string;
}

const BRAND = 'The Winners';

/** Country phrase for the rendered market, else the locale's first market (the crawler copy). */
function geoOf(names: Record<string, string>, markets: string[], market?: string): string {
  return names[market && names[market] ? market : markets[0]];
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
  pageTitle: (n, y) => `${PL.headline(n, y)} w Polsce | ${BRAND}`,
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
  pageTitle: (n, y) => `${ES.headline(n, y)} en España | ${BRAND}`,
  description: (n) =>
    `Comparamos las 10 mejores opciones de ${n.trim()} en España. Una selección objetiva para que elijas el modelo adecuado con confianza.`,
  emptyText: (n) => `Estamos preparando nuestra selección de ${n.trim()}.`,
  emptyCta: (n) => `Buscar ${n.trim()}`,
};

// ── 2026-11-11 (LOCALE SITE 1, roadmap LOCALES_ROADMAP_v1_0): fr · it · de · sv · nl ─────────────
// Same contract as es/pl: the noun sits in a slot that needs no gender / case / plural change
// ("{Noun}: …", "…: {noun}", or quoted). The head noun is a generic "modèles / modelli / Modelle /
// modellerna / modellen", so no adjective ever agrees with the stored noun. DE says "im Vergleich"
// (we compare; no lab-"Test" claim). Multi-market: /fr → ['fr','be'], /nl → ['nl','be'] (a BE
// visitor gets the BE store, crawlers get [0]); their htmlLang is language-only ('fr', 'nl')
// because one page serves both countries. Each locale stays OFF until NEXT_PUBLIC_EU_NATIVE_LOCALES
// lists it. ⚠ DRAFT copy — native-speaker QA before any page indexes (same rule as es/pl).

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const IT_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DE_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const SV_MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

const FR_GEO: Record<string, string> = { fr: 'en France', be: 'en Belgique' };
const FR: NativeLocale = {
  code: 'fr',
  markets: ['fr', 'be'],
  htmlLang: 'fr',
  ogLocale: 'fr_FR',
  languageName: 'Français',
  changeLanguageLabel: 'Changer de langue',
  // "Friteuse à air Ninja : les 10 meilleurs modèles de 2026"
  headline: (n, y) => `${capFirst(n, 'fr-FR')} : les 10 meilleurs modèles de ${y}`,
  // "Avis, comparatif et guide d'achat : friteuse à air Ninja · mis à jour en novembre 2026"
  subHeadline: (n, d = new Date()) =>
    `Avis, comparatif et guide d'achat : ${n.trim()} · mis à jour en ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y, m) => `${FR.headline(n, y)} ${geoOf(FR_GEO, FR.markets, m)} | ${BRAND}`,
  description: (n, m) =>
    `Nous avons comparé les 10 meilleurs modèles de la catégorie « ${n.trim()} » ${geoOf(FR_GEO, FR.markets, m)}. Une sélection objective pour choisir le bon produit en toute confiance.`,
  emptyText: (n) => `Nous préparons notre sélection : ${n.trim()}.`,
  emptyCta: (n) => `Rechercher : ${n.trim()}`,
};

const IT: NativeLocale = {
  code: 'it',
  markets: ['it'],
  htmlLang: 'it-IT',
  ogLocale: 'it_IT',
  languageName: 'Italiano',
  changeLanguageLabel: 'Cambia lingua',
  // "Friggitrice ad aria Ninja: i 10 migliori modelli del 2026"
  headline: (n, y) => `${capFirst(n, 'it-IT')}: i 10 migliori modelli del ${y}`,
  // "Recensioni, confronto e guida all'acquisto: friggitrice ad aria Ninja · aggiornato a novembre 2026"
  subHeadline: (n, d = new Date()) =>
    `Recensioni, confronto e guida all'acquisto: ${n.trim()} · aggiornato a ${IT_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y) => `${IT.headline(n, y)} in Italia | ${BRAND}`,
  description: (n) =>
    `Abbiamo confrontato i 10 migliori modelli nella categoria «${n.trim()}» in Italia. Una selezione obiettiva per scegliere il prodotto giusto in tutta tranquillità.`,
  emptyText: (n) => `Stiamo preparando la nostra selezione: ${n.trim()}.`,
  emptyCta: (n) => `Cerca: ${n.trim()}`,
};

const DE: NativeLocale = {
  code: 'de',
  markets: ['de'],
  htmlLang: 'de-DE',
  ogLocale: 'de_DE',
  languageName: 'Deutsch',
  changeLanguageLabel: 'Sprache ändern',
  // "Heißluftfritteuse Ninja: die 10 besten Modelle 2026 im Vergleich"
  headline: (n, y) => `${capFirst(n, 'de-DE')}: die 10 besten Modelle ${y} im Vergleich`,
  // "Bewertungen, Vergleich und Kaufberatung: Heißluftfritteuse Ninja · aktualisiert im November 2026"
  subHeadline: (n, d = new Date()) =>
    `Bewertungen, Vergleich und Kaufberatung: ${n.trim()} · aktualisiert im ${DE_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y) => `${capFirst(n, 'de-DE')}: die 10 besten Modelle ${y} in Deutschland | ${BRAND}`,
  description: (n) =>
    `Wir haben die 10 besten Modelle in der Kategorie „${n.trim()}“ in Deutschland verglichen. Eine objektive Auswahl, damit Sie sicher das richtige Produkt wählen.`,
  emptyText: (n) => `Wir bereiten unsere Auswahl vor: ${n.trim()}.`,
  emptyCta: (n) => `Suchen: ${n.trim()}`,
};

const SV: NativeLocale = {
  code: 'sv',
  markets: ['se'],
  htmlLang: 'sv-SE',
  ogLocale: 'sv_SE',
  languageName: 'Svenska',
  changeLanguageLabel: 'Byt språk',
  // "Airfryer Ninja: de 10 bästa modellerna 2026"
  headline: (n, y) => `${capFirst(n, 'sv-SE')}: de 10 bästa modellerna ${y}`,
  // "Recensioner, jämförelse och köpguide: airfryer Ninja · uppdaterad november 2026"
  subHeadline: (n, d = new Date()) =>
    `Recensioner, jämförelse och köpguide: ${n.trim()} · uppdaterad ${SV_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y) => `${SV.headline(n, y)} i Sverige | ${BRAND}`,
  description: (n) =>
    `Vi har jämfört de 10 bästa modellerna i kategorin ”${n.trim()}” i Sverige. Ett objektivt urval som hjälper dig att välja rätt produkt.`,
  emptyText: (n) => `Vi förbereder vårt urval: ${n.trim()}.`,
  emptyCta: (n) => `Sök: ${n.trim()}`,
};

const NL_GEO: Record<string, string> = { nl: 'in Nederland', be: 'in België' };
const NL: NativeLocale = {
  code: 'nl',
  markets: ['nl', 'be'],
  htmlLang: 'nl',
  ogLocale: 'nl_NL',
  languageName: 'Nederlands',
  changeLanguageLabel: 'Taal wijzigen',
  // "Airfryer Ninja: de 10 beste modellen van 2026"
  headline: (n, y) => `${capFirst(n, 'nl-NL')}: de 10 beste modellen van ${y}`,
  // "Reviews, vergelijking en koopgids: airfryer Ninja · bijgewerkt in november 2026"
  subHeadline: (n, d = new Date()) =>
    `Reviews, vergelijking en koopgids: ${n.trim()} · bijgewerkt in ${NL_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  pageTitle: (n, y, m) => `${NL.headline(n, y)} ${geoOf(NL_GEO, NL.markets, m)} | ${BRAND}`,
  description: (n, m) =>
    `We hebben de 10 beste modellen in de categorie ‘${n.trim()}’ ${geoOf(NL_GEO, NL.markets, m)} vergeleken. Een objectieve selectie, zodat je met vertrouwen het juiste product kiest.`,
  emptyText: (n) => `We stellen onze selectie samen: ${n.trim()}.`,
  emptyCta: (n) => `Zoeken: ${n.trim()}`,
};

/** Locales that CAN be enabled (have messages/<code>.json). Each stays OFF until its code is in
 *  NEXT_PUBLIC_EU_NATIVE_LOCALES. 2026-11-11: + fr ['fr','be'] · it · de · sv ['se'] · nl ['nl','be']. */
const READY: Record<string, NativeLocale> = { pl: PL, es: ES, fr: FR, it: IT, de: DE, sv: SV, nl: NL };

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
