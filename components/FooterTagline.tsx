'use client';
// ============================================
// FooterTagline.tsx — geo-aware footer tagline (GEOS1)
// ============================================
// Created: 2026-05-21
//
// Tiny client-only component that swaps the country name in the footer.
//
// Why a client component (not server-side cookie read):
// The Footer is rendered inside app/layout.tsx, which wraps cached pages
// (e.g. /best/[slug] with revalidate=86400). A server-side cookie read here
// would bake one visitor's country into the cached HTML for everyone else.
// Keeping this client-side means the SSR / cached output always renders the
// default "the UAE" — visitors swap to their geo's name post-hydration.
//
// FOUC: ~50-100ms where a non-Gulf visitor briefly sees "the UAE" before
// the swap (same pattern as TrackingProvider's link rewrite). SEO is safe
// — bots get no cookie (middleware skips), so Googlebot's WRS reads the
// cached UAE text unchanged.
//
// Performance: AE-cookied visitors get no setState (default already matches)
// → no re-render. Only non-AE visitors trigger one DOM text update.
// ============================================

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getGeoConfig, GEO_COOKIE_NAME } from '@/lib/geo-config';

// Matches the Gulf default countryName for AE — keep in sync with
// geo-config.ts COUNTRY_NAMES['AE'].countryName.
const DEFAULT_NAME = 'the UAE';

export default function FooterTagline() {
  const locale = useLocale();
  const t = useTranslations('Footer');
  const [countryName, setCountryName] = useState(DEFAULT_NAME);

  useEffect(() => {
    // Read tw_geo cookie set by middleware (only present when GEOS1_ENABLED).
    // Cookie absent (GEOS1 off, bot path, local dev) → no swap, default stays.
    const pattern = new RegExp(`(?:^|;\\s*)${GEO_COOKIE_NAME}=([A-Z]{2})`, 'i');
    const match = document.cookie.match(pattern);
    if (!match) return;
    const name = getGeoConfig(match[1]).countryName;
    if (name !== DEFAULT_NAME) {
      setCountryName(name);
    }
  }, []);

  // Localized (non-English) locales: fixed translated tagline. geo-config country
  // names are English-only, so we don't inject a dynamic country here. The English
  // path below is unchanged. INTL1 JP Phase 2 (2026-07-06): was ar-only → any non-en.
  if (locale !== 'en') {
    return <p className="text-sm text-gray-400">{t('tagline')}</p>;
  }

  return (
    <p className="text-sm text-gray-400">
      The leading product comparison site for {countryName}. We help you find the perfect product.
    </p>
  );
}
