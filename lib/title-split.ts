// ============================================
// title-split.ts — locale-aware product-title splitter
// ============================================
// Created: 2026-05-30 (INTL1 Phase 2A)
//
// Amazon product titles are long; on a ProductCard we show a short HEADLINE and
// push the spec tail into the expandable "Show more" section. The split rule is
// language-specific, so this module exposes a single dispatcher:
//
//     splitTitle(fullTitle, locale) -> { shortTitle, restTitle }
//
//   • locale 'en' (and any non-'ar' default): the ORIGINAL English rule, moved
//     here VERBATIM from components/ProductCard.tsx so English output is
//     byte-identical (verified by SSR diff). Comma-first, then spaced dash/pipe,
//     else whole title; headline gets capitalizeFirst().
//   • locale 'ar': the validated Arabic rule (was
//     claude_code_files/intl1_ar_title_strip_draft_v1.ts, roadmap §4.8). Mirrors
//     English but (1) adds the Arabic comma "،" as a delimiter, (2) drops
//     capitalizeFirst (Arabic has no case), and (3) applies a smart,
//     delimiter-aware soft cap (60) so very long Arabic titles break cleanly.
//
// Phase 2A only WIRES the dispatch; the Arabic branch only runs on /ar routes
// (locale='ar'), which are noindex during Phase 2. English pages are unaffected.
// ============================================

export interface SplitTitle {
  shortTitle: string; // the headline
  restTitle: string | null; // spec tail for the expandable section (null if none)
}

// ─── English (original) ──────────────────────────────────────────────────────

// Capitalize first letter of a string (English-only; Arabic has no case).
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Split title at first comma or spaced-dash — short title + rest for "Show more".
// Does NOT split at hyphens inside words (Wi-Fi, 128GB-256GB, etc.).
// VERBATIM from the previous components/ProductCard.tsx splitTitle().
function splitEnglishTitle(fullTitle: string): SplitTitle {
  // Try comma first (most common in Amazon titles)
  const commaIdx = fullTitle.indexOf(',');
  if (commaIdx >= 10) {
    return {
      shortTitle: capitalizeFirst(fullTitle.substring(0, commaIdx).trim()),
      restTitle: fullTitle.substring(commaIdx + 1).trim() || null,
    };
  }

  // Try spaced dash/pipe: " - ", " – ", " — ", " | "
  const spacedBreak = fullTitle.match(/^(.{10,}?)\s+[-–—|]\s+([\s\S]*)/);
  if (spacedBreak) {
    return {
      shortTitle: capitalizeFirst(spacedBreak[1].trim()),
      restTitle: spacedBreak[2].trim() || null,
    };
  }

  return { shortTitle: capitalizeFirst(fullTitle), restTitle: null };
}

// ─── Arabic (validated; roadmap §4.8) ────────────────────────────────────────

const AR_COMMA = '،'; // ، Arabic comma (U+060C)
const MIN_PREFIX = 10; // don't make a headline shorter than this (parity with EN)
const SOFT_CAP = 60; // soft max headline length; longer headlines get a smart break

// Break candidates for capping a too-long headline, in priority of cleanliness.
// A stop char (Arabic/Latin comma, period, Arabic/Latin semicolon) only counts
// when FOLLOWED BY WHITESPACE — so decimals ("5.1 قناة"), model numbers
// ("i5-1335U") and ratios are never split. A spaced dash/pipe is also clean.
const BREAK_RE = /([،,.؛;])(?=\s)|(\s+[-–—|]\s+)/g;

// If `short` exceeds SOFT_CAP, move the overflow into the read-more. Prefer the
// LAST clean delimiter (stop-sign / spaced dash) at >= MIN_PREFIX and <= SOFT_CAP;
// else the last word boundary before the cap; else a hard cut.
function applySoftCap(short: string, rest: string | null): SplitTitle {
  if (short.length <= SOFT_CAP) return { shortTitle: short, restTitle: rest };

  let headEnd = -1;
  let tailStart = -1;
  // Array.from(...) materializes the iterator into a real array so this compiles
  // under the project's pre-ES2015 tsconfig target (no --downlevelIteration).
  for (const m of Array.from(short.matchAll(BREAK_RE))) {
    const end = m.index ?? 0; // headline ends BEFORE the delimiter
    if (end >= MIN_PREFIX && end <= SOFT_CAP) {
      headEnd = end;
      tailStart = end + m[0].length; // skip the delimiter (and its spaces)
    } else if (end > SOFT_CAP) {
      break; // matches are in order; past the cap
    }
  }

  let head: string;
  let tail: string;
  if (headEnd >= MIN_PREFIX) {
    head = short.substring(0, headEnd).trim();
    tail = short.substring(tailStart).trim();
  } else {
    const sp = short.lastIndexOf(' ', SOFT_CAP);
    if (sp >= MIN_PREFIX) {
      head = short.substring(0, sp).trim();
      tail = short.substring(sp + 1).trim();
    } else {
      head = short.substring(0, SOFT_CAP).trim();
      tail = short.substring(SOFT_CAP).trim();
    }
  }

  const restTitle = [tail, rest].filter(Boolean).join(' ') || null;
  return { shortTitle: head, restTitle };
}

function splitArabicTitle(fullTitle: string): SplitTitle {
  const t = (fullTitle || '').trim();
  if (!t) return { shortTitle: t, restTitle: null };

  // (1) First comma — Arabic ، or Latin , — whichever appears first, >= MIN_PREFIX.
  const commaIdxs = [t.indexOf(AR_COMMA), t.indexOf(',')].filter((i) => i >= MIN_PREFIX);
  if (commaIdxs.length > 0) {
    const idx = Math.min(...commaIdxs);
    return applySoftCap(t.substring(0, idx).trim(), t.substring(idx + 1).trim() || null);
  }

  // (2) Spaced dash/pipe: " - ", " – ", " — ", " | " (NOT hyphens inside tokens
  //     like Wi-Fi, i5-1335U, NA555/09).
  const spacedBreak = t.match(/^([\s\S]{10,}?)\s+[-–—|]\s+([\s\S]*)/);
  if (spacedBreak) {
    return applySoftCap(spacedBreak[1].trim(), spacedBreak[2].trim() || null);
  }

  // (3) Fallback: long, delimiter-less title → whole thing is the headline,
  //     then the smart cap pulls any overflow into the read-more.
  return applySoftCap(t, null);
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Locale-aware title split. English (default) is byte-identical to the original
 * ProductCard rule; 'ar' uses the validated Arabic rule with the soft cap.
 */
export function splitTitle(fullTitle: string, locale: string): SplitTitle {
  return locale === 'ar' ? splitArabicTitle(fullTitle) : splitEnglishTitle(fullTitle);
}
