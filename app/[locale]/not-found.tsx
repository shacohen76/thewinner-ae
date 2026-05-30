// ============================================
// In-locale 404 — INTL1 Phase 1 (Increment B)
// ============================================
// Created: 2026-03-19 — Moved: 2026-05-30 (into app/[locale]/)
//
// Catches notFound() raised INSIDE a locale tree (e.g. /best/<unknown-slug>).
// It renders through app/[locale]/layout.tsx, so it inherits the full document
// shell + Header/Footer chrome — UI only, no <html>/<body> here.
//
// The sibling GLOBAL fallback at app/not-found.tsx (own <html>/<body>) handles
// URLs that match NO locale at all; this one handles 404s within a valid locale.
// Content is byte-identical to the pre-restructure app/not-found.tsx.
// ============================================

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
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
          Back to Home
        </Link>
      </div>
    </div>
  );
}
