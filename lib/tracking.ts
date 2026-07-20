// ============================================
// TRACKING UTILITIES — Server-side tag rotation
// ============================================
// Created: 2026-03-27
// Last Modified: 2026-07-02 (tag-pool cron silent-write guard)
//
// Handles tag assignment, click logging, tag expiry, and pool maintenance.
//
// Changelog
//   2026-03-27  v1   Initial: assignTag (LRU rotation), logAsinClick, releaseExpiredTags
//   2026-05-19  v2   AMZ12 — Stable-first attribution overhaul:
//                    - TRACKING_CONFIG: added seedingCohortSize (5), poolLowThreshold (20),
//                      asinHoldHours (24).
//                    - sendTelegram() helper for cron alerts.
//                    - assignTag() Step 1 now filters to is_stable OR seeding_cohort
//                      and orders is_stable DESC so stables are picked first.
//                      Step 2 (steal-oldest-busy) unchanged — still the burst safety net.
//                    - logAsinClick() now extends tag_pool.expires_at to now+24h
//                      WHEN AND ONLY WHEN the held tag is_stable=true. Cohort/reserve
//                      tags keep their 4h hold so they keep rotating and graduate.
//                    - maintainTagPool() new fn: promotes ≥4-order tags to stable,
//                      graduates stable cohort members, tops up cohort to size 5,
//                      Telegram-alerts when reserve pool < 20. Called by the new
//                      /api/cron/maintain-tag-pool cron every 15 min.
//   2026-07-05  v4   Tag-pool mechanics V2 (Decision 157) — flag-gated, OFF by default.
//                    Reads program_pool_config (per-program tuning + mechanics_v2 flag).
//                    When the flag is TRUE for the program, the AE gads path switches to
//                    the 1-to-1 daily-attribution model:
//                    - assignTag: soft-hold-on-assignment (soft_hold_minutes, not 4h) +
//                      new priority (free stable LRU → free warming by last_clickout_at →
//                      pull reserve into warming → steal oldest NON-committed busy).
//                      Committed stables (is_stable AND clicked out within stable_pin) are
//                      NEVER stolen — this kills the 814-orders-on-38-tags concentration.
//                    - logAsinClick: commit-on-clickout — pin stable→stable_pin_hours,
//                      warming→warming_pin_minutes, and stamp tag_pool.last_clickout_at
//                      (the only visible warming-progress signal).
//                    - maintainTagPool: dynamic warming target W = (K−S)/m where K =
//                      live daily clickouts, S = stable count (auto-scales with spend).
//                    When the flag is FALSE (default) every path is byte-identical to v3.
//                    See Docs_MD/tagpool_mechanics_impl_handoff.md + TAGPOOL_ATTRIBUTION_SPEC_v1_0.md.
//   2026-07-02  v3   Tag-pool cohort-cycling freeze fix. Root cause was NOT code:
//                    the cron ran with a non-service_role key, so under RLS every
//                    pool UPDATE silently no-op'd (0 rows, HTTP 200, no .error) —
//                    promote/graduate/top-up never persisted. Hardening added:
//                    - decodeKeyRole() guard: bail + Telegram CRITICAL if the key
//                      is not service_role (the real, reliable signal).
//                    - .error checked on every step, collected into errors[] and
//                      Telegram-alerted (JS client returns errors in-band, never throws).
//                    - silent-no-op canary on cohort top-up.
//                    - steps 1 & 2 scoped to program='ae' + gads (MULTIGEO invariant).
//                    - seedingCohortSize default 5 → 25 (right-size for traffic).
//                    Fix itself is a Vercel env correction. See tag_pool_cohort_fix_handoff.md.
//
// Tightly coupled tables: public.tag_pool (with new columns is_stable, seeding_cohort)
//                         public.click_log (sessions + ASIN clicks)
//                         public.amazon_purchase_snapshot (read-only, for is_stable promotion)
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getGeoConfig, getProgramConfig, GeoGroup, GeoProgram, AmazonDomain } from './geo-config';
// MULTIGEO lang-split (2026-07-20): the locale list lives in the router config,
// so the static-tag language axis can never drift from the URL language axis.
import { routing } from '@/i18n/routing';

// Server-side Supabase client (uses service role key for writes to tag_pool)
// Lazy-initialized to avoid build-time errors when env vars are missing
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseAdmin;
}

// ============================================
// CONFIGURATION
// ============================================

export const TRACKING_CONFIG = {
  tagHoldHours: parseInt(process.env.TAG_HOLD_HOURS || '4'),
  defaultTag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
  gadsTagType: 'gads',
  staticTagTypes: ['seo', 'fb', 'bing', 'chatgpt', 'direct', 'other_geo', 'other'],
  // Seeding cohort size: how many unstable tags are eligible alongside stables.
  // Cohort tags are picked only when all stable tags are busy. Once a cohort
  // tag crosses the 4-order threshold (snapshot.items_ordered >= 4) it becomes
  // stable and gets replaced by the next reserve tag via maintainTagPool().
  // 2026-07-02: default bumped 5 → 25 to track current (higher) AE gads traffic
  // and let the working pool cycle up toward 200 (was starving the rotation).
  // NOTE: if SEEDING_COHORT_SIZE is set in Vercel env it OVERRIDES this default —
  // ensure it is unset (or =25) on both thewinner-ae and thewinners-ae.
  seedingCohortSize: parseInt(process.env.SEEDING_COHORT_SIZE || '25'),
  // Alert threshold: when reserve_pool (unstable, not in cohort) drops below
  // this, the maintain-tag-pool cron sends a Telegram alert asking for more
  // tags to be created in Amazon.
  poolLowThreshold: parseInt(process.env.POOL_LOW_THRESHOLD || '20'),
  // High-intent extension: when a visitor on a STABLE tag clicks an Amazon
  // product link (ASIN clickout), we extend that tag's hold so it stays
  // bound to this visitor while we wait for the order to surface in Amazon's
  // report. Rolling — each ASIN click resets the timer to now + this many
  // hours. Cohort/reserve tags are intentionally NOT extended — they need
  // to keep rotating to accumulate orders and graduate to stable.
  asinHoldHours: parseInt(process.env.ASIN_HOLD_HOURS || '24'),
};


