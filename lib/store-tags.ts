// ============================================
// STORE TAGS — the fixed Amazon store tag per market (TAGS 1, 2026-11-23)
// ============================================
// Values come from Supabase tag_pool (program='ae' fixed rows), read ONCE per build by
// scripts/fetch-store-tags.mjs into store-tags.generated.json. Nothing here reads the DB or env
// at runtime, so this is safe to import from middleware, server and browser code, and adds no
// per-page-view read and no data cache (the 7-day ISR page lifetime is untouched).
//
// To switch a store: change the tag_pool row, then Redeploy both Vercel projects. No code change.
// ============================================
import generated from './store-tags.generated.json';

export type StoreTagMarket =
  | 'ae' | 'sa' | 'us' | 'ca' | 'au' | 'sg' | 'jp' | 'br'
  | 'uk' | 'de' | 'it' | 'es' | 'fr' | 'pl' | 'se' | 'ie' | 'be' | 'nl';

export const STORE_TAGS: Readonly<Record<StoreTagMarket, string>> = generated.tags;
