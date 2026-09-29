// ============================================
// related-pages-pt.ts — curated pool for the /pt "Mais recomendações" nav (BR).
// Created 2026-09-29 (owner: /pt pages had no internal links between best-pages,
// unlike en/ar/ja). Mirror of lib/related-pages.ts, but pt-only:
//   • every slug is a COMPLETE /pt page (pt noun + pt BYG + BR products) — verified
//     live 2026-09-29: HTTP 200, no fallback redirect, amazon.com.br product links;
//   • `noun` = keyword_translations(pt).keyword_text (the pt-BR search noun, singular
//     search form → anchor template "Top 10 de {noun}" never needs a plural);
//   • picked from the top /pt pages by 30-day clickouts, mainstream + varied, no
//     duplicate nouns, no health/niche items.
// Static on purpose (cacheable, no DB read on the hot path) — same as the EN pool.
// Refresh when the BR catalogue grows (2,018 complete /pt pages on 2026-09-29).
// ============================================

export interface RelatedPagePt {
  slug: string;
  noun: string;
}

export const RELATED_POOL_PT: RelatedPagePt[] = [
  // Computadores, games & tablets
  { slug: 'gaming-laptops', noun: 'notebook gamer' },
  { slug: 'laptops', noun: 'notebook' },
  { slug: 'mini-gaming-pc', noun: 'PC gamer mini' },
  { slug: 'gaming-monitor', noun: 'monitor gamer' },
  { slug: 'oled-gaming-monitors', noun: 'monitor de jogo OLED' },
  { slug: 'gaming-chair', noun: 'cadeira gamer' },
  { slug: 'pc-controllers', noun: 'controle para PC' },
  { slug: 'retro-handheld-gaming-console', noun: 'console de jogos portátil retrô' },
  { slug: 'gaming-tablet', noun: 'tablet gamer' },
  { slug: 'tablets', noun: 'tablet' },
  { slug: 'kids-tablet', noun: 'tablet para crianças' },
  { slug: 'repeaters', noun: 'repetidor Wi-Fi' },
  { slug: 'home-laser-printer', noun: 'impressora a laser para casa' },
  { slug: '3d-printer', noun: 'impressora 3D' },
  { slug: '3d-printer-for-beginners', noun: 'impressora 3D para iniciantes' },
  // Relógios & áudio
  { slug: 'smart-watches', noun: 'smartwatch' },
  { slug: 'kids-gps-smart-watch', noun: 'smartwatch infantil com GPS' },
  { slug: 'earbuds', noun: 'fones de ouvido sem fio' },
  { slug: 'record-players', noun: 'toca-discos' },
  // TV
  { slug: 'tv-box', noun: 'TV box' },
  { slug: '75-inch-tv', noun: 'TV de 75 polegadas' },
  { slug: '100-inch-tv', noun: 'TV de 100 polegadas' },
  { slug: '65-inch-oled-tv', noun: 'TV OLED de 65 polegadas' },
  // Carro & moto
  { slug: 'wireless-carplay-adapter', noun: 'adaptador CarPlay sem fio' },
  { slug: 'motorcycle-gps-navigation', noun: 'GPS para moto' },
  { slug: 'jump-starter', noun: 'auxiliar de partida para carro' },
  // Casa & cozinha
  { slug: 'air-fryers', noun: 'air fryer' },
  { slug: 'electric-rice-cookers', noun: 'panela de arroz elétrica' },
  { slug: 'food-processors', noun: 'processador de alimentos' },
  { slug: 'countertop-dishwashers', noun: 'lava-louças de bancada' },
  { slug: 'vacuum-cleaners', noun: 'aspirador de pó' },
  { slug: 'cordless-vacuum', noun: 'aspirador sem fio' },
  { slug: 'robot-vacuum-and-mop', noun: 'aspirador robô' },
  { slug: 'dyson-vacuum-cleaners', noun: 'aspirador de pó Dyson' },
  { slug: 'steam-irons', noun: 'ferro de passar a vapor' },
  { slug: 'handheld-sewing-machines', noun: 'máquina de costura portátil' },
  // Bem-estar & fitness
  { slug: 'massage-chair', noun: 'cadeira de massagem' },
  { slug: 'walking-pads', noun: 'caminhadeira' },
  // Bebê & pet
  { slug: 'baby-high-chair', noun: 'cadeira alta para bebê' },
  { slug: 'baby-walker', noun: 'andador de bebê' },
  { slug: 'automatic-cat-litter-box', noun: 'caixa de areia automática para gatos' },
  // Música
  { slug: 'beginner-electronic-drum-kit', noun: 'bateria eletrônica para iniciantes' },
  { slug: '88-keys-weighted-digital-pianos', noun: 'piano digital de 88 teclas' },
];
