'use client';
// ============================================
// TrackingProvider.tsx — Tag rotation + GCLID capture + GEOS1 geo routing
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-05-21 (GEOS1)
// v2.0: Added tag rotation, GCLID capture, dynamic link rewriting
// v2.1 (AMZ6): persistent user_id + site columns
// v2.2 (GEOS1): geo-aware link rewriting (domain + tag), conditional session
//               re-init on geo mismatch, client-side bot guard.
//
// Conditional re-init explained:
//   When GEOS1_ENABLED toggles or a visitor crosses geos (VPN, traveling),
//   we compare the stored session's geo_group against the current geo cookie.
//   Match → reuse session unchanged (Gulf users keep their gads/static tag —
//   zero impact on the existing reconciliation pipeline). Mismatch → drop
//   sessionStorage and request a fresh assignment so links route to the
//   correct Amazon program.
//
//   Critically: pre-GEOS1 sessions (no stored geo_group) are treated as
//   'gulf', so a Gulf user opening the site after deploy reuses their
//   session as if nothing happened. Only non-Gulf users see a re-init.
// ============================================

import { useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CONFIG } from '@/lib/utils';
import { getGeoGroup, type GeoGroup } from '@/lib/geo-config';

// Session data stored in sessionStorage
interface TrackingSession {
  session_id: string;
  assigned_tag: string;
  expires_at: string | null;
  traffic_source: string;
  gclid: string | null;
  // GEOS1 fields — optional so pre-GEOS1 sessions in sessionStorage still
  // deserialize cleanly. Absent value is treated as 'gulf' / 'amazon.ae' so
  // a Gulf user's existing session keeps working without re-init.
  amazon_domain?: 'amazon.ae' | 'amazon.de' | 'amazon.com';
  geo_group?: GeoGroup;
}

const SESSION_KEY = 'tw_tracking_session';

// ============================================
// GEOS1 HELPERS
// ============================================

/**
 * Read `tw_geo` cookie (set by middleware) and resolve to a GeoGroup.
 * When the cookie is absent — GEOS1 disabled, local dev, or bot path — we
 * fall back to 'gulf' so the geo-mismatch check below treats it as today's
 * default behavior and doesn't force unnecessary re-inits.
 */
function getCurrentGeoGroup(): GeoGroup {
  if (typeof document === 'undefined') return 'gulf';
  const match = document.cookie.match(/(?:^|;\s*)tw_geo=([A-Z]{2})/i);
  if (!match) return 'gulf';
  return getGeoGroup(match[1]);
}

/**
 * Client-side bot detection. Third defense layer (after middleware bot-UA
 * skip and server route bot-UA short-circuit). Catches new bots not yet in
 * the middleware list — they get NO link rewriting, so Googlebot's WRS sees
 * the cached UAE HTML unchanged. List is intentionally a subset of the
 * middleware/server list — only the high-volume crawlers that matter for SEO.
 */
function isBotClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Googlebot|bingbot|YandexBot|Baiduspider|DuckDuckBot|AdsBot|Mediapartners-Google|GPTBot|ClaudeBot|PerplexityBot|AhrefsBot|SemrushBot/i.test(
    navigator.userAgent
  );
}

// ============================================
// TRAFFIC SOURCE DETECTION
// ============================================