// ============================================
// PROGRAM POOL CONFIG (mechanics V2 — Decision 157)
// ============================================
// Per-program pool tuning read from public.program_pool_config. The mechanics_v2
// flag gates ALL V2 behavior: when false (default) the pool runs exact V1 logic;
// when true, the program's gads path uses soft-hold-on-assignment + commit-on-
// clickout + dynamic warming. Config lives in the DB so tuning (holds, pins, m,
// threshold) is a SQL UPDATE with no redeploy — and the flag is a shared DB column
// so one flip covers BOTH Vercel projects at once. See tagpool_mechanics_impl_handoff.md.
//
// 2026-07-05: added for V2. Falls back to null (⇒ V1 behavior) on any read error,
// so a transient config-read failure can NEVER change AE money-path behavior.

export interface PoolConfig {
  program: string;
  marketplace: string;
  currency: string;
  visibility_threshold: number;
  soft_hold_minutes: number;
  stable_pin_hours: number;
  warming_pin_minutes: number;
  warming_target_m: number;
  tag_prefix: string;
  mechanics_v2: boolean;
  enabled: boolean;
}

// Short in-process TTL cache: assignTag is on the hot path, so avoid a config read
// per request. 30 s is well under the "watch for a day" rollout window, so a flag
// flip still takes effect within ~30 s on each warm serverless instance.
const _poolConfigCache = new Map<string, { value: PoolConfig | null; expires: number }>();
const POOL_CONFIG_TTL_MS = 30_000;

async function getPoolConfig(program: string): Promise<PoolConfig | null> {
  const cached = _poolConfigCache.get(program);
  if (cached && cached.expires > Date.now()) return cached.value;

  const { data, error } = await getSupabaseAdmin()
    .from('program_pool_config')
    .select('*')
    .eq('program', program)
    .maybeSingle();

  // On error OR missing row → null ⇒ caller runs V1 (AE-safe default). Never throw
  // on the assignment hot path over a config read.
  const value: PoolConfig | null = error || !data ? null : (data as PoolConfig);
  _poolConfigCache.set(program, { value, expires: Date.now() + POOL_CONFIG_TTL_MS });
  return value;
}


// ============================================
// TELEGRAM (used by maintain-tag-pool cron alerts)
// ============================================

async function sendTelegram(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing) — skipping alert');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send failed:', e);
    return false;
  }
}

// Decode the `role` claim from a Supabase JWT key WITHOUT verifying its signature
// (we only read the public, non-secret payload claim — never log the key itself).
// 2026-07-02: added to catch the silent misconfiguration that froze the tag pool —
// SUPABASE_SERVICE_ROLE_KEY set to a non-service_role key. Under RLS (enabled on
// tag_pool + amazon_purchase_snapshot ~2026-06-26) such a key can still READ but
// every UPDATE silently affects 0 rows and STILL returns HTTP 200 with no .error,
// so nothing persists and the failure is invisible. The key role is the reliable
// signal (checking .error does not catch an RLS-filtered no-op UPDATE).
// See Docs_MD/tag_pool_cohort_fix_handoff.md.
function decodeKeyRole(jwt: string | undefined): string {
  if (!jwt) return 'missing';
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] || '', 'base64').toString());
    return payload.role || 'unknown';
  } catch {
    return 'unparseable';
  }
}

// ============================================
// STATIC TAG RESOLUTION — program × source × language
// ============================================
// 2026-07-20 (MULTIGEO lang-split, Step 2): getStaticTag was program- AND
// language-blind — it returned one AE tag per traffic_source, and every non-AE
// program returned its single geo-config defaultTag regardless of source or
// page language. So we could not see WHICH LANGUAGE PAGES CONVERT PER GEO
// (30d before this shipped: 32,112 seo clicks collapsing into a few storetags).
// See Docs_MD/multigeo_lang_split_tags_roadmap.md.
//
// Tag convention (frozen with the user 2026-07-11):
//   twnr{program}{source}{locale}-{suffix}
//     seo               → carries the URL-folder locale (twnraeseoen-21, twnrjpseoja-22)
//     direct/chatgpt/fb → language-blind                (twnraedirect-21)
//     gads              → rotation pool / paid marker — NOT resolved here
//
// ── The 3-tier fallback chain ──
//   1. NEW convention — (program, tag_type=source, locale). seo-family only.
//   2. LEGACY tier    — (program, tag_type=source), locale ignored. Only AE has
//                       such rows today, so this is what KEEPS THE LIVE AE TAGS
//                       WORKING until the new AE rows are seeded (Step 3).
//                       Remove only after AE is migrated + verified.
//   3. STORETAG       — the program's catch-all (see storeTagFor).
//
// ── NO-OP GUARANTEE (Step 2) ──
// With zero `locale` rows seeded, tier 1 never hits. AE resolves via tier 2 to
// exactly the tags it returns today; every non-AE program has NO tag_pool rows
// at all (the pool is AE-only) so it resolves via tier 3 to exactly its current
// defaultTag. Seeding a row later flips only that one (program, source, locale)
// segment; deleting the row reverts it.

/** Sources whose tag carries a page language. Everything else is language-blind. */
const LOCALE_BEARING_SOURCES = new Set(['seo']);

/**
 * Normalize a detected traffic_source to the source used in the tag.
 * `bing` is treated as seo for tagging (agreed 2026-07-11, interim — revisit if
 * paid Bing/msclkid ever needs its own tag). Verified zero-impact: bing had
 * 0 clicks in the 30 days before this shipped.
 */
function normalizeSource(trafficSource: string): string {
  return trafficSource === 'bing' ? 'seo' : trafficSource;
}

