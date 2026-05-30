// ============================================
// i18n request config — INTL1 Phase 1
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — locale routing scaffolding)
//
// Per-request server config next-intl uses to know the active locale and load
// its UI-string messages. Wired in via createNextIntlPlugin() in next.config.js.
//
// MESSAGES (Phase 1 vs Phase 2): the message JSON files (messages/en.json,
// messages/ar.json) are intentionally minimal stubs right now. Phase 1 only
// introduces routing — no component reads translations yet, so English renders
// byte-identical. Phase 2 (§4.4 of the roadmap) fills the dictionary (chrome
// strings: "Buying Guide", "Quick Pick", breadcrumb "Home", footer, …) and
// migrates components to useTranslations(). Keeping the loader here now means
// Phase 2 only edits JSON, not wiring.
//
// FALLBACK: an unknown/absent locale falls back to the default (en) — defensive
// against a malformed prefix; mirrors the roadmap's English-fallback principle.
// ============================================

import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is the segment matched by the [locale] route (may be async).
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
