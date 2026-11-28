// ============================================================
// gen-home-featured.mjs — regenerate lib/home-featured.generated.json
// Created 2026-11-28 (homepage magazine).
//
// WHAT: builds the homepage "Popular Buying Guides" snapshot — per-locale top
// /best slugs with native anchor text — from OUR OWN ranking data. The homepage
// imports the JSON synchronously (ZERO runtime DB). Re-run this to refresh.
//
// REFRESH CADENCE: run monthly (or after a big ranking shift) and open a small PR
// with the regenerated JSON. Because we only emit slugs that currently RANK
// (sitemap_top_slugs / active allowlist), a page that later loses its products
// drops out of the next snapshot rather than becoming a dead/thin link.
//
// SOURCE (hybrid, by what each locale actually has):
//   • en, pt, de, es, fr, it, nl, pl, sv  → public.sitemap_top_slugs, ranked by `rk` (asc = top).
//   • ar, ja                              → public.seo_index_allowlist (active), ranked by `score` (desc).
// Both are intersected with a curated MAINSTREAM set so the home shows broad,
// sensible categories (owner's standing "worldwide, most-searchable, that make
// sense" rule). Native anchors come from keyword_translations.keyword_text
// (en uses the curated EN_NAMES labels; en is not in keyword_translations).
//
// RUN:  node scripts/gen-home-featured.mjs            (reads .env.local)
//       node scripts/gen-home-featured.mjs --print    (print, don't write)
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'lib', 'home-featured.generated.json');

// ── config ───────────────────────────────────────────────────────────────────
const SITEMAP_LOCALES = ['en', 'pt', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'sv'];
const ALLOWLIST_LOCALES = ['ar', 'ja'];
const LOCALE_ORDER = ['en', 'ar', 'ja', 'pt', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'sv'];
const CAP = { en: 24, _default: 18 };
const MIN_ITEMS = 6; // omit a locale with fewer than this (too thin for a section)

// Curated mainstream /best slugs (broad, globally-searchable). Grows by hand.
const MAINSTREAM = [
  'nokia-phone','xiaomi-phones','nothing-phone','samsung-galaxy-phones','oppo-phone','mobile-phones','xiaomi-tablet','samsung-tablets',
  'gaming-laptops','asus-laptops','asus-vivobook','macbook-air','laptops','portable-monitor','logitech-wireless-mouse','power-bank','phone-charger','thunderbolt-cables',
  'airpods','xiaomi-earbuds','earbuds','jbl-headphones','portable-speakers','amazfit-watches','xiaomi-smartwatch','xiaomi-watches','smart-watches',
  'dslr-camera','instant-cameras','fujifilm-digital-cameras','xiaomi-tvs','televisions',
  'steam-irons','tefal-iron','tower-fan','vacuum-cleaners','roborock-vacuum-cleaners','xiaomi-vacuum-cleaner','coffee-machines','lavazza-coffee','kettles','blenders','ninja-foodi','air-fryers','washing-machines',
  'electric-toothbrush','water-flosser','hair-straightener','electric-hair-brush','2-in-1-shampoo-conditioner','razors','night-cream-for-all-skin-types','face-moisturizers',
  'rasasi-hawas-perfume-for-men','dolce-gabbana-parfum-men','david-beckham-parfum','my-perfume-perfume-100ml',
  'milk-powder-for-baby','baby-chairs','cat-food','dog-food',
];

// (locale, slug) pairs to drop for a bad/odd stored noun (brand mismatch, junk suffix).
const EXCLUDE = new Set([
  'ja:roborock-vacuum-cleaners', // stored noun says "ルンバ"(Roomba) — brand mismatch
  'ja:hair-straightener',        // stored noun has a junk suffix
  'sv:macbook-air',              // stored noun = "...tillbehör" (accessories), not the product
]);

