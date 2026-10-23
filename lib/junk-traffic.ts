// ============================================
// Junk / bot traffic — rule MATCHING (pure, no rule values in code)
// ============================================
// v1.0 2026-10-05: obvious-junk DIRECT visits get no user id / click_log row.
// v2.0 2026-10-22 (owner: "exactly ONE place for these rules, clear + documented"):
//   every rule VALUE now lives in ONE Supabase table, public.junk_traffic_rules.
//   This file holds only the matching logic; lib/junk-rules.ts loads the table.
//   Adding / removing a rule = one row in that table, no PR, no deploy
//   (effective within the 10-min cache in lib/junk-rules.ts).
//
//   FULL DOCUMENTATION: docs/JUNK_TRAFFIC_RULES.md (what each rule does, how to
//   add/disable one, what is deliberately NOT in the table, rollback).
//
// Two kinds of rules (column applies_to):
//   'bot'          → the visitor is a bot. /api/tag-assign writes NO click_log row,
//                    ever (any traffic source, also with a gclid — e.g. AdsBot).
//                    The admin panel also excludes old rows that match.
//   'direct_junk'  → only for a DIRECT visit (no referrer, no gclid/fbclid, no
//                    campaign param). No click_log row / user_id is written at
//                    landing; IF the visitor clicks a product, the session is
//                    created right then (a real buyer's click is never lost).
//
// Fixed SAFETY INVARIANTS (in code on purpose — they are not junk rules):
//   - no user-agent at all            → bot (route.ts)
//   - gads / gclid traffic            → ALWAYS persisted (lib/tracking.ts shouldPersist)
//   - a clickout (clicked_asin)       → ALWAYS persisted (route.ts)
//   - table unreadable                → NO rules apply = everyone is tracked
//                                       (fail-open: junk slips through, money never lost)
//
// This file is imported by the browser (TrackingProvider) too, so it must stay
// free of server-only imports (no Supabase client here).
// ============================================

import { isProgramCountry } from '@/lib/geo-config';

/** Session cookie: "this visit was judged direct_junk". Set/cleared ONLY by
 *  /api/tag-assign. Read by the layout (skips GTM/GA4 on the following pages)
 *  and by TrackingProvider. */
export const NO_TRACK_COOKIE = 'tw_nt';

/** URL params that mean the visit came from a campaign/ad → never direct_junk. */
export const CAMPAIGN_PARAMS = [
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_sub',
];

export function hasCampaignParam(params: URLSearchParams): boolean {
  return CAMPAIGN_PARAMS.some(p => params.has(p));
}

/** One row of public.junk_traffic_rules (only the columns the code needs). */
export interface JunkRule {
  id: number;
  applies_to: 'bot' | 'direct_junk';
  /**
   * ua_contains          value = text the user-agent must contain (case-sensitive).
   *                      Several parts joined with ' && ' must ALL be present.
   * asn                  value = AS number (x-vercel-ip-as-number), e.g. '132203'.
   * not_program_country  value = '*'. Country is known and is not one of our
   *                      Amazon program countries (lib/geo-config).
   * desktop_chrome_below value = Chrome major, e.g. '140'. Desktop (non-mobile)
   *                      Chrome/Edge older than this.
   */
  kind: 'ua_contains' | 'asn' | 'not_program_country' | 'desktop_chrome_below';
  value: string;
}

export interface VisitFacts {
  userAgent: string | null;
  country: string | null;
  asNumber: number | null;
}

function isMobileUA(ua: string): boolean {
  return /mobile|android|iphone|ipad/i.test(ua);
}

function chromeMajor(ua: string): number | null {
  const m = ua.match(/Chrome\/(\d+)\./);
  return m ? parseInt(m[1], 10) : null;
}

/** Does this single rule match the visit? Unknown kinds never match. */
export function ruleMatches(rule: JunkRule, v: VisitFacts): boolean {
  const ua = v.userAgent || '';
  switch (rule.kind) {
    case 'ua_contains': {
      const parts = rule.value.split('&&').map(p => p.trim()).filter(Boolean);
      return parts.length > 0 && parts.every(p => ua.includes(p));
    }
    case 'asn':
      return v.asNumber !== null && String(v.asNumber) === rule.value.trim();
    case 'not_program_country':
      return !!v.country && !isProgramCountry(v.country);
    case 'desktop_chrome_below': {
      const below = parseInt(rule.value, 10);
      if (!Number.isFinite(below) || isMobileUA(ua)) return false;
      const major = chromeMajor(ua);
      return major !== null && major < below;
    }
    default:
      return false;
  }
}

/** First matching rule of the given kind (applies_to), or null. */
export function findRule(
  rules: JunkRule[],
  appliesTo: JunkRule['applies_to'],
  v: VisitFacts,
): JunkRule | null {
  return rules.find(r => r.applies_to === appliesTo && ruleMatches(r, v)) || null;
}
