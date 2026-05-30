// ============================================
// Global not-found — INTL1 Phase 1 (Increment B)
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — [locale] tree restructure)
//
// This is the GLOBAL 404. It renders for URLs that do NOT resolve to any
// configured locale tree (and for notFound() raised above the [locale] layer,
// e.g. an invalid /xx/ locale prefix). Because the root app/layout.tsx is now a
// passthrough and the <html>/<body> live in app/[locale]/layout.tsx, this file
// is OUTSIDE that tree and so MUST supply its own <html>/<body> — otherwise the
// 404 would render with no document shell.
//
// In-locale 404s (a valid locale, unknown slug) are handled by the chrome-wrapped
// app/[locale]/not-found.tsx instead; this global one is intentionally minimal
// and self-contained (it cannot rely on TrackingProvider/LayoutShell, which live
// in the [locale] layout).
// ============================================

import Link from 'next/link';
import { CONFIG } from '@/lib/utils';
import '@/styles/globals.css';

export default function GlobalNotFound() {
  return (
    <html lang="en-AE" dir="ltr">
      <body className="bg-gray-50 min-h-screen flex flex-col overflow-x-hidden">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center px-4">
            <div className="text-8xl mb-6">🔍</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h1>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Back to {CONFIG.siteName}
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