function detectTrafficSource(): string {
  if (typeof window === 'undefined') return 'direct';

  const params = new URLSearchParams(window.location.search);

  if (params.get('gclid')) return 'gads';
  if (params.get('fbclid')) return 'fb';
  if (params.get('msclkid')) return 'bing';

  const ref = document.referrer.toLowerCase();
  if (!ref || ref.includes('thewinner.ae') || ref.includes('thewinners.ae')) return 'direct';
  if (ref.includes('google.') || ref.includes('bing.') || ref.includes('yahoo.') || ref.includes('duckduckgo.')) return 'seo';
  if (ref.includes('facebook.') || ref.includes('instagram.') || ref.includes('fb.')) return 'fb';
  if (ref.includes('chat.openai.') || ref.includes('chatgpt.') || ref.includes('claude.ai') || ref.includes('perplexity.')) return 'chatgpt';

  return 'other';
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function getStoredSession(): TrackingSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session: TrackingSession = JSON.parse(stored);

    // Check if session has expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // GEOS1 geo-mismatch check (Gulf-safe by design):
    //   - Gulf user with pre-GEOS1 session (no stored geo_group): stored
    //     coerces to 'gulf', current cookie maps to 'gulf' (or absent → 'gulf')
    //     → MATCH → reuse session, zero impact.
    //   - Non-Gulf user with pre-GEOS1 session: stored 'gulf' vs current
    //     'europe'/'international' → MISMATCH → drop session, fresh assign.
    //   - Visitor moves between geos (VPN, travel) mid-session → MISMATCH
    //     → fresh assignment to the new geo's program.
    const currentGroup = getCurrentGeoGroup();
    const storedGroup = session.geo_group || 'gulf';
    if (currentGroup !== storedGroup) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function storeSession(session: TrackingSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage might be full or blocked — silently fail
  }
}

// ============================================
// AMAZON LINK REWRITING
// ============================================

/**
 * Rewrite Amazon affiliate links in the DOM with the assigned tag, and
 * optionally swap the marketplace domain (GEOS1).
 *
 * Selector is INTENTIONALLY narrow — only `amazon.ae`. Affiliate links are
 * always rendered as `amazon.ae` by buildAffiliateUrl's SSR fallback, so we
 * never need to match `.de`/`.com` in the DOM. Critically, this avoids
 * touching editorial blog links that reference `amazon.com`/`amazon.de` as
 * non-affiliate citations (e.g., blog posts mentioning Amazon Alexa with a
 * homepage link). Once rewritten, links keep their new hostname; the MO
 * loop doesn't need to re-match them.
 *
 * Hostname regex is the second-line guard against any future link whose
 * href contains the substring `amazon.ae` but isn't actually an Amazon
 * marketplace URL.
 *
 * `domain` is optional — when omitted (the catch-block fallback path), only
 * the tag is rewritten and the existing hostname stays intact. Preserves
 * pre-GEOS1 behavior when the geo branch can't resolve.
 */
function rewriteAmazonLinks(tag: string, domain?: string): void {
  if (typeof document === 'undefined') return;

  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="amazon.ae"]');
  links.forEach(link => {
    try {
      const url = new URL(link.href);
      // Only touch real Amazon marketplace hostnames.
      if (!/^(www\.)?amazon\.(ae|de|com)$/i.test(url.hostname)) return;
      if (domain) {
        url.hostname = `www.${domain}`;
      }
      url.searchParams.set('tag', tag);
      link.href = url.toString();
    } catch {
      // Invalid URL — skip
    }
  });
}

// ============================================
// GCLID PERSISTENCE (localStorage for cross-session)
// ============================================

function persistGclid(): { gclid: string | null; fbclid: string | null } {
  if (typeof window === 'undefined') return { gclid: null, fbclid: null };

  const params = new URLSearchParams(window.location.search);

  const gclid = params.get('gclid');
  const fbclid = params.get('fbclid');

  // Save fresh values to localStorage (survives page closes)
  if (gclid) {
    localStorage.setItem('gclid', gclid);
    localStorage.setItem('gclid_timestamp', Date.now().toString());
  }
  if (fbclid) {
    localStorage.setItem('fbclid', fbclid);
    localStorage.setItem('fbclid_timestamp', Date.now().toString());
  }

  // Return current values (prefer URL param, fall back to stored)
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let storedGclid = gclid || localStorage.getItem('gclid');
  const gclidTs = localStorage.getItem('gclid_timestamp');
  if (storedGclid && gclidTs && !gclid && (now - parseInt(gclidTs)) > THIRTY_DAYS) {
    storedGclid = null;
  }

  let storedFbclid = fbclid || localStorage.getItem('fbclid');
  const fbclidTs = localStorage.getItem('fbclid_timestamp');
  if (storedFbclid && fbclidTs && !fbclid && (now - parseInt(fbclidTs)) > THIRTY_DAYS) {
    storedFbclid = null;
  }

  return { gclid: storedGclid, fbclid: storedFbclid };
}

