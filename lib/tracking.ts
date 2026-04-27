// ============================================
// TRACKING UTILITIES — Server-side tag rotation
// ============================================
// Created: 2026-03-27
// Last Modified: 2026-03-27
// Handles tag assignment, click logging, and tag expiry
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
};

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
}

export interface TagAssignResponse {
  session_id: string;
  assigned_tag: string;
  expires_at: string | null;
}

export async function assignTag(req: TagAssignRequest): Promise<TagAssignResponse> {
  const sessionId = crypto.randomUUID();

  // Static sources get static tags (no rotation)
  if (TRACKING_CONFIG.staticTagTypes.includes(req.traffic_source)) {
    const staticTag = await getStaticTag(req.traffic_source);

    // Log the session (even for static tags — useful for analytics)
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
  });

    return {
      session_id: sessionId,
      assigned_tag: staticTag,
      expires_at: null, // static tags don't expire
    };
  }

  // Google Ads (and other rotating sources) — find a free tag from pool
  const holdHours = TRACKING_CONFIG.tagHoldHours;
  const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString();

  // Step 1: Try to find an available tag
  let { data: freeTag } = await getSupabaseAdmin()
    .from('tag_pool')
    .select('tag_id')
    .eq('tag_type', TRACKING_CONFIG.gadsTagType)
    .eq('status', 'available')
    .order('assigned_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .single();

  // Step 2: No free tag — steal the oldest assigned one
  if (!freeTag) {
    const { data: oldestTag } = await getSupabaseAdmin()
      .from('tag_pool')
      .select('tag_id, current_session')
      .eq('tag_type', TRACKING_CONFIG.gadsTagType)
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
      assigned_tag: staticTag,
      traffic_source: req.traffic_source,
      landing_page: req.landing_page || null,
      user_agent: req.user_agent || null,
      ip_country: req.ip_country || null,
      user_id: req.user_id || null,
      site: req.site || null,
    });

  return {
    session_id: sessionId,
    assigned_tag: assignedTag,
    expires_at: expiresAt,
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

  return !error;
}

// ============================================
// TAG EXPIRY (called by cron)
// ============================================

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
