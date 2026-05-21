'use client';
// ============================================
// BackToTopLink.tsx — geo-aware /best/[slug] back-to-top anchor (GEOS1)
// ============================================
// Created: 2026-05-21
//
// Renders "↑ Back to Top 10 {keyword} in {geoName}" with `geoName` swapped
// based on the visitor's tw_geo cookie.
//
// Client-only swap (same reasoning as FooterTagline): /best/[slug] has
// revalidate=86400, so SSR HTML is cached for 24h. Reading the cookie
// server-side would bake one visitor's country into the cached output for
// everyone. Default "United Arab Emirates" stays in the cached HTML; client
// JS personalizes post-hydration.
//
// AE visitors: default matches → no setState → no re-render.
// Non-AE visitors: one DOM text update.
// Bots: no cookie → no swap → indexed text matches today.
// ============================================

import { useEffect, useState } from 'react';
import { getGeoConfig, GEO_COOKIE_NAME } from '@/lib/geo-config';

// Matches geo-config.ts COUNTRY_NAMES['AE'].backToTopGeo — keep in sync.
const DEFAULT_GEO = 'United Arab Emirates';

interface BackToTopLinkProps {
  /** Keyword already passed through toTitleCase() server-side. */
  keyword: string;
}

export default function BackToTopLink({ keyword }: BackToTopLinkProps) {
  const [geoName, setGeoName] = useState(DEFAULT_GEO);

  useEffect(() => {
    const pattern = new RegExp(`(?:^|;\\s*)${GEO_COOKIE_NAME}=([A-Z]{2})`, 'i');
    const match = document.cookie.match(pattern);
    if (!match) return;
    const name = getGeoConfig(match[1]).backToTopGeo;
    if (name !== DEFAULT_GEO) {
      setGeoName(name);
    }
  }, []);

  return (
    <a
      href="#top"
      className="text-blue-600 hover:text-blue-800 hover:underline text-lg font-semibold"
    >
      ↑ Back to Top 10 {keyword} in {geoName}
    </a>
  );
}
