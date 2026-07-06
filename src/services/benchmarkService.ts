import type { Asset, MarketPrice, Transaction } from '../types'
import { getHistoricalPrices } from './marketDataService'
import { DEFAULT_FX, monthEndDates, toEur, type FxTable } from './portfolioCalculator'

// ---------------------------------------------------------------------------
// Benchmark MSCI World.
// Approche : on simule l'investissement des MÊMES flux de trésorerie nets
// (dépôts − retraits) dans l'ETF benchmark, aux cours historiques.
// La courbe benchmark représente donc "et si j'avais tout mis en MSCI World".
// ---------------------------------------------------------------------------

export const DEFAULT_BENCHMARK_SYMBOL =
  (import.meta.env.VITE_DEFAULT_BENCHMARK as string | undefined)?.trim() || 'CW8.PA'

/** Construit un pseudo-Asset pour interroger le service de données de marché. */
export function buildBenchmarkAsset(symbol: string): Asset {
  const currency = symbol.endsWith('.US') || symbol === 'URTH' ? 'USD' : 'EUR'
  return {
    id: `benchmark-${symbol}`,
    userId: 'benchmark',
    name: `Benchmark ${symbol}`,
    ticker: symbol.split('.')[0],
    exchange: symbol.split('.')[1],
    currency,
    type: 'ETF',
    eodhdSymbol: symbol,
    createdAt: new Date().toISOString(),
  }
}

function priceOnOrBefore(series: MarketPrice[], date: string): number | null {
  let result: number | null = null
  for (const p of series) {
    if (p.date <= date) result = p.close
    else break
  }
  return result
}

export interface BenchmarkPoint {
  date: string
  benchmark: number
}

export async function computeBenchmarkSeries(
  transactions: Transaction[],
  symbol: string = DEFAULT_BENCHMARK_SYMBOL,
  fx: FxTable = DEFAULT_FX,
): Promise<BenchmarkPoint[]> {
  if (transactions.length === 0) return []
  const first = transactions.reduce((m, t) => (t.date < m ? t.date : m), transactions[0].date)
  const today = new Date().toISOString().slice(0, 10)

  const asset = buildBenchmarkAsset(symbol)
  const { data: prices } = await getHistoricalPrices(asset, first, today)
  if (!prices || prices.length === 0) return []

  // Flux nets (EUR) datés.
  const flows = transactions
    .filter((t) => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
    .map((t) => ({
      date: t.date,
      amount: (t.type === 'DEPOSIT' ? 1 : -1) * toEur(t.amount ?? 0, t.currency, fx),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const dates = monthEndDates(first, today)
  const out: BenchmarkPoint[] = []
  let units = 0
  let flowIdx = 0

  for (const date of dates) {
    // Applique les flux jusqu'à cette date.
    while (flowIdx < flows.length && flows[flowIdx].date <= date) {
      const price = priceOnOrBefore(prices, flows[flowIdx].date)
      if (price && price > 0) {
        // Prix du benchmark converti en EUR pour rester cohérent avec les flux EUR.
        const priceEur = toEur(price, asset.currency, fx)
        units += flows[flowIdx].amount / priceEur
      }
      flowIdx++
    }
    const priceAtDate = priceOnOrBefore(prices, date)
    const valueEur = priceAtDate != null ? units * toEur(priceAtDate, asset.currency, fx) : 0
    out.push({ date, benchmark: Math.round(valueEur * 100) / 100 })
  }
  return out
}
