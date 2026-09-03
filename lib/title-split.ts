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

// Minimum words a headline should carry (AMZ WBS 4, 2026-09-03, owner-approved).
// The old comma/dash split often yields a brand+model-only headline
// ("Terim TERR300S", "PHILIPS Bhh880") that reads as misleading — you can't tell
// it's a fridge/straightener. When the headline falls short, we EXTEND it by
// pulling in the next title segment(s), up to MIN_HEADLINE_WORDS, capped at
// HEADLINE_WORD_CAP so a headline never runs long. Data (300K English titles):
// ~8.4% of headlines were < 4 words; ~3.7% are genuinely un-extendable (the whole
// title is just a brand, e.g. "Samsung") and are left as-is.
const MIN_HEADLINE_WORDS = 4;
const HEADLINE_WORD_CAP = 9;

const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0);

// Split a full title into its human segments on comma / spaced dash / pipe — the
// same delimiter family the base split uses. Hyphens inside tokens (Wi-Fi,
// i5-1335U) are preserved because only SPACED dashes count.
const TITLE_SEG_RE = /\s*,\s*|\s+[-–—|]\s+/;

// Grow `short` toward MIN_HEADLINE_WORDS by appending whole segments taken from
// the ORIGINAL title, never exceeding HEADLINE_WORD_CAP. IMPORTANT (owner req,
// WBS 4): `rest` (the "Show more" tail) is returned UNCHANGED — the promoted
// words stay in the read-more too, so nothing is lost from it.
function extendHeadline(fullTitle: string, short: string, rest: string | null): SplitTitle {
  if (wordCount(short) >= MIN_HEADLINE_WORDS) {
    return { shortTitle: short, restTitle: rest };
  }
  const segs = fullTitle.split(TITLE_SEG_RE).map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 1) {
    return { shortTitle: short, restTitle: rest }; // nothing more to add (brand-only)
  }
  let head = segs[0];
  for (let i = 1; i < segs.length && wordCount(head) < MIN_HEADLINE_WORDS; i++) {
    const candidate = `${head}, ${segs[i]}`;
    if (wordCount(candidate) > HEADLINE_WORD_CAP) break;
    head = candidate;
  }
  return { shortTitle: capitalizeFirst(head), restTitle: rest };
}

