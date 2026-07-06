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
  // INTL1 JP Phase 2 (2026-07-06): Japanese ('ja') added — SAME pattern as 'ar'
  // (served under /ja/*, LTR, DB-driven auto-index gated on ja noun+BYG; the
  // whole /ja subtree is noindex EXCEPT /ja/best/* per middleware). Language is a
  // URL axis over the geo-driven JP catalog (catalog = f(geo), language = f(URL)).
  locales: ['en', 'ar', 'ja'],
  defaultLocale: 'en',
  // English prefix-less (rewrite); non-default locales get a /xx prefix.
  localePrefix: 'as-needed',
  // INTL1 Phase 3: LANGUAGE IS A URL AXIS — never auto-pick a locale from the
  // visitor's cookie or Accept-Language. With detection ON (the next-intl
  // default), a `NEXT_LOCALE=ar` cookie (which next-intl sets the moment anyone
  // visits /ar) makes EVERY prefix-less English URL 307-redirect to /ar — so
  // once the language switcher links /ar, an English visitor who peeks at Arabic
  // would get bounced to Arabic on all later English visits (and the "English"
  // switcher itself). Disabling detection keeps prefix-less = always English and
  // /ar reachable only by explicit URL, matching the project's decoupling rule
  // (§10 / roadmap). Geo stays a SEPARATE axis via tw_geo + TrackingProvider.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
