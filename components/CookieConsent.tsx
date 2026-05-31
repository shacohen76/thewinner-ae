'use client';
// ============================================
// CookieConsent.tsx — Geo-aware GDPR/CCPA consent banner
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-05-23 (GEOS1 — geo-aware: only shown to non-Gulf
//                            visitors; equal Reject All / Accept All buttons;
//                            integrates with Google Consent Mode v2 set in
//                            app/layout.tsx default-denied state.)
//
// Behavior matrix:
//   - Gulf visitor (or no tw_geo cookie / GEOS1 disabled / local dev):
//     → banner does NOT show
//     → consent auto-granted on mount (Gulf UX unchanged from pre-GDPR)
//   - Non-Gulf visitor, no previous decision:
//     → banner SHOWS with Accept All / Reject All
//     → consent stays denied until they click
//   - Non-Gulf visitor, previously accepted:
//     → banner does NOT show
//     → consent granted on mount
//   - Non-Gulf visitor, previously declined:
//     → banner does NOT show
//     → consent stays denied
//
// Re-opening: Footer.tsx dispatches a 'tw:open-cookie-settings' CustomEvent
// (triggered by the new "Cookie Settings" footer link). We listen for it
// and re-show the banner regardless of previous state, so users can change
// their mind (GDPR Art. 7(3) right to withdraw consent at any time).
// ============================================

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { getGeoGroup, GEO_COOKIE_NAME } from '@/lib/geo-config';

const STORAGE_KEY = 'cookie-consent';
type Choice = 'accepted' | 'declined';

// HOTFIX 2026-05-23: Consent Mode v2 default-denied was removed from
// layout.tsx after starving GA4. updateConsent is kept as a no-op so the
// banner UI still works — choice still saved to localStorage. Re-enable
// the dataLayer push once GTM's GA4 tag is verified Consent-Mode-v2
// compliant AND we use proper gtag() function call (not raw array push).
// See AM1 decisions log entry GEOS1-HOTFIX-1.
function updateConsent(_granted: boolean): void {
  // intentionally no-op pending Consent Mode v2 re-integration
}

function readGeoCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const pattern = new RegExp(`(?:^|;\\s*)${GEO_COOKIE_NAME}=([A-Z]{2})`, 'i');
  const match = document.cookie.match(pattern);
  return match ? match[1].toUpperCase() : null;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const geo = readGeoCookie();
    // No cookie (Gulf catch-all, GEOS1 disabled, local dev) → treat as Gulf.
    const group = geo ? getGeoGroup(geo) : 'gulf';
    const savedChoice = localStorage.getItem(STORAGE_KEY) as Choice | null;

    if (group === 'gulf') {
      // Gulf or unknown → auto-grant consent (no banner). Pre-GDPR behavior
      // preserved for our primary audience.
      updateConsent(true);
      return;
    }

    // Non-Gulf visitor — respect previous choice if any
    if (savedChoice === 'accepted') {
      updateConsent(true);
      return;
    }
    if (savedChoice === 'declined') {
      // Stay denied (default from layout.tsx). Don't show banner.
      return;
    }

    // Non-Gulf, no decision yet → show banner
    setIsVisible(true);
  }, []);

  // Footer "Cookie Settings" link dispatches this event to re-open the banner
  // so users can change their previous choice at any time.
  useEffect(() => {
    const reopen = () => setIsVisible(true);
    window.addEventListener('tw:open-cookie-settings', reopen);
    return () => window.removeEventListener('tw:open-cookie-settings', reopen);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    updateConsent(true);
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    updateConsent(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-300 text-center md:text-start max-w-2xl">
          We use cookies to understand how visitors use our site and to measure our marketing. Choose your preference below — you can change it later from the footer.{' '}
          <Link href="/privacy" className="underline hover:text-white whitespace-nowrap">
            Privacy Policy
          </Link>
          .
        </p>
        {/* GDPR: Reject All and Accept All must have equal visual prominence
            (CNIL ruling). Both rendered with identical styling. */}
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Reject All
          </button>
          <button
            onClick={handleAccept}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
