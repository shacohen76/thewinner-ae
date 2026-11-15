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
  /** `market` (2026-11-15) = the rendered catalog market: /fr and /nl name FR|BE / NL|BE as on their base pages. */
  pageTitle: (noun: string, year: number, market?: string) => string;
  description: (noun: string, year: number, market?: string) => string;
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

// 2026-11-15 (EU NATIVE 1, owner via 6.9): pl / fr / it / de / sv / nl rows. Each was checked by a
// separate native reviewer (one per language). Stricter than the 2026-11-11 rows: "Black Friday" is
// the ONLY event name (no "Cyber Monday" / "Black Week"). The noun is stored in its singular
// search form and cannot be declined, so it sits only in case-neutral slots ("{Noun}: …",
// "…: {noun}", quoted after "category"). /fr and /nl name the rendered market's country, exactly
// as their base pages do (lib/native-locales.ts FR_GEO / NL_GEO).
const geo = (names: Record<string, string>, first: string, market?: string) =>
  names[market && names[market] ? market : first];
const FR_GEO: Record<string, string> = { fr: 'en France', be: 'en Belgique' };
const NL_GEO: Record<string, string> = { nl: 'in Nederland', be: 'in België' };

const PL: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'pl-PL')}: 10 najlepszych modeli na Black Friday ${y}`,
  subHeadline: (n, y) => `Ranking i poradnik zakupowy: ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y) => `${PL.headline(n, y)} w Polsce | ${brand}`,
  description: (n, y) => `Black Friday ${y}: porównaliśmy 10 najlepszych modeli w kategorii „${n.trim()}”, z ich zaletami i krótkim poradnikiem zakupowym. Przed zakupem sprawdź aktualną cenę w sklepie.`,
  strip: (y) => ({
    title: `Tydzień Black Friday ${y}`,
    body: 'W tygodniu Black Friday ceny szybko się zmieniają: przed zakupem sprawdź aktualną cenę każdego produktu w sklepie.',
  }),
  intro: (n) => `Szukasz modelu w kategorii „${n.trim()}” na Black Friday? Porównaliśmy najpopularniejsze modele i wybraliśmy 10 najlepszych, żeby zakupy były łatwiejsze.`,
  cardBadge: (y) => `WYBÓR NA BLACK FRIDAY ${y}`,
};

const FR: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'fr-FR')} : les 10 meilleurs modèles pour le Black Friday ${y}`,
  subHeadline: (n, y) => `Notre classement et notre guide d'achat : ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y, m) => `${FR.headline(n, y)} ${geo(FR_GEO, 'fr', m)} | ${brand}`,
  description: (n, y, m) => `Black Friday ${y} : nous avons comparé les 10 meilleurs modèles de la catégorie « ${n.trim()} » ${geo(FR_GEO, 'fr', m)}, avec leurs points forts et un guide d'achat rapide. Vérifiez le prix actuel sur le site marchand avant d'acheter.`,
  strip: (y) => ({
    title: `Semaine du Black Friday ${y}`,
    body: 'Les prix changent vite pendant la semaine du Black Friday : vérifiez le prix actuel de chaque produit sur le site marchand avant d\'acheter.',
  }),
  intro: (n) => `Vous cherchez un produit de la catégorie « ${n.trim()} » pour le Black Friday ? Nous avons comparé les modèles les plus populaires et retenu les 10 meilleurs pour vous aider à acheter en toute confiance.`,
  cardBadge: (y) => `SÉLECTION BLACK FRIDAY ${y}`,
};

const IT: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'it-IT')}: i 10 migliori modelli per il Black Friday ${y}`,
  subHeadline: (n, y) => `La nostra classifica e guida all'acquisto: ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y) => `${IT.headline(n, y)} in Italia | ${brand}`,
  description: (n, y) => `Black Friday ${y}: abbiamo confrontato i 10 migliori modelli nella categoria «${n.trim()}», con i loro punti di forza e una rapida guida all'acquisto. Controlla il prezzo attuale sul sito del negozio prima di acquistare.`,
  strip: (y) => ({
    title: `Settimana del Black Friday ${y}`,
    body: 'Durante la settimana del Black Friday i prezzi cambiano rapidamente: controlla il prezzo attuale di ogni prodotto sul sito del negozio prima di acquistare.',
  }),
  intro: (n) => `Cerchi un prodotto nella categoria «${n.trim()}» per il Black Friday? Abbiamo confrontato i modelli più popolari e scelto i 10 migliori, per aiutarti ad acquistare in tutta tranquillità.`,
  cardBadge: (y) => `SCELTA BLACK FRIDAY ${y}`,
};

