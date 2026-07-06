// Palette de couleurs pour les graphiques (accessible, cohérente avec le thème).
export const CHART_COLORS = [
  '#4f7cff', // bleu (portefeuille)
  '#22c55e', // vert
  '#f59e0b', // ambre
  '#ef4444', // rouge
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // rose
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
]

export const COLOR_PORTFOLIO = '#4f7cff'
export const COLOR_BENCHMARK = '#f59e0b'
export const COLOR_INVESTED = '#94a3b8'
export const COLOR_POSITIVE = '#22c55e'
export const COLOR_NEGATIVE = '#ef4444'

export function colorAt(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}
