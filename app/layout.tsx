// ============================================
// Root layout (passthrough) — INTL1 Phase 1 (Increment B)
// ============================================
// Created: 2026-03-19 — Restructured: 2026-05-30 (INTL1 Phase 1, [locale] tree)
//
// The real document shell (<html>/<body>, metadata, GTM, JSON-LD, TrackingProvider,
// LayoutShell) moved DOWN into app/[locale]/layout.tsx so those can depend on the
// active locale. Next.js still requires a layout at the app/ root, so this file
// stays — but it is intentionally a PASSTHROUGH that just returns children.
//
// WHY A PASSTHROUGH (the standard next-intl App-Router pattern):
//   • Matched routes render through app/[locale]/layout.tsx, which supplies the
//     <html>/<body>. The root layout therefore must NOT also emit <html>/<body>
//     (doing so would nest two documents).
//   • The one render path that does NOT go through [locale] is the GLOBAL
//     not-found (app/not-found.tsx) — an unmatched/invalid-locale URL. That file
//     carries its OWN <html>/<body> precisely because this root no longer does.
//
// Do not add markup here. Locale-specific shell belongs in [locale]/layout.tsx;
// the global 404 shell belongs in app/not-found.tsx.
// ============================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
