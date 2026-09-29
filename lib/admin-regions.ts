// ============================================
// Admin dashboard regions — /admin/tracking ONLY
// ============================================
// 2026-09-29 (owner): the old 3 cards (Gulf / Europe / "International") mixed our
// real markets with world-wide fallback traffic (mostly bots/scrapers since the
// business moved to paid). The dashboard now shows CLEAN program regions plus one
// "non-program" bucket that measures that noise.
//
//   gulf     = ae, sa                    (+ BH/KW/OM/QA → ae)
//   europe   = uk de fr it es nl se ie be pl  (+ neighbours routed to them, e.g. PT → es)
//   americas = us ca br
//   apac     = jp au sg                  (+ KR → jp, NZ → au, SE-Asia → sg)
//   other    = NOT a program country (reaches amazon.com only via the 'us' fallback)
//
// DISPLAY ONLY — lib/geo-config.ts GeoGroup / routing / tag assignment are untouched.
// ============================================

import {
  getGeoProgram,
  isProgramCountry,
  PROGRAM_COUNTRY_CODES,
  type GeoProgram,
} from '@/lib/geo-config';

export type AdminRegion = 'gulf' | 'europe' | 'americas' | 'apac' | 'other';

export const ADMIN_REGIONS: AdminRegion[] = ['gulf', 'europe', 'americas', 'apac', 'other'];

const PROGRAM_REGION: Record<GeoProgram, Exclude<AdminRegion, 'other'>> = {
  ae: 'gulf', sa: 'gulf',
  uk: 'europe', de: 'europe', fr: 'europe', it: 'europe', es: 'europe',
  nl: 'europe', se: 'europe', ie: 'europe', be: 'europe', pl: 'europe',
  us: 'americas', ca: 'americas', br: 'americas',
  jp: 'apac', au: 'apac', sg: 'apac',
};

/** Region of a country for the admin dashboard. Null/unknown/non-program → 'other'. */
export function adminRegionOf(countryCode: string | null | undefined): AdminRegion {
  if (!countryCode || !isProgramCountry(countryCode)) return 'other';
  return PROGRAM_REGION[getGeoProgram(countryCode)];
}

/** Country codes of one program region (for DB-side .in() filters). */
export function regionCountries(region: Exclude<AdminRegion, 'other'>): string[] {
  return PROGRAM_COUNTRY_CODES.filter((cc) => adminRegionOf(cc) === region);
}
