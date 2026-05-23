'use client';
// ============================================
// CookieSettingsLink.tsx — Footer link to re-open the cookie consent banner
// ============================================
// Created: 2026-05-23 (GEOS1 — GDPR Art. 7(3) "right to withdraw consent at
// any time" requires this re-open mechanism for visitors who previously
// chose Accept or Reject.)
//
// Dispatches a custom event that CookieConsent.tsx listens for. Kept as a
// tiny client component so the parent Footer can stay a server component.
// ============================================

export default function CookieSettingsLink() {
  const reopen = () => {
    window.dispatchEvent(new CustomEvent('tw:open-cookie-settings'));
  };

  return (
    <button
      type="button"
      onClick={reopen}
      className="hover:text-white transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
    >
      Cookie Settings
    </button>
  );
}