/**
 * The program's catch-all tag (tier 3).
 * AE deliberately keeps TRACKING_CONFIG.defaultTag (env-overridable via
 * DEFAULT_TAG) so this refactor is byte-identical to the pre-Step-2 AE
 * fallback; every other program uses its geo-config storetag, which is exactly
 * what the geo-static branch returned before.
 */
function storeTagFor(program: GeoProgram): string {
  return program === 'ae'
    ? TRACKING_CONFIG.defaultTag
    : getProgramConfig(program).defaultTag;
}

/**
 * Derive the page language from the landing path. Language is a URL axis
 * (INTL1): English is prefix-less, every other locale is served under /{locale}.
 * '/ar/best/x' → 'ar' · '/ja' → 'ja' · '/best/x' → 'en'.
 * Reads i18n/routing.ts so the locale list can never drift from the router.
 */
export function deriveLocale(landingPage: string | null | undefined): string {
  if (!landingPage) return routing.defaultLocale;
  const firstSegment = landingPage.split('/')[1] || '';
  return (routing.locales as readonly string[]).includes(firstSegment)
    ? firstSegment
    : routing.defaultLocale;
}

/**
 * Resolve the static (non-rotating) tag for a visitor.
 * @param program        the visitor's Amazon program (geo axis)
 * @param trafficSource  detected source (seo/direct/chatgpt/fb/bing/other…)
 * @param locale         the page language (URL axis)
 */
