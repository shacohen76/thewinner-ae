// ============================================
// i18n routing config — INTL1 Phase 1
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — locale routing scaffolding)
//
// Single source of truth for which locales exist and how they map to URLs.
// Consumed by: i18n/navigation.ts, i18n/request.ts, and middleware.ts.
//
// DECISIONS (see Docs_MD/INTL1_MULTILINGUAL_ROADMAP §4.1 / §0 / Phase 1):
//   • locales = ['en']  — PHASE 1 IS ENGLISH-ONLY ON PURPOSE. Phase 1 only
//     introduces the [locale] route segment + middleware plumbing under the
//     live English site, with ZERO new user-visible surface. Arabic ('ar') is
//     added in Phase 2 (one array entry + a messages file + the locale-aware
//     components/data) — the whole point of Strategy A is that adding a locale
//     is an append here, not a routing rewrite. Keeping Phase 1 single-locale
//     means there is exactly one rendered tree to diff against production
//     (English must stay byte-identical) and no half-built /ar/* pages can leak
//     to crawlers before Phase 2/3 (indexing + hreflang) is ready.
//   • defaultLocale = 'en'    — English is the default.
//   • localePrefix = 'as-needed' — the CRITICAL choice. The default locale
//     (en) is served WITHOUT a path prefix via an internal REWRITE (not a
//     redirect), so every existing English URL (/best/x, /category/x, /blog…)
//     stays byte-for-byte identical and keeps its rankings. With one locale
//     today this means every path renders prefix-less as English; once 'ar'
//     lands it gets a /ar prefix while English paths are untouched.
// ============================================

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Phase 2A: Arabic ('ar') added. English stays the default and prefix-less;
  // 'ar' is served under /ar/* and is NOINDEX during Phase 2 (enforced by an
  // X-Robots-Tag header in middleware.ts, not per-page metadata, so the whole
  // /ar subtree is private regardless of any page's own robots). Add 'pt', … later.
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  // English prefix-less (rewrite); non-default locales get a /xx prefix.
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
