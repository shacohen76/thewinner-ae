'use client';
// ============================================
// ReviewFooter.tsx — Geo-aware footer for /review/* pages
// ============================================
// Created: 2026-05-26
// Visual variant of components/Footer.tsx with the country and program
// information baked in server-side. Used by LayoutShell when the URL
// matches /review/[program]/*. Marked 'use client' so LayoutShell (also
// client) can import it; no actual client interactivity inside.
//
// Differences from live Footer:
//   - Tagline says "...comparison site for {Country}." with the country
//     baked into the rendered HTML — no FooterTagline client-swap
//   - Disclosure paragraph names the specific Amazon Associates program
//     (e.g., "Amazon Associates Canada") and the affiliate domain
//   - Copyright line shows "{Country} Edition" so the geo is unmissable
//     even at the very bottom of the page source
//   - No CookieSettingsLink (review pages are utility pages; the live
//     CookieConsent still renders site-wide via the root layout)
//   - No Popular / Categories link list — reduces clickable paths off
//     the review page; reviewer focus stays on the product cards
// ============================================

import { Link } from '@/i18n/navigation';
import { CONFIG, getCurrentYear } from '@/lib/utils';
import { getGeoConfig, getProgramConfig } from '@/lib/geo-config';
import type { GeoProgram } from '@/lib/geo-config';
import { PROGRAM_FLAG, PROGRAM_COUNTRY_CODE } from './program-display';

interface ReviewFooterProps {
  program: Exclude<GeoProgram, 'ae'>;
}

export default function ReviewFooter({ program }: ReviewFooterProps) {
  const cfg = getProgramConfig(program);
  const names = getGeoConfig(PROGRAM_COUNTRY_CODE[program]);
  const flag = PROGRAM_FLAG[program];

  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand + country */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl">
                🏆
              </div>
              <div className="font-bold text-white text-lg">{CONFIG.siteName}</div>
            </div>
            <p className="text-sm text-gray-400">
              The leading product comparison site for {names.countryName}. We help you find the perfect product.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1 text-xs">
              <span>{flag}</span>
              <span className="font-semibold text-white">{names.backToTopGeo} Edition</span>
            </div>
          </div>

          {/* Program details */}
          <div>
            <h4 className="font-bold text-white mb-4">Amazon program</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-gray-400">Marketplace:</span>{' '}
                <code className="bg-gray-700 px-2 py-0.5 rounded font-mono text-white">{cfg.amazonDomain}</code>
              </li>
              <li>
                <span className="text-gray-400">Country served:</span>{' '}
                <span className="text-white font-medium">{names.backToTopGeo}</span>
              </li>
            </ul>
          </div>

          {/* Info — kept minimal */}
          <div>
            <h4 className="font-bold text-white mb-4">Info</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Amazon Associates disclosure (geo-specific) */}
        <div className="border-t border-gray-700 pt-8">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-2">
              Disclosure: We work with premium partners to ensure great results for our users.
              We may receive a commission separately and never on the behalf of our users.
              As an Amazon Associates participant for {names.backToTopGeo} ({cfg.amazonDomain}), we earn from qualifying purchases.
              Loyalty and trust above all, always.
            </p>
            <p className="text-xs text-gray-600 mt-4">
              © {getCurrentYear()} {CONFIG.siteName} — {names.backToTopGeo} Edition. All rights reserved.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
