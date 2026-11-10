// ============================================
// Feature flags — build-time switches (NEXT_PUBLIC_* are inlined at build, so the
// same value is seen by middleware (edge), server components and client code).
// ============================================
// Created: 2026-09-26 (BR 1 — Portuguese / amazon.com.br foundation).
// Study: AMZ_AFF/Docs_MD/BR_PT_FOUNDATION_STUDY_v0_2.md
//
// BR_PT_ENABLED — adds the 'pt' locale (Brazilian Portuguese, URL /pt/*) pinned to
// the 'br' catalog (amazon.com.br). OFF by default: with the flag unset the site is
// byte-identical to before (no /pt routes, no switcher entry, no extra ISR copies).
// Turn on only after the BR pilot is reviewed AND the data is in Supabase.
// ============================================

export const BR_PT_ENABLED = process.env.NEXT_PUBLIC_BR_PT_ENABLED === '1';

// EU_NATIVE_LOCALES_RAW (2026-11-08, EU NATIVE 1) — comma list of EU single-language locales to
// enable, e.g. "pl" or "pl,es" (parsed + validated in lib/native-locales.ts). Unset (default) →
// no EU locale anywhere; the site is byte-identical to before.
export const EU_NATIVE_LOCALES_RAW = process.env.NEXT_PUBLIC_EU_NATIVE_LOCALES || '';

// BF_TWINS_ENABLED (2026-11-10, BF 1) — English /best/<slug>-black-friday-deals twins for the
// Black Friday GAds campaigns (lib/bf-twin.ts). Unset (default) → no twin route anywhere; the
// site is byte-identical to before. Plan: AMZ_AFF/Docs_MD/BF_PAGES_PLAN_v0_1_2026_11_10.md
// Also ON in Vercel PREVIEW deployments (never production), so a PR preview can be checked
// as Googlebot/AdsBot without any Vercel env change. Twins are noindex either way.
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || '';
export const BF_TWINS_ENABLED = process.env.NEXT_PUBLIC_BF_TWINS === '1' || VERCEL_ENV === 'preview';
