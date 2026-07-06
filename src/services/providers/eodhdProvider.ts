import type { Asset, DividendEvent, MarketPrice, StockSplit } from '../../types'
import type { CacheParams, DataCapability, DataProvider } from './types'

// ---------------------------------------------------------------------------
// EODHDProvider — données de marché (cours, historique, dividendes, splits).
// Provider PRINCIPAL pour marketDataService.
// ---------------------------------------------------------------------------

const EODHD_KEY = (import.meta.env.VITE_EODHD_API_KEY as string | undefined)?.trim()
const BASE = 'https://eodhd.com/api'

function symbolFor(asset: Asset): string {
  if (asset.eodhdSymbol) return asset.eodhdSymbol
  if (asset.exchange) return `${asset.ticker}.${asset.exchange}`
  return asset.ticker
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  // Erreur contrôlée → on lève pour déclencher un cache ERROR (pas de retry immédiat).
  if (!res.ok) throw new Error(`EODHD ${res.status}`)
  return (await res.json()) as T
}

const CAPABILITIES: DataCapability[] = ['LATEST_PRICE', 'HISTORICAL_PRICES', 'DIVIDENDS', 'SPLITS']

export const eodhdProvider: DataProvider = {
  name: 'eodhd',
  capabilities: CAPABILITIES,
  isEnabled: () => Boolean(EODHD_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset, params: CacheParams): Promise<unknown> {
    const symbol = symbolFor(asset)
    const token = `api_token=${EODHD_KEY}&fmt=json`

    switch (capability) {
      case 'LATEST_PRICE': {
        const json = await getJson<{ close?: number }>(
          `${BASE}/real-time/${encodeURIComponent(symbol)}?${token}`,
        )
        if (typeof json.close !== 'number' || Number.isNaN(json.close)) return null
        const price: MarketPrice = {
          assetId: asset.id,
          date: new Date().toISOString().slice(0, 10),
          close: json.close,
          currency: asset.currency,
        }
        return price
      }

      case 'HISTORICAL_PRICES': {
        const from = String(params.from ?? '')
        const to = String(params.to ?? '')
        const rows = await getJson<Array<{ date: string; adjusted_close?: number; close?: number }>>(
          `${BASE}/eod/${encodeURIComponent(symbol)}?${token}&from=${from}&to=${to}&period=d`,
        )
        return rows.map<MarketPrice>((r) => ({
          assetId: asset.id,
          date: r.date,
          close: r.adjusted_close ?? r.close ?? 0,
          currency: asset.currency,
        }))
      }

      case 'DIVIDENDS': {
        const from = new Date()
        from.setFullYear(from.getFullYear() - 2)
        const rows = await getJson<Array<{ date: string; value: number; currency?: string; paymentDate?: string }>>(
          `${BASE}/div/${encodeURIComponent(symbol)}?${token}&from=${from.toISOString().slice(0, 10)}`,
        )
        return rows.map<DividendEvent>((r, i) => ({
          id: `eodhd-${asset.id}-${i}`,
          userId: asset.userId,
          assetId: asset.id,
          exDate: r.date,
          paymentDate: r.paymentDate,
          amountPerShare: r.value,
          currency: asset.currency,
          createdAt: new Date().toISOString(),
        }))
      }

      case 'SPLITS': {
        const rows = await getJson<Array<{ date: string; split: string }>>(
          `${BASE}/splits/${encodeURIComponent(symbol)}?${token}`,
        )
        return rows.map<StockSplit>((r) => {
          const [num, den] = (r.split ?? '1/1').split('/').map((n) => Number(n))
          return { assetId: asset.id, date: r.date, numerator: num || 1, denominator: den || 1 }
        })
      }

      default:
        return null
    }
  },
}
