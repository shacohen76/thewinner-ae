// ============================================
// Tag Assignment API — /api/tag-assign
// ============================================
// Created: 2026-03-27
// Last Modified: 2026-10-22 (junk rules → one Supabase table)
// v1.1: Added bot filtering (Vercel bots, crawlers)
// v1.2: GEOS1 — bot/admin short-circuit responses now include amazon_domain
//       + geo_group for uniform client-side handling. Main path passes the
//       fields through automatically via assignTag(). ip_country forwarded
//       to assignTag → server-side geo derivation; client doesn't post geo.
// v1.3 (2026-10-05, junk-direct cleanup): obvious-junk direct visits resolve
//       tag + domain but write NO click_log row (session_id null). If that
//       visitor clicks out, the client calls again with `clicked_asin` → the
//       session is created right then and the ASIN logged, so a real buyer's
//       click is never lost. Paid traffic (gads / gclid) always persists —
//       enforced in lib/tracking shouldPersist.
// v2.0 (2026-10-22): THIS route is now the ONE place that decides "bot" /
//       "direct_junk", using the rules in public.junk_traffic_rules (loaded by
//       lib/junk-rules.ts, matched by lib/junk-traffic.ts). The hardcoded
//       BOT_PATTERNS list + lib/bot-signatures.ts and the middleware decision
//       were moved into that table. This route also sets / clears the
//       NO_TRACK_COOKIE (was middleware). Docs: docs/JUNK_TRAFFIC_RULES.md.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { assignTag, logAsinClick } from '@/lib/tracking';
import { NO_TRACK_COOKIE, findRule, type VisitFacts } from '@/lib/junk-traffic';
import { getJunkRules } from '@/lib/junk-rules';

const ASIN_RE = /^[A-Z0-9]{10}$/;

// Pages that should not create tracking sessions
const EXCLUDED_PAGES = ['/admin'];

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || null;

    // Vercel geo headers. as_name is not sent on our plan (null in 100% of rows,
    // measured 2026-10-22); as_number is present on every row.
    const ipCountry = request.headers.get('x-vercel-ip-country') || null;
    const asName = request.headers.get('x-vercel-ip-as-name') || null;
    const asNumberRaw = request.headers.get('x-vercel-ip-as-number');
    const asNumberParsed = asNumberRaw ? parseInt(asNumberRaw, 10) : NaN;
    const asNumber = Number.isFinite(asNumberParsed) ? asNumberParsed : null;

    const visit: VisitFacts = { userAgent, country: ipCountry, asNumber };
    const rules = await getJunkRules();

    // BOT (any traffic source, also with a gclid): no click_log row, ever.
    // Safety invariant in code: no user-agent at all = bot.
    // Response shape includes GEOS1 fields (amazon_domain, geo_group) so the
    // client can read them uniformly — defaults to gulf since bots don't
    // need geo routing (they index cached UAE HTML anyway).
    if (!userAgent || findRule(rules, 'bot', visit)) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
        amazon_domain: 'amazon.ae',
        geo_group: 'gulf',
        is_bot: true,
      });
    }

    const body = await request.json();
    const { gclid, fbclid, traffic_source, landing_page, user_id, site, clicked_asin, campaign } = body;

    // Skip admin pages — don't track our own dashboard visits
    if (landing_page && EXCLUDED_PAGES.some((p: string) => landing_page.startsWith(p))) {
      return NextResponse.json({
        session_id: null,
        assigned_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21',
        expires_at: null,
        amazon_domain: 'amazon.ae',
        geo_group: 'gulf',
        is_admin: true,
      });
    }

    if (!traffic_source) {
      return NextResponse.json(
        { error: 'traffic_source is required' },
        { status: 400 }
      );
    }

    // DIRECT_JUNK: only a direct visit (no referrer, no click id, no campaign
    // param) can match. A clickout ALWAYS persists (safety invariant).
    const clickedAsin = typeof clicked_asin === 'string' && ASIN_RE.test(clicked_asin) ? clicked_asin : null;
    const isDirect = traffic_source === 'direct' && !gclid && !fbclid && campaign !== true;
    const junkRule = isDirect ? findRule(rules, 'direct_junk', visit) : null;
    const persist = clickedAsin ? true : !junkRule;

    const result = await assignTag({
      gclid: gclid || null,
      fbclid: fbclid || null,
      traffic_source,
      landing_page: landing_page || null,
      user_agent: userAgent,
      ip_country: ipCountry,
      user_id: user_id || null,
      site: site || null,
      as_name: asName,
      as_number: asNumber,
      persist,
    });

    // Deferred (direct_junk) visitor just clicked out → log that ASIN on the
    // session we created for it. Same call ProductCard's beacon would make.
    if (clickedAsin && result.session_id) {
      await logAsinClick(result.session_id, clickedAsin);
    }

    // no_track tells TrackingProvider to keep the session "deferred" (created on
    // the first clickout). junk_rule_id = which table row decided it (debugging).
    const noTrack = !!junkRule && !clickedAsin && !result.session_id;
    const response = NextResponse.json({
      ...result,
      no_track: noTrack,
      ...(noTrack ? { junk_rule_id: junkRule!.id } : {}),
    });

    // Cookie = the layout's signal to skip GTM/GA4 on the following page loads.
    if (noTrack) {
      response.cookies.set({
        name: NO_TRACK_COOKIE,
        value: '1',
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        httpOnly: false, // layout inline script + TrackingProvider read it
      });
    } else if (request.cookies.get(NO_TRACK_COOKIE)) {
      response.cookies.delete(NO_TRACK_COOKIE);
    }
    return response;
  } catch (error) {
    console.error('Tag assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign tag', fallback_tag: process.env.DEFAULT_TAG || 'twnraedirect01-21' },
      { status: 500 }
    );
  }
}
