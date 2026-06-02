// ============================================================================
// lib/title-ar.ts — Arabic "10 Best…" headline/title generators (INTL1)
// ----------------------------------------------------------------------------
// Deterministic Arabic mirror of the English generators in lib/utils.ts. Uses
// the PRE-FORMED Arabic noun phrase (nounAr) stored once per keyword in
// keyword_translations.keyword_text (broken plurals can't be auto-derived, so
// the LLM supplies the correct plural+adjective form once). Native-confirmed
// templates (2026-05-30). Western numerals (0-9); brand "The Winners" stays
// Latin to match CONFIG.siteName. Edit a template here → every /ar page updates
// on next ISR revalidate.
// ============================================================================

// English month index (0-11) → Arabic month name (amazon.ae Arabic UI forms).
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

export function getArabicMonth(date: Date = new Date()): string {
  return ARABIC_MONTHS[date.getMonth()];
}

// "أفضل 10 {nounAr} لعام {year}"
export function generateArabicHeadline(nounAr: string, year: number): string {
  return `أفضل 10 ${nounAr} لعام ${year}`;
}

// "{nounAr} — مراجعات وتوصيات ودليل شراء محدّث {monthAr} {year}"
export function generateArabicSubHeadline(nounAr: string, date: Date = new Date()): string {
  return `${nounAr} — مراجعات وتوصيات ودليل شراء محدّث ${getArabicMonth(date)} ${date.getFullYear()}`;
}

// "أفضل 10 {nounAr} لعام {year} | The Winners" (brand stays Latin)
export function generateArabicPageTitle(nounAr: string, year: number, brand = 'The Winners'): string {
  return `أفضل 10 ${nounAr} لعام ${year} | ${brand}`;
}

// Arabic meta description (mirror of generatePageDescription).
export function generateArabicPageDescription(nounAr: string): string {
  return `${nounAr} — الأعلى تقييمًا في الفئة! اخترنا أفضل الموديلات الأعلى قيمة مقابل السعر. مقارنة شاملة وموضوعية.`;
}
