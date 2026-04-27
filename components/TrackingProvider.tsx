'use client';
// ============================================
// TrackingProvider.tsx — Tag rotation + GCLID capture
// ============================================
// Created: 2026-03-19
// Last Modified: 2026-03-27
// v2.0: Added tag rotation, GCLID capture, dynamic link rewriting
// ============================================

import { useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CONFIG } from '@/lib/utils';

// Session data stored in sessionStorage
interface TrackingSession {
  session_id: string;
  assigned_tag: string;
  expires_at: string | null;
  traffic_source: string;
  gclid: string | null;
}

const SESSION_KEY = 'tw_tracking_session';

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

function rewriteAmazonLinks(tag: string): void {
  if (typeof document === 'undefined') return;

  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="amazon.ae"]');
  links.forEach(link => {
    try {
      const url = new URL(link.href);
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

    // Check for existing valid session
    const existing = getStoredSession();
    if (existing) {
      // Reuse existing session — just rewrite links on this page
      rewriteAmazonLinks(existing.assigned_tag);
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

      // Store session
      const session: TrackingSession = {
        session_id: data.session_id,
        assigned_tag: data.assigned_tag,
        expires_at: data.expires_at,
        traffic_source: trafficSource,
        gclid: gclid || null,
      };
      storeSession(session);

      // Rewrite all Amazon links on the page
      rewriteAmazonLinks(data.assigned_tag);
    } catch (error) {
      console.error('Tag rotation failed, using default tag:', error);
      // Fallback: use default tag from CONFIG
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

  // Also rewrite links when new content loads (e.g., after client-side navigation)
  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      // Use MutationObserver to catch dynamically added Amazon links
      const observer = new MutationObserver(() => {
        rewriteAmazonLinks(session.assigned_tag);
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
