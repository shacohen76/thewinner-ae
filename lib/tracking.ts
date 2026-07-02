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
import { getGeoConfig, GeoGroup, AmazonDomain } from './geo-config';

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

// Static tag mapping — traffic source → first matching tag
// These don't rotate, one tag per source type
async function getStaticTag(trafficSource: string): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from('tag_pool')
    .select('tag_id')
    .eq('tag_type', trafficSource)
    .limit(1)
    .single();

  return data?.tag_id || TRACKING_CONFIG.defaultTag;
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
      const assignedTag = geoConfig.defaultTag;

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
    const staticTag = await getStaticTag(req.traffic_source);

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

  // Google Ads (and other rotating sources) — find a free tag from pool
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

  // High-intent attribution lock: extend the tag's hold IF and ONLY IF
  // this session currently holds a STABLE tag. Cohort/reserve tags must
  // keep rotating per their original 4h hold so they can accumulate orders
  // and graduate. The filters below make this a no-op for cohort/reserve.
  //
  //   .eq('current_session', sessionId)  → only the tag this session owns
  //   .eq('is_stable', true)             → only stable tags get extended
  //   .gt('expires_at', now)             → only still-busy tags (skip if already released)
  //
  // Rolling: each ASIN click resets expires_at to now + ASIN_HOLD_HOURS,
  // so high-engagement visitors keep the tag bound through their session.
  const nowIso = new Date().toISOString();
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
  cohort_size_now: number;
  reserve_remaining: number;
  alert_sent: boolean;
  errors: string[];         // in-band Supabase errors per step (JS client returns, never throws)
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
      cohort_added: 0, cohort_size_now: 0, reserve_remaining: 0, alert_sent: alertSent,
      errors: [msg],
    };
  }

  // ── 1. Promote tags whose cumulative order count ≥ 4 ──
  // Fetch the eligible tag_ids from snapshot, then UPDATE tag_pool. Scoped to the AE
  // gads rotation pool (2026-07-02): is_stable only governs gads rotation eligibility,
  // so static tags (seo/direct/…) must not be flagged, and program='ae' preserves the
  // MULTIGEO Step-1 invariant. No-op vs old behavior for AE assignment.
  const { data: snapshotEligible, error: snapErr } = await sb
    .from('amazon_purchase_snapshot')
    .select('tag_id')
    .gte('items_ordered', 4);
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

  // ── 3. Top up cohort back to target size ──
  const targetSize = TRACKING_CONFIG.seedingCohortSize;
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
      `Cohort: ${currentCohort + addedCount}/${targetSize}\n` +
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
    cohort_size_now: currentCohort + addedCount,
    reserve_remaining: reserveRemaining,
    alert_sent: alertSent,
    errors,
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