// Split title at first comma or spaced-dash — short title + rest for "Show more".
// Does NOT split at hyphens inside words (Wi-Fi, 128GB-256GB, etc.).
// The base split rule is VERBATIM from the previous ProductCard.splitTitle();
// extendHeadline() then enforces the WBS-4 minimum-word headline on top (and is a
// no-op when the base headline already has >= MIN_HEADLINE_WORDS, so titles that
// were already fine stay byte-identical).
function splitEnglishTitle(fullTitle: string): SplitTitle {
  // Try comma first (most common in Amazon titles)
  const commaIdx = fullTitle.indexOf(',');
  if (commaIdx >= 10) {
    return extendHeadline(
      fullTitle,
      capitalizeFirst(fullTitle.substring(0, commaIdx).trim()),
      fullTitle.substring(commaIdx + 1).trim() || null,
    );
  }

  // Try spaced dash/pipe: " - ", " – ", " — ", " | "
  const spacedBreak = fullTitle.match(/^(.{10,}?)\s+[-–—|]\s+([\s\S]*)/);
  if (spacedBreak) {
    return extendHeadline(
      fullTitle,
      capitalizeFirst(spacedBreak[1].trim()),
      spacedBreak[2].trim() || null,
    );
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

// ─── Japanese (INTL1 JP Phase 2, 2026-07-06) ─────────────────────────────────
// Japanese has no case and uses full-width punctuation; amazon.co.jp titles are
// long and often space- or 、-separated, frequently with a 【…】 tag prefix.
// Mirror the Arabic rule with Japanese delimiters and a CJK-tuned cap (Japanese
// characters are information-dense, so a shorter headline reads cleanly).

const JA_MIN_PREFIX = 5; // don't make a headline shorter than this
const JA_SOFT_CAP = 34; // soft max headline length; longer gets a smart break

// Clean break candidates for capping: full/half-width comma, full-width pipe, or
// a spaced dash/pipe (half- or full-width space). Bare spaces are handled as a
// last-resort word boundary in applyJaSoftCap.
const JA_BREAK_RE = /([、，,｜])|((?:\s|　)+[-–—|]\s*)/g;

// If `short` exceeds JA_SOFT_CAP, move the overflow into the read-more. Prefer
// the LAST clean delimiter at >= JA_MIN_PREFIX and <= JA_SOFT_CAP; else the last
// (half/full-width) space before the cap; else a hard cut.
function applyJaSoftCap(short: string, rest: string | null): SplitTitle {
  if (short.length <= JA_SOFT_CAP) return { shortTitle: short, restTitle: rest };

  let headEnd = -1;
  let tailStart = -1;
  for (const m of Array.from(short.matchAll(JA_BREAK_RE))) {
    const end = m.index ?? 0; // headline ends BEFORE the delimiter
    if (end >= JA_MIN_PREFIX && end <= JA_SOFT_CAP) {
      headEnd = end;
      tailStart = end + m[0].length; // skip the delimiter (and its spaces)
    } else if (end > JA_SOFT_CAP) {
      break; // matches are in order; past the cap
    }
  }

  let head: string;
  let tail: string;
  if (headEnd >= JA_MIN_PREFIX) {
    head = short.substring(0, headEnd).trim();
    tail = short.substring(tailStart).trim();
  } else {
    const sp = Math.max(short.lastIndexOf(' ', JA_SOFT_CAP), short.lastIndexOf('　', JA_SOFT_CAP));
    if (sp >= JA_MIN_PREFIX) {
      head = short.substring(0, sp).trim();
      tail = short.substring(sp + 1).trim();
    } else {
      head = short.substring(0, JA_SOFT_CAP).trim();
      tail = short.substring(JA_SOFT_CAP).trim();
    }
  }

  const restTitle = [tail, rest].filter(Boolean).join(' ') || null;
  return { shortTitle: head, restTitle };
}

function splitJapaneseTitle(fullTitle: string): SplitTitle {
  const t = (fullTitle || '').trim();
  if (!t) return { shortTitle: t, restTitle: null };

  // (1) First full/half-width comma or full-width pipe at >= JA_MIN_PREFIX.
  const seps = ['、', '，', ',', '｜'].map((c) => t.indexOf(c)).filter((i) => i >= JA_MIN_PREFIX);
  if (seps.length > 0) {
    const idx = Math.min(...seps);
    return applyJaSoftCap(t.substring(0, idx).trim(), t.substring(idx + 1).trim() || null);
  }

  // (2) Spaced dash/pipe: " - ", " – ", " — ", " | " (half- or full-width space).
  const spacedBreak = t.match(/^([\s\S]{5,}?)(?:\s|　)+[-–—|]\s*([\s\S]*)/);
  if (spacedBreak) {
    return applyJaSoftCap(spacedBreak[1].trim(), spacedBreak[2].trim() || null);
  }

  // (3) Fallback: long, delimiter-less title → whole thing is the headline, then
  //     the smart cap pulls any overflow into the read-more.
  return applyJaSoftCap(t, null);
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Locale-aware title split. English (default) is byte-identical to the original
 * ProductCard rule; 'ar' uses the validated Arabic rule with the soft cap; 'ja'
 * uses the Japanese full-width-aware rule (INTL1 JP Phase 2).
 */
export function splitTitle(fullTitle: string, locale: string): SplitTitle {
  if (locale === 'ar') return splitArabicTitle(fullTitle);
  if (locale === 'ja') return splitJapaneseTitle(fullTitle);
  return splitEnglishTitle(fullTitle);
}
