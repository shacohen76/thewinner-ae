'use client';
// ============================================
// LayoutShell.tsx — Pathname-aware shell dispatcher
// ============================================
// Created: 2026-05-26
// Lives inside app/layout.tsx (root) and decides which "shell" wraps the
// page based on the URL:
//
//   /review/[program]/...  → ReviewHeader + main + ReviewFooter
//   everything else        → Header + main + Footer + CookieConsent
//                            (= byte-identical to pre-change layout output)
//
// Why a separate dispatcher instead of conditional logic in the root
// layout: root layout is a server component and reading the pathname
// there requires `headers()`, which would make the layout dynamic and
// break ISR on /best/[slug] (revalidate=86400). A tiny client component
// using usePathname() picks the shell at hydration with no SSR cost —
// the SSR output for the default branch is identical to today.
//
// Safety: if the regex match fails for any reason, we fall through to
// the default branch. /review/* URLs are the ONLY ones that take the
// alternate branch — every other path on the site renders unchanged.
// ============================================

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import ReviewHeader from '@/components/review/ReviewHeader';
import ReviewFooter from '@/components/review/ReviewFooter';
import { isReviewProgram } from '@/components/review/program-display';

// Captures `ca` from `/review/ca/jbl-speakers` (and any deeper path).
const REVIEW_PATH_RE = /^\/review\/([a-z]+)(?:\/|$)/;

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname?.match(REVIEW_PATH_RE);
  const program = match?.[1];

  // Belt + suspenders: only take the review branch when the captured
  // program key is a real review program. Anything else (typos, the
  // excluded 'ae', future bad URLs) falls through to the normal shell,
  // and the page itself returns notFound() via dynamicParams=false.
  if (program && isReviewProgram(program)) {
    return (
      <>
        <ReviewHeader program={program} />
        <main className="flex-grow">{children}</main>
        <ReviewFooter program={program} />
        {/* CookieConsent kept on /review/* for GDPR/CCPA compliance (Decision 140
            in AM1_DECISIONS_LOG_v1_8.md). GTM still loads via root layout, so
            non-essential tracking happens on review pages too — banner is
            legally required for non-Gulf visitors. */}
        <CookieConsent />
      </>
    );
  }

  // Default branch — identical to the previous root-layout render tree.
  return (
    <>
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
      <CookieConsent />
    </>
  );
}
