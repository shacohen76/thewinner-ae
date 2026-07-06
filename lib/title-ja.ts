// ============================================================================
// lib/title-ja.ts — Japanese "10 Best…" headline/title generators (INTL1 JP)
// ----------------------------------------------------------------------------
// Created: 2026-07-06 (INTL1 JP Phase 2 — /ja pages)
//
// Deterministic Japanese mirror of lib/title-ar.ts / the English generators in
// lib/utils.ts. Uses the PRE-FORMED Japanese noun phrase (nounJa) stored once
// per keyword in keyword_translations.keyword_text (the LLM supplies the correct
// natural Japanese noun once — Japanese needs no plural/adjective inflection, but
// the noun should read naturally, e.g. 「ワイヤレスイヤホン」). Japanese is LTR;
// no case, no RTL. Full-width brackets 【】 + の…おすすめ10選 is the standard
// Japanese "top-10" listicle headline. Brand "The Winners" stays Latin to match
// CONFIG.siteName. Edit a template here → every /ja page updates on next ISR
// revalidate. Native-QA the templates once before indexing (STEP 5).
// ============================================================================

// Japanese months are just the month number + 月 (e.g. 7月). getMonth() is 0-11.
export function getJapaneseMonth(date: Date = new Date()): string {
  return `${date.getMonth() + 1}月`;
}

// "【{year}年】{nounJa}のおすすめ10選"
export function generateJapaneseHeadline(nounJa: string, year: number): string {
  return `【${year}年】${nounJa}のおすすめ10選`;
}

// "{nounJa}のレビュー・おすすめ・購入ガイド｜{year}年{month}更新"
export function generateJapaneseSubHeadline(nounJa: string, date: Date = new Date()): string {
  return `${nounJa}のレビュー・おすすめ・購入ガイド｜${date.getFullYear()}年${getJapaneseMonth(date)}更新`;
}

// "【{year}年】{nounJa}のおすすめ10選 | The Winners" (brand stays Latin)
export function generateJapanesePageTitle(nounJa: string, year: number, brand = 'The Winners'): string {
  return `【${year}年】${nounJa}のおすすめ10選 | ${brand}`;
}

// Japanese meta description (mirror of generatePageDescription).
export function generateJapanesePageDescription(nounJa: string): string {
  return `${nounJa}の売れ筋トップ10を徹底比較。コスパ最強のおすすめモデルを厳選しました。客観的な比較で、あなたに最適な一台が見つかります。`;
}
