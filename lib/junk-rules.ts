// ============================================
// Junk / bot rules — LOADER for public.junk_traffic_rules (server only)
// ============================================
// Created: 2026-10-22. The ONE place rule values live is the Supabase table
// public.junk_traffic_rules; matching logic is lib/junk-traffic.ts; full docs:
// docs/JUNK_TRAFFIC_RULES.md.
//
// Load / cost:
//   - enabled rules are read once per server instance, then kept in memory for
//     RULES_TTL_MS (10 min). A rule edit in Supabase is live within ≤10 min.
//     That is ~1 tiny read per instance per 10 min — not one per visit.
//   - concurrent callers share one in-flight read.
//
// Failure = fail-OPEN (never blocks money):
//   - read error / timeout → keep serving the last good list if we have one;
//     with no good list yet → NO rules → every visitor is tracked as normal.
//   - logged loudly ([junk-rules]) so it shows in Vercel logs.
// ============================================

// Server only: uses the service-role key. Never import this from a client component.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { JunkRule } from '@/lib/junk-traffic';

const RULES_TTL_MS = 10 * 60 * 1000;
const READ_TIMEOUT_MS = 2000;

let _client: SupabaseClient | null = null;
let _rules: JunkRule[] | null = null;
let _expires = 0;
let _inflight: Promise<JunkRule[]> | null = null;

function client(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

async function readRules(): Promise<JunkRule[]> {
  const sb = client();
  if (!sb) throw new Error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const { data, error } = await sb
    .from('junk_traffic_rules')
    .select('id, applies_to, kind, value')
    .eq('enabled', true)
    .order('id', { ascending: true })
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));
  if (error) throw new Error(error.message);
  return (data || []) as JunkRule[];
}

/** Enabled rules from public.junk_traffic_rules (cached ≤10 min, fail-open). */
export async function getJunkRules(): Promise<JunkRule[]> {
  if (_rules && Date.now() < _expires) return _rules;
  if (!_inflight) {
    _inflight = readRules()
      .then(rules => {
        _rules = rules;
        _expires = Date.now() + RULES_TTL_MS;
        return rules;
      })
      .catch(err => {
        console.error('[junk-rules] read failed — fail-open (tracking everyone):', err?.message || err);
        // Retry in 1 min rather than on every request; keep the last good list.
        _expires = Date.now() + 60 * 1000;
        _rules = _rules || [];
        return _rules;
      })
      .finally(() => { _inflight = null; });
  }
  return _inflight;
}

/** UA substrings of the single-part 'bot' ua_contains rules — for the admin
 *  panel's sessions list, which excludes old rows written before a rule existed. */
export function botUaSubstrings(rules: JunkRule[]): string[] {
  return rules
    .filter(r => r.applies_to === 'bot' && r.kind === 'ua_contains' && !r.value.includes('&&'))
    .map(r => r.value);
}
