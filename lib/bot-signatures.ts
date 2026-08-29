// ============================================
// Spoofed-browser bot UA signatures — single source of truth
// ============================================
// Created: 2026-08-29
//
// These are junk/scraper bots that spoof a REAL desktop browser UA (so they
// slip past the crawler patterns in /api/tag-assign) but come through a
// residential-proxy botnet: the same ~10 frozen UA strings each appear
// thousands of times spread across 100+ countries in a night (including AE —
// the proxy pool has AE exit nodes, which is why they look like "AE traffic").
// They never click out. IP/ASN/geo can't catch them (residential proxies; the
// Vercel plan doesn't even send x-vercel-ip-as-number → as_number is null), so
// we match the FROZEN, years-old browser versions instead — real 2026 traffic
// is Chrome ~140+, so these late-2023 versions in volume are unambiguous.
//
// History: the 'Chrome/145.0.0.0' signature came from the May-2026 SG bot wave
// (an IMPOSSIBLE future version). The 118/119/120 + Firefox 120/121 signatures
// are the Aug-2026 wave (frozen PAST versions). Add new signatures here if it
// rotates — this list is imported by BOTH the ingest guard (/api/tag-assign)
// and the analytics reads (/api/admin/tracking). The Postgres function
// admin_tracking_rollup keeps a MIRROR of this list in SQL — update both
// together (there is a pointer comment in the migration).
//
// SAFE to be aggressive: nothing here BLOCKS a visitor. The ingest guard only
// declines to create a tracking session (the page still renders and still gets
// a default affiliate tag); the analytics reads only exclude these rows from
// the visitor/session counts. A rare real user on a 3-year-old browser is
// therefore untracked, never blocked. Do NOT add these to the middleware 403
// list — that WOULD block, and these versions are old-but-possible.
export const SPOOFED_BROWSER_BOT_UAS: string[] = [
  'Chrome/145.0.0.0', // SG wave (2026-05) — impossible future version
  'Chrome/118.0.0.0', // Aug-2026 wave — frozen late-2023 versions ↓
  'Chrome/119.0.0.0', // (also catches Edg/119 — Edge UA embeds this Chrome token)
  'Chrome/120.0.0.0', // (also catches Edg/120)
  'Firefox/120.0',
  'Firefox/121.0',
];

export function isSpoofedBrowserBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return SPOOFED_BROWSER_BOT_UAS.some((sig) => userAgent.includes(sig));
}
