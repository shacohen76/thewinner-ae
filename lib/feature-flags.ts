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