const DE: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'de-DE')}: die 10 besten Modelle zum Black Friday ${y}`,
  subHeadline: (n, y) => `Ranking und Kaufberatung: ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y) => `${DE.headline(n, y)} in Deutschland | ${brand}`,
  description: (n, y) => `Black Friday ${y}: Wir haben die 10 besten Modelle in der Kategorie „${n.trim()}“ mit ihren Stärken und einer kurzen Kaufberatung verglichen. Prüfen Sie vor dem Kauf den aktuellen Preis im Shop.`,
  strip: (y) => ({
    title: `Black-Friday-Woche ${y}`,
    body: 'In der Black-Friday-Woche ändern sich die Preise schnell: Prüfen Sie vor dem Kauf den aktuellen Preis jedes Produkts im Shop.',
  }),
  intro: (n) => `Sie suchen zum Black Friday ein Produkt in der Kategorie „${n.trim()}“? Wir haben die beliebtesten Modelle verglichen und die 10 besten ausgewählt, damit Sie sicher einkaufen können.`,
  cardBadge: (y) => `BLACK-FRIDAY-TIPP ${y}`,
};

const SV: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'sv-SE')}: de 10 bästa modellerna till Black Friday ${y}`,
  subHeadline: (n, y) => `Vår topplista och köpguide: ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y) => `${SV.headline(n, y)} i Sverige | ${brand}`,
  description: (n, y) => `Black Friday ${y}: vi har jämfört de 10 bästa modellerna i kategorin ”${n.trim()}”, med deras styrkor och en kort köpguide. Kontrollera det aktuella priset i butiken innan du köper.`,
  strip: (y) => ({
    title: `Black Friday-veckan ${y}`,
    body: 'Priserna ändras snabbt under Black Friday-veckan: kontrollera det aktuella priset på varje produkt i butiken innan du köper.',
  }),
  intro: (n) => `Letar du efter en produkt i kategorin ”${n.trim()}” till Black Friday? Vi har jämfört de populäraste modellerna och valt ut de 10 bästa, så att du kan handla tryggt.`,
  cardBadge: (y) => `BLACK FRIDAY-TIPS ${y}`,
};

const NL: BfCopy = {
  headline: (n, y) => `${capFirst(n, 'nl-NL')}: de 10 beste modellen voor Black Friday ${y}`,
  subHeadline: (n, y) => `Onze ranglijst en koopgids: ${n.trim()} · Black Friday ${y}`,
  pageTitle: (n, y, m) => `${NL.headline(n, y)} ${geo(NL_GEO, 'nl', m)} | ${brand}`,
  description: (n, y, m) => `Black Friday ${y}: we hebben de 10 beste modellen in de categorie ‘${n.trim()}’ ${geo(NL_GEO, 'nl', m)} vergeleken, met hun sterke punten en een korte koopgids. Controleer de actuele prijs in de winkel voordat je koopt.`,
  strip: (y) => ({
    title: `Black Friday-week ${y}`,
    body: 'Tijdens de Black Friday-week veranderen de prijzen snel: controleer de actuele prijs van elk product in de winkel voordat je koopt.',
  }),
  intro: (n) => `Op zoek naar een product in de categorie ‘${n.trim()}’ voor Black Friday? We hebben de populairste modellen vergeleken en de 10 beste geselecteerd, zodat je met een gerust hart kunt kopen.`,
  cardBadge: (y) => `BLACK FRIDAY-KEUZE ${y}`,
};

export const BF_COPY: Record<BfLocale, BfCopy> = {
  en: EN, ar: AR, ja: JA, pt: PT, es: ES, pl: PL, fr: FR, it: IT, de: DE, sv: SV, nl: NL,
};

/** hreflang key per BF locale (matches lib/seo-alternates: en-AE, plain ar/ja, region for pt/es;
 *  EU locales = their htmlLang in lib/native-locales.ts — fr / nl plain because they serve two countries). */
export const BF_HREFLANG: Record<BfLocale, string> = {
  en: 'en-AE', ar: 'ar', ja: 'ja', pt: 'pt-BR', es: 'es-ES',
  pl: 'pl-PL', fr: 'fr', it: 'it-IT', de: 'de-DE', sv: 'sv-SE', nl: 'nl',
};
