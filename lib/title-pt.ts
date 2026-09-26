// ============================================================================
// lib/title-pt.ts — Brazilian-Portuguese "10 best…" headline/title generators (BR 1)
// ----------------------------------------------------------------------------
// Created: 2026-09-26 (BR 1 — /pt pages, amazon.com.br). Mirror of lib/title-ja.ts
// and lib/title-ar.ts. Uses the PRE-FORMED pt-BR noun stored per keyword in
// keyword_translations(locale='pt').keyword_text — the same term shoppers search on
// amazon.com.br (e.g. "notebook gamer", "mamadeira", "aspirador de pó Roborock").
//
// TEMPLATE RULE (found in the pilot, study §0.2): nouns are stored in the SINGULAR
// search form, so templates must never need a plural ("Os melhores {noun}" would read
// "os melhores notebook gamer"). Pattern = "{Noun}: os 10 melhores de {year}".
// Brand "The Winners" stays Latin. Native-QA the templates before indexing.
// ============================================================================

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function getPortugueseMonth(date: Date = new Date()): string {
  return PT_MONTHS[date.getMonth()];
}

// Capitalize only the first letter; keep brand/acronym casing ("TV box", "SSD interno para PS5").
function capFirst(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1) : t;
}

// "Notebook gamer: os 10 melhores de 2026"
export function generatePortugueseHeadline(nounPt: string, year: number): string {
  return `${capFirst(nounPt)}: os 10 melhores de ${year}`;
}

// "Análises, comparação e guia de compra de notebook gamer · atualizado em setembro de 2026"
export function generatePortugueseSubHeadline(nounPt: string, date: Date = new Date()): string {
  return `Análises, comparação e guia de compra de ${nounPt.trim()} · atualizado em ${getPortugueseMonth(date)} de ${date.getFullYear()}`;
}

// "Notebook gamer: os 10 melhores de 2026 | The Winners"
export function generatePortuguesePageTitle(nounPt: string, year: number, brand = 'The Winners'): string {
  return `${generatePortugueseHeadline(nounPt, year)} | ${brand}`;
}

export function generatePortuguesePageDescription(nounPt: string): string {
  // "as 10 melhores opções de {noun}" reads correctly with a singular noun.
  return `Comparamos as 10 melhores opções de ${nounPt.trim()} na Amazon.com.br. Seleção objetiva para você escolher o modelo certo com confiança.`;
}