// Curated English labels (en has no keyword_translations row).
const EN_NAMES = {
  'nokia-phone':'Nokia Phones','xiaomi-phones':'Xiaomi Phones','nothing-phone':'Nothing Phones','samsung-galaxy-phones':'Samsung Galaxy Phones','oppo-phone':'Oppo Phones','mobile-phones':'Mobile Phones','xiaomi-tablet':'Xiaomi Tablets','samsung-tablets':'Samsung Tablets',
  'gaming-laptops':'Gaming Laptops','asus-laptops':'ASUS Laptops','asus-vivobook':'ASUS Vivobook Laptops','macbook-air':'MacBook Air','laptops':'Laptops','portable-monitor':'Portable Monitors','logitech-wireless-mouse':'Logitech Wireless Mice','power-bank':'Power Banks','phone-charger':'Phone Chargers','thunderbolt-cables':'Thunderbolt Cables',
  'airpods':'AirPods','xiaomi-earbuds':'Xiaomi Earbuds','earbuds':'Wireless Earbuds','jbl-headphones':'JBL Headphones','portable-speakers':'Portable Speakers','amazfit-watches':'Amazfit Watches','xiaomi-smartwatch':'Xiaomi Smartwatches','xiaomi-watches':'Xiaomi Smartwatches','smart-watches':'Smartwatches',
  'dslr-camera':'DSLR Cameras','instant-cameras':'Instant Cameras','fujifilm-digital-cameras':'Fujifilm Cameras','xiaomi-tvs':'Xiaomi TVs','televisions':'Televisions',
  'steam-irons':'Steam Irons','tefal-iron':'Tefal Irons','tower-fan':'Tower Fans','vacuum-cleaners':'Vacuum Cleaners','roborock-vacuum-cleaners':'Roborock Vacuum Cleaners','xiaomi-vacuum-cleaner':'Xiaomi Vacuum Cleaners','coffee-machines':'Coffee Machines','lavazza-coffee':'Lavazza Coffee','kettles':'Electric Kettles','blenders':'Blenders','ninja-foodi':'Ninja Foodi','air-fryers':'Air Fryers','washing-machines':'Washing Machines',
  'electric-toothbrush':'Electric Toothbrushes','water-flosser':'Water Flossers','hair-straightener':'Hair Straighteners','electric-hair-brush':'Electric Hair Brushes','2-in-1-shampoo-conditioner':'2-in-1 Shampoo & Conditioner','razors':'Razors','night-cream-for-all-skin-types':'Night Cream','face-moisturizers':'Face Moisturizers',
  'rasasi-hawas-perfume-for-men':'Rasasi Hawas Perfume for Men','dolce-gabbana-parfum-men':'Dolce & Gabbana Perfume','david-beckham-parfum':'David Beckham Perfume','my-perfume-perfume-100ml':'Perfumes',
  'milk-powder-for-baby':'Baby Milk Powder','baby-chairs':'Baby Chairs','cat-food':'Cat Food','dog-food':'Dog Food',
};
const humanize = (s) => s.split('-').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');

// ── env + REST ────────────────────────────────────────────────────────────────
function loadEnv() {
  const txt = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const get = (k) => {
    const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
  };
  const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
  const key = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  return { url: url.replace(/\/$/, ''), key };
}
const { url: SB_URL, key: SB_KEY } = loadEnv();

async function rest(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`REST ${res.status} ${res.statusText} for ${path}: ${await res.text()}`);
  return res.json();
}
const inList = (vals) => `(${vals.join(',')})`; // slugs/ids are safe (alnum + hyphen)

// native nouns for a set of slugs in a locale (keyword_translations via keywords)
async function nounsFor(locale, slugs) {
  if (slugs.length === 0) return {};
  const kws = await rest(`keywords?select=id,slug&slug=in.${inList(slugs)}`);
  const slugById = new Map(kws.map((k) => [k.id, k.slug]));
  const ids = kws.map((k) => k.id);
  const out = {};
  if (ids.length) {
    const tr = await rest(`keyword_translations?select=keyword_id,keyword_text&locale=eq.${locale}&keyword_id=in.${inList(ids)}&order=id.asc`);
    for (const r of tr) {
      const slug = slugById.get(r.keyword_id);
      if (slug && out[slug] === undefined && r.keyword_text) out[slug] = r.keyword_text;
    }
  }
  return out;
}

async function rankedSlugs(locale) {
  if (ALLOWLIST_LOCALES.includes(locale)) {
    const rows = await rest(`seo_index_allowlist?select=slug,score&locale=eq.${locale}&active=is.true&slug=in.${inList(MAINSTREAM)}&order=score.desc.nullslast`);
    return rows.map((r) => r.slug);
  }
  const rows = await rest(`sitemap_top_slugs?select=slug,rk&locale=eq.${locale}&slug=in.${inList(MAINSTREAM)}&order=rk.asc`);
  return rows.map((r) => r.slug);
}

async function buildLocale(locale) {
  const ordered = await rankedSlugs(locale);
  const cap = CAP[locale] ?? CAP._default;
  const names = locale === 'en' ? {} : await nounsFor(locale, ordered);
  const items = [];
  for (const slug of ordered) {
    if (EXCLUDE.has(`${locale}:${slug}`)) continue;
    const name = locale === 'en' ? (EN_NAMES[slug] ?? humanize(slug)) : names[slug];
    if (!name) continue; // non-en slug with no native noun → skip (relevance)
    items.push({ slug, name });
    if (items.length >= cap) break;
  }
  return items;
}

async function main() {
  const out = {};
  for (const locale of [...SITEMAP_LOCALES, ...ALLOWLIST_LOCALES]) {
    const items = await buildLocale(locale);
    if (items.length >= MIN_ITEMS) out[locale] = items;
    else console.warn(`skip ${locale}: only ${items.length} items (< ${MIN_ITEMS})`);
  }
  // stable locale key order
  const ordered = {};
  for (const l of LOCALE_ORDER) if (out[l]) ordered[l] = out[l];
  const json = JSON.stringify(ordered, null, 2) + '\n';
  const summary = Object.entries(ordered).map(([l, v]) => `${l}:${v.length}`).join('  ');
  if (process.argv.includes('--print')) {
    console.log(json);
  } else {
    writeFileSync(OUT, json);
    console.log(`wrote ${OUT}`);
  }
  console.log(`locales: ${summary}`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
