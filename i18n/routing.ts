// ============================================
// i18n routing config — INTL1 Phase 1
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — locale routing scaffolding)
//
// Single source of truth for which locales exist and how they map to URLs.
// Consumed by: i18n/navigation.ts, i18n/request.ts, and middleware.ts.
//
// DECISIONS (see Docs_MD/INTL1_MULTILINGUAL_ROADMAP §4.1 / §0):
//   • locales = ['en', 'ar']  — English is the live site; Arabic mirrors it.
//     Portuguese ('pt') etc. are added later by appending here + a messages
//     file — zero routing code changes (that is the whole point of Strategy A).
//   • defaultLocale = 'en'    — English is the default.
//   • localePrefix = 'as-needed' — the CRITICAL choice. The default locale
//     (en) is served WITHOUT a path prefix via an internal REWRITE (not a
//     redirect), so every existing English URL (/best/x, /category/x, /blog…)
//     stays byte-for-byte identical and keeps its rankings. Only non-default
//     locales get a prefix: ar → /ar/best/x. This is what lets us add the
//     [locale] segment without disturbing the English path.
// ============================================

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  // English prefix-less (rewrite); 'ar' (and future locales) get a /xx prefix.
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
