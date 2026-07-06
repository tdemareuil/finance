import type { Asset } from '../types'

// ---------------------------------------------------------------------------
// Classification de risque (heuristique, sans champ dédié en base) :
//   - CASH / Livret  → Faible
//   - ETF (diversifié) → Modéré
//   - Action (titre vif) → Élevé
// ---------------------------------------------------------------------------

export type RiskLevel = 'Faible' | 'Modéré' | 'Élevé'

/** Ordre d'affichage croissant du risque. */
export const RISK_ORDER: RiskLevel[] = ['Faible', 'Modéré', 'Élevé']

export function assetRisk(asset: Asset): RiskLevel {
  if (asset.type === 'CASH') return 'Faible'
  if (asset.type === 'ETF') return 'Modéré'
  return 'Élevé'
}