// ADD after the closing brace of persistGclid() function, before the COMPONENT section comment

// ============================================
// PERSISTENT USER ID (localStorage for cross-session)
// ============================================

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const STORAGE_KEY = 'tw_user_id';
    let userId = localStorage.getItem(STORAGE_KEY);
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, userId);
    }
    return userId;
  } catch {
    return null;
  }
}


// ============================================
// COMPONENT
// ============================================

export default function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initTagRotation = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // GEOS1 belt-and-suspenders: skip all tracking for bots client-side too.
    // Middleware already skips the geo cookie for bots and the server route
    // returns a bot-shaped response; this third layer ensures any new bot
    // that slipped past middleware also gets zero DOM mutation, so its
    // rendered indexing matches the cached UAE HTML.
    if (isBotClient()) return;

    // Check for existing valid session (includes GEOS1 geo-mismatch check)
    const existing = getStoredSession();
    if (existing) {
      // Reuse existing session — rewrite links with stored tag + domain.
      // For pre-GEOS1 sessions amazon_domain is undefined → only the tag is
      // touched, hostname stays as rendered (amazon.ae). Identical to v2.1.
      rewriteAmazonLinks(existing.assigned_tag, existing.amazon_domain);
      return;
    }

    // No valid session — request a new tag
    const trafficSource = detectTrafficSource();
    const { gclid, fbclid } = persistGclid();

    try {
      const response = await fetch('/api/tag-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gclid,
          fbclid,
          traffic_source: trafficSource,
          landing_page: pathname,
          user_id: getUserId(),
          site: window.location.hostname,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Store session — includes GEOS1 fields when present in the response.
      // Server always populates amazon_domain/geo_group (defaults to
      // amazon.ae/gulf when GEOS1 is disabled), so storage is uniform.
      const session: TrackingSession = {
        session_id: data.session_id,
        assigned_tag: data.assigned_tag,
        expires_at: data.expires_at,
        traffic_source: trafficSource,
        gclid: gclid || null,
        amazon_domain: data.amazon_domain,
        geo_group: data.geo_group,
      };
      storeSession(session);

      // Rewrite all Amazon links on the page (domain swap when GEOS1-routed)
      rewriteAmazonLinks(data.assigned_tag, data.amazon_domain);
    } catch (error) {
      console.error('Tag rotation failed, using default tag:', error);
      // Fallback: use default tag from CONFIG, leave hostname as-is (.ae)
      rewriteAmazonLinks(CONFIG.amazonTag);
    }
  }, [pathname]);

  // Initialize on mount and when pathname changes
  useEffect(() => {
    // Small delay to ensure page content is rendered (links exist in DOM)
    const timer = setTimeout(() => {
      initTagRotation();
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, initTagRotation]);

  // Also rewrite links when new content loads (e.g., after client-side navigation).
  // Skip for bots — keep rendered indexing aligned with cached UAE HTML.
  useEffect(() => {
    if (isBotClient()) return;
    const session = getStoredSession();
    if (session) {
      // Use MutationObserver to catch dynamically added Amazon links.
      // Pass domain so newly-rendered amazon.ae links get swapped to the
      // visitor's geo program too.
      const observer = new MutationObserver(() => {
        rewriteAmazonLinks(session.assigned_tag, session.amazon_domain);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }
  }, []);

  return <>{children}</>;
}

// ============================================
// EXPORTED HELPERS (used by ProductCard)
// ============================================

/**
 * Get the current session ID for click logging.
 * Returns null if no session exists.
 */
export function getSessionId(): string | null {
  const session = getStoredSession();
  return session?.session_id || null;
}

/**
 * Log an ASIN click via sendBeacon (fire-and-forget).
 * Called by ProductCard on "Show Offer" click.
 */
export function logAsinClickBeacon(asin: string): void {
  const session = getStoredSession();
  if (!session?.session_id) return;

  const payload = JSON.stringify({
    session_id: session.session_id,
    asin: asin,
  });

  // sendBeacon guaranteed to complete even during page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/click-log', new Blob([payload], { type: 'application/json' }));
  } else {
    // Fallback for older browsers
    fetch('/api/click-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}
