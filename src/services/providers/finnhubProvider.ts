import type {
  AnalystConsensus,
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  MarketPrice,
} from '../../types'
import type { CacheParams, DataCapability, DataProvider } from './types'
import { computeRating } from '../consensus'

// ---------------------------------------------------------------------------
// FinnhubAnalysisProvider — consensus, tendances de recommandation, news,
// fondamentaux. Provider PRINCIPAL pour analysisService.
// (Finnhub n'expose pas d'objectif de cours gratuit → PRICE_TARGET non déclaré.)
// ---------------------------------------------------------------------------

const FINNHUB_KEY = (import.meta.env.VITE_FINNHUB_API_KEY as string | undefined)?.trim()
const BASE = 'https://finnhub.io/api/v1'

function symbolFor(asset: Asset): string {
  return asset.finnhubSymbol?.trim() || asset.ticker.trim()
}

async function getJson<T>(url: string): Promise<T> {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}token=${encodeURIComponent(FINNHUB_KEY ?? '')}`)
  if (!res.ok) throw new Error(`Finnhub ${res.status}`) // 401/403/429 → erreur contrôlée
  return (await res.json()) as T
}

type RecRow = { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }

async function fetchTrends(asset: Asset): Promise<AnalystRecommendation[]> {
  const symbol = symbolFor(asset)
  const data = await getJson<RecRow[]>(`${BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}`)
  if (!Array.isArray(data)) return []
  return data
    .map((r) => ({
      assetId: asset.id,
      symbol,
      period: r.period,
      strongBuy: r.strongBuy ?? 0,
      buy: r.buy ?? 0,
      hold: r.hold ?? 0,
      sell: r.sell ?? 0,
      strongSell: r.strongSell ?? 0,
    }))
    .sort((a, b) => ((a.period ?? '') < (b.period ?? '') ? 1 : -1))
}

const CAPABILITIES: DataCapability[] = [
  'ANALYST_CONSENSUS',
  'RECOMMENDATION_TRENDS',
  'NEWS',
  'FUNDAMENTALS',
]

export const finnhubProvider: DataProvider = {
  name: 'finnhub',
  capabilities: CAPABILITIES,
  isEnabled: () => Boolean(FINNHUB_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset, params: CacheParams): Promise<unknown> {
    const symbol = symbolFor(asset)

    switch (capability) {
      case 'RECOMMENDATION_TRENDS':
        return fetchTrends(asset)

      case 'ANALYST_CONSENSUS': {
        const trends = await fetchTrends(asset)
        if (trends.length === 0) return null
        const l = trends[0]
        const total = l.strongBuy + l.buy + l.hold + l.sell + l.strongSell
        if (total <= 0) return null
        const consensus: AnalystConsensus = {
          assetId: asset.id,
          symbol,
          period: l.period,
          strongBuy: l.strongBuy,
          buy: l.buy,
          hold: l.hold,
          sell: l.sell,
          strongSell: l.strongSell,
          total,
          rating: computeRating(l),
          updatedAt: new Date().toISOString(),
        }
        return consensus
      }

      case 'NEWS': {
        const from = String(params.from ?? '')
        const to = String(params.to ?? '')
        type Row = { id: number; headline: string; source?: string; url?: string; datetime?: number; summary?: string; image?: string }
        const rows = await getJson<Row[]>(
          `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
        )
        if (!Array.isArray(rows)) return []
        return rows
          .filter((r) => r.headline)
          .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
          .slice(0, 10)
          .map<CompanyNewsItem>((r) => ({
            id: `finnhub-${r.id}`,
            assetId: asset.id,
            headline: r.headline,
            source: r.source,
            url: r.url,
            datetime: r.datetime ? new Date(r.datetime * 1000).toISOString() : undefined,
            summary: r.summary,
            image: r.image,
          }))
      }

      case 'FUNDAMENTALS': {
        type Metric = Record<string, number | undefined>
        const data = await getJson<{ metric?: Metric }>(
          `${BASE}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
        )
        const m = data?.metric
        if (!m) return null
        const f: CompanyFundamentals = {
          assetId: asset.id,
          symbol,
          marketCapitalization: m.marketCapitalization,
          peNormalizedAnnual: m.peNormalizedAnnual,
          peBasicExclExtraTTM: m.peBasicExclExtraTTM,
          epsBasicExclExtraItemsTTM: m.epsBasicExclExtraItemsTTM,
          dividendYieldIndicatedAnnual: m.dividendYieldIndicatedAnnual,
          beta: m.beta,
          week52High: m['52WeekHigh'],
          week52Low: m['52WeekLow'],
          currency: asset.currency,
        }
        return f
      }

      default:
        return null
    }
  },
}

// ---------------------------------------------------------------------------
// FinnhubMarketDataProvider — cours temps réel (endpoint /quote gratuit).
// Sert de fallback marché (après Twelve Data et FMP). L'historique de cours
// (/stock/candle) étant réservé au plan payant, seul LATEST_PRICE est déclaré.
// ---------------------------------------------------------------------------

const MARKET_CAPS: DataCapability[] = ['LATEST_PRICE']

export const finnhubMarketDataProvider: DataProvider = {
  name: 'finnhub',
  capabilities: MARKET_CAPS,
  isEnabled: () => Boolean(FINNHUB_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset): Promise<unknown> {
    if (capability !== 'LATEST_PRICE') return null
    const symbol = symbolFor(asset)
    // /quote : { c: cours courant, ... }. c = 0 ⇒ symbole inconnu.
    const json = await getJson<{ c?: number }>(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}`)
    const close = typeof json.c === 'number' ? json.c : NaN
    if (!Number.isFinite(close) || close <= 0) return null
    const mp: MarketPrice = {
      assetId: asset.id,
      date: new Date().toISOString().slice(0, 10),
      close,
      currency: asset.currency,
    }
    return mp
  },
}