async function getStaticTag(
  program: GeoProgram,
  trafficSource: string,
  locale: string
): Promise<string> {
  const source = normalizeSource(trafficSource);
  const sb = getSupabaseAdmin();

  // Tier 1 — NEW convention: the language-split row for this exact page language.
  if (LOCALE_BEARING_SOURCES.has(source)) {
    const { data } = await sb
      .from('tag_pool')
      .select('tag_id')
      .eq('program', program)
      .eq('tag_type', source)
      .eq('locale', locale)
      .order('tag_id', { ascending: true })   // deterministic if ever >1
      .limit(1)
      .maybeSingle();
    if (data?.tag_id) return data.tag_id;
  }

  // Tier 2 — LEGACY compatibility (locale ignored). AE-only rows today.
  const { data: legacy } = await sb
    .from('tag_pool')
    .select('tag_id')
    .eq('program', program)
    .eq('tag_type', source)
    .order('tag_id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (legacy?.tag_id) return legacy.tag_id;

  // Tier 3 — STORETAG.
  return storeTagFor(program);
}

// ============================================
// TAG ASSIGNMENT
// ============================================

export interface TagAssignRequest {
  gclid?: string | null;
  fbclid?: string | null;
  traffic_source: string;
  landing_page?: string | null;
  user_agent?: string | null;
  ip_country?: string | null;
  user_id?: string | null;
  site?: string | null;
  // SG-BOT Phase 0 (2026-05-27): observability for ASN-based bot triage. The
  // Chrome/145.0.0.0 ingestion filter (GEOS2 2026-05-25) catches the old swarm
  // but the new SG wave rotates across legitimate Chrome versions. Logging the
  // visitor's ASN lets us identify the actual hosting infra (likely datacenter)
  // so a precise filter can be written from real data. NO filtering here — just
  // capture. See AMZ_AFF/Docs_MD/SG_BOT_FILTER_ROADMAP.md.
  as_name?: string | null;
  as_number?: number | null;
}

export interface TagAssignResponse {
  session_id: string;
  assigned_tag: string;
  expires_at: string | null;
  // GEOS1: client uses these to (a) rewrite Amazon link hostnames to the
  // correct regional domain, (b) detect cross-geo session mismatches to
  // trigger a clean re-init (see TrackingProvider). Always populated:
  // - When GEOS1_ENABLED: derived from x-vercel-ip-country
  // - Otherwise: defaults to 'amazon.ae' / 'gulf' (pre-GEOS1 behavior)
  amazon_domain: AmazonDomain;
  geo_group: GeoGroup;
}

export async function assignTag(req: TagAssignRequest): Promise<TagAssignResponse> {
  const sessionId = crypto.randomUUID();

  // ─── GEOS1: program-static-tag branch (early return) ──────────────────
  // Routes any visitor whose program is NOT 'ae' to their program's default
  // static tag, bypassing both the AE static-tag lookup AND the gads rotation
  // pool. AE visitors (and small GCC routed to ae: BH/KW/OM/QA) fall through
  // to the existing logic (path unchanged).
  //
  // v2 (2026-05-22): generalized from europe||international check to
  // "anything-not-gulf" so newly-added programs were auto-routed via their
  // lib/geo-config.ts program config — no code change needed here.
  //
  // v3 (2026-05-27, SAUDI-PROGRAM): changed check from `group !== 'gulf'` to
  // `program !== 'ae'`. The Saudi Arabia program (sa) is in group='gulf' for
  // dashboard purposes (geographically Gulf, no cookie banner) BUT must use
  // its own static tag thewinnersa-21, not the AE rotation pool. Routing by
  // program key is more accurate: AE catch-all (ae) keeps its rotation pool;
  // every other program — Gulf or otherwise — uses its program static tag.
  // BH/KW/OM/QA still map to 'ae' in COUNTRY_PROGRAM so their behavior is
  // unchanged. The next program to get its own static tag (e.g. amazon.sa
  // gads pool later, or amazon.in) becomes a drop-in addition.
  //
  // Gated by GEOS1_ENABLED — when unset, treats everyone as Gulf (today's
  // behavior). Program resolved from x-vercel-ip-country at the edge.
  const geos1Enabled = process.env.GEOS1_ENABLED === 'true';
  if (geos1Enabled) {
    const geoConfig = getGeoConfig(req.ip_country);
    if (geoConfig.program !== 'ae') {
      // MULTIGEO lang-split (2026-07-20): was a flat `geoConfig.defaultTag` for
      // EVERY source and language. Now resolved by (program × source × locale)
      // so non-AE geos become measurable too. NO-OP until tags are seeded: the
      // pool holds no non-AE rows, so tiers 1–2 miss and tier 3 returns this
      // program's storetag — i.e. geoConfig.defaultTag, exactly as before.
      // (gads also lands here and falls through to the storetag, unchanged;
      // seeding non-AE gads rows later activates the Step-4 paid marker.)
      const assignedTag = await getStaticTag(
        geoConfig.program,
        req.traffic_source,
        deriveLocale(req.landing_page)
      );

      // Log the session — click_log still captures everything, with the
      // program-specific tag in assigned_tag. ip_country tells us the geo.
      // Non-AE gads visitors also get routed here, intentionally skipping
      // the gads rotation pool (rotation is AE-only, GCLID-attribution).
      await getSupabaseAdmin().from('click_log').insert({
        session_id: sessionId,
        gclid: req.gclid || null,
        fbclid: req.fbclid || null,
        assigned_tag: assignedTag,
        traffic_source: req.traffic_source,
        landing_page: req.landing_page || null,
        user_agent: req.user_agent || null,
        ip_country: req.ip_country || null,
        user_id: req.user_id || null,
        site: req.site || null,
        as_name: req.as_name || null,
        as_number: req.as_number ?? null,
      });

      return {
        session_id: sessionId,
        assigned_tag: assignedTag,
        expires_at: null, // geo-static tags don't expire
        amazon_domain: geoConfig.amazonDomain,
        geo_group: geoConfig.group,
      };
    }
    // geoConfig.group === 'gulf' OR ip_country missing → fall through to
    // existing logic below. Behavior identical to pre-GEOS1.
  }

  // Static sources get static tags (no rotation)
  if (TRACKING_CONFIG.staticTagTypes.includes(req.traffic_source)) {
    // MULTIGEO lang-split (2026-07-20): AE now resolves by program × source ×
    // page language. NO-OP today — no AE `locale` rows are seeded, so tier 1
    // misses and tier 2 returns the same legacy AE tag as before
    // (seo → twnraeseo01-21, direct → twnraedirect01-21, other_geo → twnraeggeo01-21).
    const staticTag = await getStaticTag(
      'ae',
      req.traffic_source,
      deriveLocale(req.landing_page)
    );

    // Log the session (even for static tags — useful for analytics)
    await getSupabaseAdmin().from('click_log').insert({
    session_id: sessionId,
    gclid: req.gclid || null,
    fbclid: req.fbclid || null,
    assigned_tag: staticTag,
    traffic_source: req.traffic_source,
    landing_page: req.landing_page || null,
    user_agent: req.user_agent || null,
    ip_country: req.ip_country || null,
    user_id: req.user_id || null,
    site: req.site || null,
    as_name: req.as_name || null,
    as_number: req.as_number ?? null,
  });

    return {
      session_id: sessionId,
      assigned_tag: staticTag,
      expires_at: null, // static tags don't expire
      amazon_domain: 'amazon.ae',
      geo_group: 'gulf',
    };
  }

  // Google Ads (and other rotating sources) — find a free tag from pool.
  //
  // 2026-07-05 (V2, Decision 157): if program_pool_config.mechanics_v2 is on for the
  // AE pool, delegate to the 1-to-1 daily-attribution assignment. Flag off (default)
  // ⇒ the V1 stable-first / steal-oldest logic below runs byte-identical. This is the
  // only gads path (all non-'ae' programs already early-returned above), so program='ae'.
  const poolConfig = await getPoolConfig('ae');
  if (poolConfig?.mechanics_v2 && poolConfig.enabled) {
    return assignGadsTagV2(req, sessionId, poolConfig);
  }

  const holdHours = TRACKING_CONFIG.tagHoldHours;
  const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString();

  // Step 1: Try to find an available tag.
  // Only tags marked `is_stable=true` (≥4 cumulative orders in Amazon's report
  // = visible) OR `seeding_cohort=true` (small actively-warmed-up bucket of
  // unseen tags) are eligible. Reserve tags sit idle until maintainTagPool()
  // rotates them into the cohort. Within the eligible set, stable tags are
  // picked first (sharp 1-to-1 attribution); cohort is fallback.
  // MULTIGEO: AE rotation pool only. `program='ae'` scopes this to the AE
  // pool so SA/other-program gads tags (added later) are never assigned to an
  // AE visitor. No-op today (all tags are program='ae'). See MULTIGEO spec.
  let { data: freeTag } = await getSupabaseAdmin()
    .from('tag_pool')
    .select('tag_id')
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('program', 'ae')
    .eq('status', 'available')
    .or('is_stable.eq.true,seeding_cohort.eq.true')
    .order('is_stable', { ascending: false })            // stable first
    .order('assigned_at', { ascending: true, nullsFirst: true })  // LRU within tier
    .limit(1)
    .single();

  // Step 2: No free tag — steal the oldest assigned one
  if (!freeTag) {
    const { data: oldestTag } = await getSupabaseAdmin()
      .from('tag_pool')
      .select('tag_id, current_session')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('program', 'ae')   // MULTIGEO: steal only from the AE pool
      .eq('status', 'busy')
      .order('assigned_at', { ascending: true })
      .limit(1)
      .single();

    if (oldestTag) {
      freeTag = { tag_id: oldestTag.tag_id };

      // Mark the old session as expired
      if (oldestTag.current_session) {
        await getSupabaseAdmin()
          .from('click_log')
          .update({ status: 'expired' })
          .eq('session_id', oldestTag.current_session);
      }
    }
  }

  // Step 3: Absolute fallback (shouldn't happen with 82 gads tags)
  const assignedTag = freeTag?.tag_id || TRACKING_CONFIG.defaultTag;

  // Step 4: Mark tag as busy
  if (freeTag) {
    await getSupabaseAdmin()
      .from('tag_pool')
      .update({
        status: 'busy',
        current_session: sessionId,
        assigned_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('tag_id', assignedTag);
  }

  // Step 5: Create click_log entry
  await getSupabaseAdmin().from('click_log').insert({
      session_id: sessionId,
      gclid: req.gclid || null,
      fbclid: req.fbclid || null,
      assigned_tag: assignedTag,
      traffic_source: req.traffic_source,
      landing_page: req.landing_page || null,
      user_agent: req.user_agent || null,
      ip_country: req.ip_country || null,
      user_id: req.user_id || null,
      site: req.site || null,
      as_name: req.as_name || null,
      as_number: req.as_number ?? null,
    });

  return {
    session_id: sessionId,
    assigned_tag: assignedTag,
    expires_at: expiresAt,
    amazon_domain: 'amazon.ae',
    geo_group: 'gulf',
  };
}

// ============================================
// GADS ASSIGNMENT — V2 mechanics (flag-gated, Decision 157)
// ============================================
// Only reached when program_pool_config.mechanics_v2 = true for AE. Implements the
// 1-to-1 daily-attribution model:
//   - Assignment gives only a SOFT hold (soft_hold_minutes). The tag is not "spent"
//     until a clickout (see logAsinClick), so no-clickout visitors free the tag fast.
//   - Priority: (1) free stable LRU  (2) free warming, preferring warmers already in
//     progress (last_clickout_at DESC) so they cross the threshold sooner  (3) pull a
//     reserve tag into the warming lane on demand  (4) steal the oldest NON-committed
//     busy tag — never a committed stable (is_stable AND clicked out within stable_pin).
// MULTIGEO: every query scoped program='ae' + tag_type='gads'.
async function assignGadsTagV2(
  req: TagAssignRequest,
  sessionId: string,
  cfg: PoolConfig,
): Promise<TagAssignResponse> {
  const sb = getSupabaseAdmin();
  const now = Date.now();
  const expiresAt = new Date(now + cfg.soft_hold_minutes * 60 * 1000).toISOString();

  // Priority 1: a free STABLE tag (LRU). Stables get first pick — one clean pin/day.
  let { data: freeTag } = await sb
    .from('tag_pool')
    .select('tag_id')
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('program', 'ae')
    .eq('status', 'available')
    .eq('is_stable', true)
    .order('assigned_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  // Priority 2: a free WARMING tag. Prefer warmers with recent clickout progress
  // (last_clickout_at DESC) so they accumulate orders and graduate sooner; LRU tie-break.
  if (!freeTag) {
    const { data } = await sb
      .from('tag_pool')
      .select('tag_id')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('program', 'ae')
      .eq('status', 'available')
      .eq('seeding_cohort', true)
      .eq('is_stable', false)
      .order('last_clickout_at', { ascending: false, nullsFirst: false })
      .order('assigned_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    freeTag = data;
  }

  // Priority 3: pull a RESERVE tag into the warming lane on demand (dynamic top-up;
  // maintainTagPool also tops warming up to W, but bursts can outrun the cron).
  if (!freeTag) {
    const { data: reserve } = await sb
      .from('tag_pool')
      .select('tag_id')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('program', 'ae')
      .eq('status', 'available')
      .eq('is_stable', false)
      .eq('seeding_cohort', false)
      .order('tag_id', { ascending: true })   // deterministic: lowest tag_id first
      .limit(1)
      .maybeSingle();
    if (reserve) {
      const { data: promoted } = await sb
        .from('tag_pool')
        .update({ seeding_cohort: true })
        .eq('tag_id', reserve.tag_id)
        .select('tag_id')
        .maybeSingle();
      freeTag = promoted || reserve;
    }
  }

  // Priority 4: steal the oldest NON-committed busy tag. A committed stable
  // (is_stable AND last_clickout_at within stable_pin_hours) is protected — this is
  // what kills the 814-orders-on-38-tags concentration. Fetch a small oldest-first
  // batch and pick the first non-committed one in JS (avoids PostgREST timestamp
  // or-filter quirks; steal is a rare safety net so the extra rows are cheap).
  if (!freeTag) {
    const committedCutoffMs = now - cfg.stable_pin_hours * 60 * 60 * 1000;
    const { data: busyTags } = await sb
      .from('tag_pool')
      .select('tag_id, current_session, is_stable, last_clickout_at')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('program', 'ae')
      .eq('status', 'busy')
      .order('assigned_at', { ascending: true })
      .limit(20);
    const victim = (busyTags || []).find(
      t => !(t.is_stable && t.last_clickout_at && new Date(t.last_clickout_at).getTime() > committedCutoffMs),
    );
    if (victim) {
      freeTag = { tag_id: victim.tag_id };
      // Expire the stolen session's click_log (it lost its tag; no attribution owed —
      // a soft-held tag with no clickout never earned an order).
      if (victim.current_session) {
        await sb.from('click_log').update({ status: 'expired' }).eq('session_id', victim.current_session);
      }
    }
  }

  // Absolute fallback (shouldn't happen — 200 gads tags in the AE pool).
  const assignedTag = freeTag?.tag_id || TRACKING_CONFIG.defaultTag;

  // Mark the tag busy with the SOFT hold. releaseExpiredTags frees it after
  // soft_hold_minutes if no clickout arrives; a clickout re-pins it (logAsinClick).
  if (freeTag) {
    await sb
      .from('tag_pool')
      .update({
        status: 'busy',
        current_session: sessionId,
        assigned_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('tag_id', assignedTag);
  }

  await sb.from('click_log').insert({
    session_id: sessionId,
    gclid: req.gclid || null,
    fbclid: req.fbclid || null,
    assigned_tag: assignedTag,
    traffic_source: req.traffic_source,
    landing_page: req.landing_page || null,
    user_agent: req.user_agent || null,
    ip_country: req.ip_country || null,
    user_id: req.user_id || null,
    site: req.site || null,
    as_name: req.as_name || null,
    as_number: req.as_number ?? null,
  });

  return {
    session_id: sessionId,
    assigned_tag: assignedTag,
    expires_at: expiresAt,
    amazon_domain: 'amazon.ae',
    geo_group: 'gulf',
  };
}

// ============================================
// CLICK LOGGING (ASIN append)
// ============================================

export async function logAsinClick(sessionId: string, asin: string): Promise<boolean> {
  // Get current clicked_asins
  const { data: session } = await getSupabaseAdmin()
    .from('click_log')
    .select('clicked_asins, click_timestamps')
    .eq('session_id', sessionId)
    .single();

  if (!session) return false;

  const currentAsins: string[] = session.clicked_asins || [];
  const currentTimestamps: string[] = session.click_timestamps || [];

  // Don't add duplicate ASINs
  if (!currentAsins.includes(asin)) {
    currentAsins.push(asin);
    currentTimestamps.push(new Date().toISOString());
  }

  // Update the session
  const { error } = await getSupabaseAdmin()
    .from('click_log')
    .update({
      clicked_asins: currentAsins,
      click_timestamps: currentTimestamps,
      last_activity: new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  const nowIso = new Date().toISOString();

  // 2026-07-05 (V2, Decision 157): commit-on-clickout. When mechanics_v2 is on, a
  // clickout is the moment a tag is "spent" — pin it (stable → stable_pin_hours,
  // warming → warming_pin_minutes) AND stamp last_clickout_at, the only visible
  // warming-progress signal (Amazon hides sub-threshold tags). Two scoped UPDATEs so
  // each tier gets its own pin. Flag off ⇒ the V1 stable-only 24h extension below runs
  // byte-identical.
  const cfg = await getPoolConfig('ae');
  if (cfg?.mechanics_v2 && cfg.enabled) {
    const sb = getSupabaseAdmin();
    const stablePinIso = new Date(Date.now() + cfg.stable_pin_hours * 60 * 60 * 1000).toISOString();
    const warmingPinIso = new Date(Date.now() + cfg.warming_pin_minutes * 60 * 1000).toISOString();
    // Stable held tag → long pin.
    await sb
      .from('tag_pool')
      .update({ expires_at: stablePinIso, last_clickout_at: nowIso })
      .eq('current_session', sessionId)
      .eq('is_stable', true)
      .gt('expires_at', nowIso);
    // Warming held tag → short pin (keeps warmers rotating while still crediting the click).
    await sb
      .from('tag_pool')
      .update({ expires_at: warmingPinIso, last_clickout_at: nowIso })
      .eq('current_session', sessionId)
      .eq('is_stable', false)
      .gt('expires_at', nowIso);
    return !error;
  }

  // ── V1 (flag off) ── High-intent attribution lock: extend the tag's hold IF and
  // ONLY IF this session currently holds a STABLE tag. Cohort/reserve tags must
  // keep rotating per their original 4h hold so they can accumulate orders
  // and graduate. The filters below make this a no-op for cohort/reserve.
  //
  //   .eq('current_session', sessionId)  → only the tag this session owns
  //   .eq('is_stable', true)             → only stable tags get extended
  //   .gt('expires_at', now)             → only still-busy tags (skip if already released)
  //
  // Rolling: each ASIN click resets expires_at to now + ASIN_HOLD_HOURS,
  // so high-engagement visitors keep the tag bound through their session.
  const asinExpiresIso = new Date(
    Date.now() + TRACKING_CONFIG.asinHoldHours * 60 * 60 * 1000
  ).toISOString();
  await getSupabaseAdmin()
    .from('tag_pool')
    .update({ expires_at: asinExpiresIso })
    .eq('current_session', sessionId)
    .eq('is_stable', true)
    .gt('expires_at', nowIso);

  return !error;
}

// ============================================
// TAG EXPIRY (called by cron)
// ============================================

// ============================================
// TAG POOL MAINTENANCE (called by cron every 15 min)
// ============================================
//   1. Promote tags that crossed 4-order threshold → is_stable=true
//   2. Graduate stable cohort members → seeding_cohort=false
//   3. Top up seeding cohort to TRACKING_CONFIG.seedingCohortSize
//   4. Alert via Telegram if reserve pool (unstable, not cohort) drops below
//      TRACKING_CONFIG.poolLowThreshold (= you need to create more tags in Amazon)
//
// Idempotent — safe to call repeatedly. Returns counts for the cron response.

export interface MaintainTagPoolResult {
  ok: boolean;              // false when a config/write problem was detected (see errors)
  key_role: string;         // decoded role of the service key — should be 'service_role'
  promoted_to_stable: number;
  graduated_from_cohort: number;
  cohort_added: number;
  cohort_removed: number;   // V2 trim: warming demoted back to reserve to converge to W
  cohort_size_now: number;
  reserve_remaining: number;
  alert_sent: boolean;
  errors: string[];         // in-band Supabase errors per step (JS client returns, never throws)
  // V2 observability (Decision 157) — present only when mechanics_v2 is on for AE.
  mechanics_v2?: boolean;
  warming_target?: number;  // W = ceil((K−S)/m)
  k_clickouts?: number;     // live daily clickouts
  s_stable?: number;        // stable count
}

export async function maintainTagPool(): Promise<MaintainTagPoolResult> {
  const sb = getSupabaseAdmin();
  const errors: string[] = [];

  // ── 0. GUARD: pool maintenance WRITES require a service_role key that bypasses RLS.
  // 2026-07-02: root cause of the cohort-cycling freeze — the cron runtime was using a
  // non-service_role key. With RLS on (tag_pool + amazon_purchase_snapshot, ~2026-06-26)
  // reads still work but every UPDATE silently affects 0 rows and returns HTTP 200 with
  // no .error, so promote/graduate/top-up never persist and the failure is invisible.
  // The key ROLE is the reliable signal. If misconfigured: alert loudly and bail — a
  // clearly-failing cron beats one that pretends to work. Fix is a Vercel env correction
  // (SUPABASE_SERVICE_ROLE_KEY on thewinner-ae AND thewinners-ae), not code.
  const keyRole = decodeKeyRole(process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log(`[maintainTagPool] key_role=${keyRole}`);
  if (keyRole !== 'service_role') {
    const msg =
      `🔴 AMZ tag-pool cron MISCONFIGURED\n` +
      `SUPABASE_SERVICE_ROLE_KEY role='${keyRole}' (expected 'service_role').\n` +
      `Under RLS all pool writes silently fail — maintenance is DISABLED until the ` +
      `env var is corrected in Vercel (both thewinner-ae and thewinners-ae) and redeployed.`;
    console.error(msg);
    const alertSent = await sendTelegram(msg);
    return {
      ok: false, key_role: keyRole, promoted_to_stable: 0, graduated_from_cohort: 0,
      cohort_added: 0, cohort_removed: 0, cohort_size_now: 0, reserve_remaining: 0,
      alert_sent: alertSent, errors: [msg],
    };
  }

  // ── 0b. V2 config (Decision 157). Flag off ⇒ V1 fixed cohort + threshold 4. ──
  const cfg = await getPoolConfig('ae');
  const v2 = cfg?.mechanics_v2 === true && cfg.enabled === true;
  const promoteThreshold = v2 ? cfg!.visibility_threshold : 4;

  // ── 1. Promote tags whose cumulative order count ≥ threshold ──
  // Fetch the eligible tag_ids from snapshot, then UPDATE tag_pool. Scoped to the AE
  // gads rotation pool (2026-07-02): is_stable only governs gads rotation eligibility,
  // so static tags (seo/direct/…) must not be flagged, and program='ae' preserves the
  // MULTIGEO Step-1 invariant. No-op vs old behavior for AE assignment.
  // 2026-07-05: threshold is config-driven under V2 (visibility_threshold), still 4 in V1.
  const { data: snapshotEligible, error: snapErr } = await sb
    .from('amazon_purchase_snapshot')
    .select('tag_id')
    .gte('items_ordered', promoteThreshold);
  if (snapErr) errors.push(`snapshot_read: ${snapErr.message}`);
  const eligibleIds = (snapshotEligible || []).map(r => r.tag_id);

  let promotedCount = 0;
  if (eligibleIds.length > 0) {
    const { data: promoted, error: promErr } = await sb
      .from('tag_pool')
      .update({ is_stable: true })
      .in('tag_id', eligibleIds)
      .eq('program', 'ae')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('is_stable', false)
      .select('tag_id');
    if (promErr) errors.push(`promote: ${promErr.message}`);
    promotedCount = promoted?.length || 0;
  }

  // ── 2. Graduate stable cohort members (they no longer need cohort lane) ──
  // 2026-07-02: scoped to program='ae' + gads to preserve the MULTIGEO invariant.
  const { data: graduated, error: gradErr } = await sb
    .from('tag_pool')
    .update({ seeding_cohort: false })
    .eq('program', 'ae')
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('seeding_cohort', true)
    .eq('is_stable', true)
    .select('tag_id');
  if (gradErr) errors.push(`graduate: ${gradErr.message}`);
  const graduatedCount = graduated?.length || 0;

  // ── 3. Top up cohort (warming lane) back to target size ──
  // V1: fixed TRACKING_CONFIG.seedingCohortSize.
  // V2 (2026-07-05): dynamic warming target W = (K − S) / m, where
  //   K = live daily clickouts (gads sessions with a clickout, last 24h),
  //   S = stable count, m = warming_target_m. Auto-scales with spend; drives stable
  //   toward ≈ daily clickouts so every clickout pins 1-to-1. On-demand pulls in
  //   assignGadsTagV2 can push warming above W between crons — then needed ≤ 0, no-op.
  let targetSize = TRACKING_CONFIG.seedingCohortSize;
  let kClickouts = 0;
  let sStable = 0;
  if (v2 && cfg) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: kCount, error: kErr } = await sb
      .from('click_log')
      .select('*', { count: 'exact', head: true })
      .eq('traffic_source', 'gads')
      // 2026-07-05 FIX (Decision 164): clicked_asins DEFAULTS to '{}' (empty array),
      // never NULL — so `is not null` counted EVERY gads session (click-in) as a
      // clickout and inflated K ~4× (e.g. 319 vs 78), pushing W=(K−S)/m from ~10 to
      // ~71 and over-provisioning warming. Count only REAL clickouts (non-empty array).
      .neq('clicked_asins', '{}')
      .gt('created_at', since);
    if (kErr) errors.push(`k_clickouts: ${kErr.message}`);
    const { count: sCount, error: sErr } = await sb
      .from('tag_pool')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'ae')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('is_stable', true);
    if (sErr) errors.push(`s_stable: ${sErr.message}`);
    kClickouts = kCount || 0;
    sStable = sCount || 0;
    targetSize = Math.max(0, Math.ceil((kClickouts - sStable) / cfg.warming_target_m));
  }
  const { count: cohortCount, error: cohortErr } = await sb
    .from('tag_pool')
    .select('*', { count: 'exact', head: true })
    .eq('program', 'ae')   // MULTIGEO: AE cohort only
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('seeding_cohort', true);
  if (cohortErr) errors.push(`cohort_count: ${cohortErr.message}`);
  const currentCohort = cohortCount || 0;
  const needed = targetSize - currentCohort;

  let addedCount = 0;
  if (needed > 0) {
    const { data: candidates, error: candErr } = await sb
      .from('tag_pool')
      .select('tag_id')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('program', 'ae')   // MULTIGEO: top up AE cohort from AE reserve only
      .eq('is_stable', false)
      .eq('seeding_cohort', false)
      .eq('status', 'available')
      .order('tag_id', { ascending: true })   // deterministic: lowest tag_id first
      .limit(needed);
    if (candErr) errors.push(`topup_candidates: ${candErr.message}`);

    if (candidates && candidates.length > 0) {
      const ids = candidates.map(r => r.tag_id);
      const { data: added, error: addErr } = await sb
        .from('tag_pool')
        .update({ seeding_cohort: true })
        .in('tag_id', ids)
        .select('tag_id');
      if (addErr) errors.push(`topup_update: ${addErr.message}`);
      addedCount = added?.length || 0;
      // Silent-no-op canary: we matched reserve candidates but wrote nothing and got
      // no error → the classic RLS/permissions swallow. Surface it (2026-07-02).
      if (addedCount === 0) {
        errors.push(`topup_update: matched ${ids.length} candidates but 0 rows changed (silent no-op)`);
      }
    }
  }

  // ── 3b. Trim warming DOWN to W (V2 only) — 2026-07-05 (Decision 164) ──
  // On-demand reserve→warming pulls (assignGadsTagV2 priority 3) grow warming but never
  // shrink it, and the K-inflation bug (fixed above) had over-pulled. Without a trim,
  // warming ratchets up and dilutes graduation (clickouts spread thin across too many
  // warmers). Demote the excess back to reserve so the pool concentrates toward stable.
  // ONLY demote idle, no-progress warmers (available + last_clickout_at IS NULL) — never
  // a busy tag or a warmer that has clicked out (that one is in-progress toward ≥4 orders).
  let removedCount = 0;
  if (v2 && needed < 0) {
    const excess = -needed;
    const { data: demoteCands, error: demoteCandErr } = await sb
      .from('tag_pool')
      .select('tag_id')
      .eq('program', 'ae')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
      .eq('seeding_cohort', true)
      .eq('is_stable', false)
      .eq('status', 'available')
      .is('last_clickout_at', null)
      .order('tag_id', { ascending: false })   // mirror top-up (lowest-first) — trim highest-first
      .limit(excess);
    if (demoteCandErr) errors.push(`trim_candidates: ${demoteCandErr.message}`);
    if (demoteCands && demoteCands.length > 0) {
      const ids = demoteCands.map(r => r.tag_id);
      const { data: demoted, error: demErr } = await sb
        .from('tag_pool')
        .update({ seeding_cohort: false })
        .in('tag_id', ids)
        .select('tag_id');
      if (demErr) errors.push(`trim_update: ${demErr.message}`);
      removedCount = demoted?.length || 0;
    }
  }

  // ── 4. Reserve health check + Telegram alert if low ──
  const { count: reserveCount, error: reserveErr } = await sb
    .from('tag_pool')
    .select('*', { count: 'exact', head: true })
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('program', 'ae')   // MULTIGEO: AE reserve health only
    .eq('is_stable', false)
    .eq('seeding_cohort', false);
  if (reserveErr) errors.push(`reserve_count: ${reserveErr.message}`);
  const reserveRemaining = reserveCount || 0;

  // ── 5. Surface any in-band errors loudly (2026-07-02) ──
  // The Supabase JS client returns errors in { error } and never throws, so an
  // unchecked step fails silently. Alert on any collected error so a future
  // regression can't hide behind an HTTP 200 the way this bug did.
  if (errors.length > 0) {
    console.error('[maintainTagPool] step errors:', JSON.stringify(errors));
    await sendTelegram(`🔴 AMZ tag-pool cron errors:\n${errors.join('\n')}`);
  }

  let alertSent = false;
  if (reserveRemaining < TRACKING_CONFIG.poolLowThreshold) {
    // Find the highest currently-known tag_id to suggest a starting number
    const { data: highest } = await sb
      .from('tag_pool')
      .select('tag_id')
      .like('tag_id', 'twnrae%-21')
      .order('tag_id', { ascending: false })
      .limit(1)
      .single();
    const nextNumeric = highest?.tag_id
      ? `(highest current: ${highest.tag_id})`
      : '';

    alertSent = await sendTelegram(
      `🟡 AMZ tag pool LOW\n` +
      `Reserve gads tags: ${reserveRemaining} (threshold: ${TRACKING_CONFIG.poolLowThreshold})\n` +
      `Cohort: ${currentCohort + addedCount - removedCount}/${targetSize}\n` +
      `Action: create more tracking IDs in Amazon Associates ${nextNumeric}, ` +
      `then INSERT them into tag_pool with tag_type='gads'.`
    );
  }

  return {
    ok: errors.length === 0,
    key_role: keyRole,
    promoted_to_stable: promotedCount,
    graduated_from_cohort: graduatedCount,
    cohort_added: addedCount,
    cohort_removed: removedCount,
    cohort_size_now: currentCohort + addedCount - removedCount,
    reserve_remaining: reserveRemaining,
    alert_sent: alertSent,
    errors,
    mechanics_v2: v2,
    warming_target: v2 ? targetSize : undefined,
    k_clickouts: v2 ? kClickouts : undefined,
    s_stable: v2 ? sStable : undefined,
  };
}


export async function releaseExpiredTags(): Promise<number> {
  const now = new Date().toISOString();

  // Find expired busy tags
  const { data: expiredTags } = await getSupabaseAdmin()
    .from('tag_pool')
    .select('tag_id, current_session')
    .eq('status', 'busy')
    .lt('expires_at', now);

  if (!expiredTags || expiredTags.length === 0) return 0;

  // Mark sessions as expired
  const sessionIds = expiredTags
    .map(t => t.current_session)
    .filter(Boolean);

  if (sessionIds.length > 0) {
    await getSupabaseAdmin()
      .from('click_log')
      .update({ status: 'expired' })
      .in('session_id', sessionIds);
  }

  // Release the tags
  const tagIds = expiredTags.map(t => t.tag_id);
  await getSupabaseAdmin()
    .from('tag_pool')
    .update({
      status: 'available',
      current_session: null,
      assigned_at: null,
      expires_at: null,
    })
    .in('tag_id', tagIds);

  return expiredTags.length;
}
