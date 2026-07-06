import type { Asset, Position, Transaction } from '../types'
import { DEFAULT_FX, toEur, type FxTable } from '../services/portfolioCalculator'
import type { AllocationSlice } from '../components/charts/AllocationPie'
import type { MonthlyPoint } from '../components/charts/MonthlyBarChart'
import type { CumulativePoint } from '../components/charts/CumulativeAreaChart'

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** Dividendes reçus par mois (EUR). */
export function dividendsByMonth(transactions: Transaction[], fx: FxTable = DEFAULT_FX): MonthlyPoint[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'DIVIDEND') continue
    const k = monthKey(t.date)
    map.set(k, (map.get(k) ?? 0) + toEur(t.amount ?? 0, t.currency, fx))
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, value]) => ({ month, value: Math.round(value * 100) / 100 }))
}

/** Frais cumulés par mois (EUR). */
export function feesCumulativeByMonth(transactions: Transaction[], fx: FxTable = DEFAULT_FX): CumulativePoint[] {
  const monthly = new Map<string, number>()
  for (const t of transactions) {
    const k = monthKey(t.date)
    let fee = toEur(t.fees ?? 0, t.currency, fx)
    if (t.type === 'FEE') fee += toEur(t.amount ?? 0, t.currency, fx)
    if (fee) monthly.set(k, (monthly.get(k) ?? 0) + fee)
  }
  const sorted = [...monthly.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  let cumul = 0
  return sorted.map(([month, v]) => {
    cumul += v
    return { month, value: Math.round(cumul * 100) / 100 }
  })
}

/** Frais par mois (non cumulés). */
export function feesByMonth(transactions: Transaction[], fx: FxTable = DEFAULT_FX): MonthlyPoint[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    const k = monthKey(t.date)
    let fee = toEur(t.fees ?? 0, t.currency, fx)
    if (t.type === 'FEE') fee += toEur(t.amount ?? 0, t.currency, fx)
    if (fee) map.set(k, (map.get(k) ?? 0) + fee)
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, value]) => ({ month, value: Math.round(value * 100) / 100 }))
}

/** Dividendes reçus par actif (EUR). */
export function dividendsByAsset(
  transactions: Transaction[],
  assets: Asset[],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'DIVIDEND' || !t.assetId) continue
    const name = assetMap.get(t.assetId)?.name ?? 'Inconnu'
    map.set(name, (map.get(name) ?? 0) + toEur(t.amount ?? 0, t.currency, fx))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

/** Frais par compte (EUR). */
export function feesByAccount(
  transactions: Transaction[],
  accountName: (id: string) => string,
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    let fee = toEur(t.fees ?? 0, t.currency, fx)
    if (t.type === 'FEE') fee += toEur(t.amount ?? 0, t.currency, fx)
    if (fee) map.set(t.accountId, (map.get(t.accountId) ?? 0) + fee)
  }
  return [...map.entries()].map(([id, value]) => ({ name: accountName(id), value: Math.round(value * 100) / 100 }))
}

// --- Allocations (valeur EUR des positions) --------------------------------
function allocationBy(positions: Position[], keyFn: (p: Position) => string, fx: FxTable): AllocationSlice[] {
  const map = new Map<string, number>()
  for (const p of positions) {
    if (p.currentValue == null || p.quantity <= 0) continue
    const key = keyFn(p)
    map.set(key, (map.get(key) ?? 0) + toEur(p.currentValue, p.currency, fx))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

export function allocationByAccount(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.account.name, fx)
}
export function allocationByType(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  const label: Record<string, string> = { STOCK: 'Action', ETF: 'ETF', CASH: 'Cash' }
  return allocationBy(positions, (p) => label[p.asset.type] ?? p.asset.type, fx)
}
export function allocationByCurrency(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.currency, fx)
}
export function allocationBySector(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.asset.sector ?? 'Non renseigné', fx)
}
export function allocationByCountry(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.asset.country ?? 'Non renseigné', fx)
}
