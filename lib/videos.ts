// ============================================================
// videos.ts — the site's own video pages, for the homepage "Watch & Learn" row.
// Created 2026-11-28 (homepage magazine PR), shape agreed with the VID 1 lane.
//
// This is a STUB with an EMPTY list: no videos are recorded yet. The homepage
// renders the videos section as NOTHING while VIDEOS is empty, so shipping this
// is a no-op in the UI. The VID 1 PR owns the content — it POPULATES this array
// (editing this file, not re-creating it) and adds the on-site /how-it-works page
// + YouTubeFacade. `sitePath` is always our OWN crawlable page (never a bare
// youtube.com link). The homepage reads only slug/sitePath/title/thumbnail/locale;
// youtubeId/uploadDate/durationISO are for the VideoObject JSON-LD on that page.
// ============================================================

export interface Video {
  /** Stable id for the video. */
  slug: string;
  /** On-site crawlable page for the video (e.g. /how-it-works) — never a bare YouTube URL. */
  sitePath: string;
  /** Display title (native per locale). */
  title: string;
  /** Locale this entry is shown on (en | ar | ja | …). */
  locale: string;
  /** YouTube id (for the facade + JSON-LD on the video page). */
  youtubeId: string;
  /** Thumbnail URL (local/static or youtube i.ytimg.com). */
  thumbnail: string;
  /** ISO date the video was published (JSON-LD). */
  uploadDate: string;
  /** ISO 8601 duration, e.g. PT1M50S (JSON-LD). */
  durationISO: string;
}

export const VIDEOS: Video[] = [];

/** Videos to show on a given locale's homepage. Empty today → section renders nothing. */
export function getVideosFor(locale: string): Video[] {
  return VIDEOS.filter((v) => v.locale === locale);
}
