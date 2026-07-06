import type { AnalystRating } from '../types'

interface RecCounts {
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

/**
 * Note synthétique à partir des comptages de recommandation.
 * "Majoritaire" = bucket le plus nombreux (pluralité).
 *  - buy (strongBuy+buy) ≥ 70 %  → STRONG_BUY
 *  - buy ≥ 50 %                   → BUY
 *  - hold majoritaire             → HOLD
 *  - sell (sell+strongSell) ≥ 50% → SELL
 *  - strongSell majoritaire       → STRONG_SELL
 *  - sinon                        → UNKNOWN
 */
export function computeRating(c: RecCounts): AnalystRating {
  const total = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell
  if (total <= 0) return 'UNKNOWN'
  const buyShare = (c.strongBuy + c.buy) / total
  const sellShare = (c.sell + c.strongSell) / total
  const max = Math.max(c.strongBuy, c.buy, c.hold, c.sell, c.strongSell)

  if (buyShare >= 0.7) return 'STRONG_BUY'
  if (buyShare >= 0.5) return 'BUY'
  if (c.hold === max) return 'HOLD'
  if (sellShare >= 0.5) return 'SELL'
  if (c.strongSell === max) return 'STRONG_SELL'
  return 'UNKNOWN'
}
