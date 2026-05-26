// ============================================
// CountryBand.tsx — Geo indicator strip for /review/* pages
// ============================================
// Created: 2026-05-26
// Renders an unmissable "🇨🇦 Canada Edition — amazon.ca" band just below
// the header. Tells the Amazon reviewer at a glance which program they
// are looking at. Server-rendered, no client JS.
// ============================================

import type { GeoProgram } from '@/lib/geo-config';
import { getGeoConfig, getProgramConfig } from '@/lib/geo-config';
import { PROGRAM_FLAG, PROGRAM_COUNTRY_CODE } from './program-display';

interface CountryBandProps {
  program: Exclude<GeoProgram, 'ae'>;
}

export default function CountryBand({ program }: CountryBandProps) {
  const cfg = getProgramConfig(program);
  const names = getGeoConfig(PROGRAM_COUNTRY_CODE[program]);
  const flag = PROGRAM_FLAG[program];

  return (
    <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white py-3 shadow-md">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-3 flex-wrap text-center">
        <span className="text-2xl">{flag}</span>
        <span className="font-bold text-base md:text-lg">
          {names.backToTopGeo} Edition
        </span>
        <span className="text-blue-200 hidden md:inline">|</span>
        <span className="text-blue-100 text-sm md:text-base">
          Affiliate program: <code className="bg-blue-900/50 px-2 py-0.5 rounded font-mono">{cfg.amazonDomain}</code>
        </span>
      </div>
    </div>
  );
}
