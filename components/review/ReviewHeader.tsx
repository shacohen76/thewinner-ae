'use client';
// ============================================
// ReviewHeader.tsx — Geo-aware header for /review/* pages
// ============================================
// Created: 2026-05-26
// Visual variant of components/Header.tsx with the geo baked in. Used
// by LayoutShell when the URL matches /review/[program]/*. Marked
// 'use client' purely so LayoutShell (also client) can import it — there
// is no actual client interactivity inside; renders static markup.
//
// Differences from live Header:
//   - No mobile menu (no useState needed) — static page audience
//   - No category dropdown — review pages are standalone
//   - Adds a "🇨🇦 Canada" chip next to the logo so the geo is obvious
//     even on the source view that Amazon's reviewer reads
//   - Tagline reads "Reviews for {Country}" (server-rendered, no swap)
// ============================================

import Link from 'next/link';
import { CONFIG } from '@/lib/utils';
import { getGeoConfig, getProgramConfig } from '@/lib/geo-config';
import type { GeoProgram } from '@/lib/geo-config';
import { PROGRAM_FLAG, PROGRAM_COUNTRY_CODE } from './program-display';

interface ReviewHeaderProps {
  program: Exclude<GeoProgram, 'ae'>;
}

export default function ReviewHeader({ program }: ReviewHeaderProps) {
  const cfg = getProgramConfig(program);
  const names = getGeoConfig(PROGRAM_COUNTRY_CODE[program]);
  const flag = PROGRAM_FLAG[program];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Logo + geo chip */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-md">
                🏆
              </div>
              <div>
                <div className="font-bold text-gray-800 text-lg">{CONFIG.siteName}</div>
                <div className="text-xs text-gray-500">
                  Reviews for {names.countryName}
                </div>
              </div>
            </Link>

            {/* Geo chip — server-rendered, visible in source */}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm">
              <span className="text-lg leading-none">{flag}</span>
              <span className="font-semibold text-blue-800">{names.backToTopGeo}</span>
              <span className="text-blue-400">·</span>
              <code className="text-xs text-blue-700 font-mono">{cfg.amazonDomain}</code>
            </div>
          </div>

          {/* Right side: minimal nav back to main site */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/about" className="text-gray-600 hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-gray-600 hover:text-blue-600 transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
