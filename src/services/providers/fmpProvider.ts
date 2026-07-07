import type {
  AnalystConsensus,
  AnalystRecommendation,
  Asset,
  CompanyNewsItem,
  DividendEvent,
  MarketPrice,
  NextEarnings,
  PriceTarget,
  StockSplit,
} from '../../types'
import type { CacheParams, DataCapability, DataProvider } from './types'
import { computeRating } from '../consensus'

// ---------------------------------------------------------------------------
// Financial Modeling Prep (FMP) — provider de FALLBACK (marché + analyse).
// Désactivé automatiquement si VITE_FMP_API_KEY est absente.
// Les endpoints réservés au plan payant (402/403) sont traités comme erreurs
// contrôlées (le service les met en cache ERROR pour ne pas re-consommer).
// ---------------------------------------------------------------------------

const FMP_KEY = (import.meta.env.VITE_FMP_API_KEY as string | undefined)?.trim()
const V3 = 'https://financialmodelingprep.com/api/v3'
const V4 = 'https://financialmodelingprep.com/api/v4'

/** FMP utilise des suffixes proches de Finnhub (.PA, .AS, .DE…). */
function symbolFor(asset: Asset): string {
  return asset.finnhubSymbol?.trim() || asset.ticker.trim()
}

async function getJson<T>(url: string): Promise<T> {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}apikey=${encodeURIComponent(FMP_KEY ?? '')}`)
  // 402 (plan insuffisant), 403, 429 (quota) → erreur contrôlée.
  if (!res.ok) throw new Error(`FMP ${res.status}`)
  const json = (await res.json()) as T
  // FMP renvoie parfois {"Error Message": "..."} avec un 200.
  if (json && typeof json === 'object' && 'Error Message' in (json as Record<string, unknown>)) {
    throw new Error(`FMP: ${(json as Record<string, string>)['Error Message']}`)
  }
  return json
}

// --- Market data provider --------------------------------------------------
const MARKET_CAPS: DataCapability[] = ['LATEST_PRICE', 'HISTORICAL_PRICES', 'DIVIDENDS', 'SPLITS']

export const fmpMarketDataProvider: DataProvider = {
  name: 'fmp',
  capabilities: MARKET_CAPS,
  isEnabled: () => Boolean(FMP_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset, params: CacheParams): Promise<unknown> {
    const symbol = symbolFor(asset)

    switch (capability) {
      case 'LATEST_PRICE': {
        const rows = await getJson<Array<{ price?: number }>>(`${V3}/quote-short/${encodeURIComponent(symbol)}`)
        const price = rows?.[0]?.price
        if (typeof price !== 'number' || price <= 0) return null
        const mp: MarketPrice = {
          assetId: asset.id,
          date: new Date().toISOString().slice(0, 10),
          close: price,
          currency: asset.currency,
        }
        return mp
      }

      case 'HISTORICAL_PRICES': {
        const from = String(params.from ?? '')
        const to = String(params.to ?? '')
        const json = await getJson<{ historical?: Array<{ date: string; adjClose?: number; close?: number }> }>(
          `${V3}/historical-price-full/${encodeURIComponent(symbol)}?from=${from}&to=${to}`,
        )
        const rows = json.historical ?? []
        return rows
          .map<MarketPrice>((r) => ({
            assetId: asset.id,
            date: r.date,
            close: r.adjClose ?? r.close ?? 0,
            currency: asset.currency,
          }))
          .sort((a, b) => (a.date < b.date ? -1 : 1))
      }

      case 'DIVIDENDS': {
        const json = await getJson<{ historical?: Array<{ date: string; dividend?: number; adjDividend?: number; paymentDate?: string }> }>(
          `${V3}/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}`,
        )
        const rows = json.historical ?? []
        return rows.map<DividendEvent>((r, i) => ({
          id: `fmp-${asset.id}-${i}`,
          userId: asset.userId,
          assetId: asset.id,
          exDate: r.date,
          paymentDate: r.paymentDate || undefined,
          amountPerShare: r.adjDividend ?? r.dividend ?? 0,
          currency: asset.currency,
          createdAt: new Date().toISOString(),
        }))
      }

      case 'SPLITS': {
        const json = await getJson<{ historical?: Array<{ date: string; numerator?: number; denominator?: number }> }>(
          `${V3}/historical-price-full/stock_split/${encodeURIComponent(symbol)}`,
        )
        const rows = json.historical ?? []
        return rows.map<StockSplit>((r) => ({
          assetId: asset.id,
          date: r.date,
          numerator: r.numerator || 1,
          denominator: r.denominator || 1,
        }))
      }

      default:
        return null
    }
  },
}

// --- Analysis provider -----------------------------------------------------
const ANALYSIS_CAPS: DataCapability[] = [
  'ANALYST_CONSENSUS',
  'PRICE_TARGET',
  'RECOMMENDATION_TRENDS',
  'NEWS',
  'NEXT_EARNINGS',
]

type FmpRecRow = {
  date: string
  analystRatingsStrongBuy?: number
  analystRatingsbuy?: number
  analystRatingsHold?: number
  analystRatingsSell?: number
  analystRatingsStrongSell?: number
}

async function fmpTrends(asset: Asset, symbol: string): Promise<AnalystRecommendation[]> {
  const rows = await getJson<FmpRecRow[]>(`${V3}/analyst-stock-recommendations/${encodeURIComponent(symbol)}`)
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      assetId: asset.id,
      symbol,
      period: r.date,
      strongBuy: r.analystRatingsStrongBuy ?? 0,
      buy: r.analystRatingsbuy ?? 0,
      hold: r.analystRatingsHold ?? 0,
      sell: r.analystRatingsSell ?? 0,
      strongSell: r.analystRatingsStrongSell ?? 0,
    }))
    .sort((a, b) => ((a.period ?? '') < (b.period ?? '') ? 1 : -1))
}

export const fmpAnalysisProvider: DataProvider = {
  name: 'fmp',
  capabilities: ANALYSIS_CAPS,
  isEnabled: () => Boolean(FMP_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset): Promise<unknown> {
    const symbol = symbolFor(asset)

    switch (capability) {
      case 'RECOMMENDATION_TRENDS':
        return fmpTrends(asset, symbol)

      case 'ANALYST_CONSENSUS': {
        const trends = await fmpTrends(asset, symbol)
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

      case 'PRICE_TARGET': {
        type PT = { targetHigh?: number; targetLow?: number; targetConsensus?: number; targetMedian?: number }
        const json = await getJson<PT>(`${V4}/price-target-consensus?symbol=${encodeURIComponent(symbol)}`)
        const pt = Array.isArray(json) ? (json[0] as PT) : json
        if (!pt || (pt.targetConsensus == null && pt.targetMedian == null && pt.targetHigh == null && pt.targetLow == null)) {
          return null
        }
        const target: PriceTarget = {
          assetId: asset.id,
          symbol,
          targetHigh: pt.targetHigh,
          targetLow: pt.targetLow,
          targetMean: pt.targetConsensus,
          targetMedian: pt.targetMedian,
          currency: asset.currency,
          updatedAt: new Date().toISOString(),
        }
        return target
      }

      case 'NEWS': {
        type Row = { title: string; text?: string; site?: string; url?: string; publishedDate?: string; image?: string }
        const rows = await getJson<Row[]>(`${V3}/stock_news?tickers=${encodeURIComponent(symbol)}&limit=10`)
        if (!Array.isArray(rows)) return []
        return rows.slice(0, 10).map<CompanyNewsItem>((r, i) => ({
          id: `fmp-news-${asset.id}-${i}`,
          assetId: asset.id,
          headline: r.title,
          source: r.site,
          url: r.url,
          datetime: r.publishedDate ? new Date(r.publishedDate).toISOString() : undefined,
          summary: r.text,
          image: r.image,
        }))
      }

      case 'NEXT_EARNINGS': {
        type Row = { date: string; epsEstimated?: number | null; time?: string }
        const rows = await getJson<Row[]>(`${V3}/historical/earning_calendar/${encodeURIComponent(symbol)}`)
        if (!Array.isArray(rows)) return null
        const today = new Date().toISOString().slice(0, 10)
        const next = rows
          .filter((r) => r.date && r.date >= today)
          .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
        if (!next) return null
        const ne: NextEarnings = {
          assetId: asset.id,
          symbol,
          date: next.date,
          epsEstimate: next.epsEstimated ?? undefined,
          hour: next.time,
        }
        return ne
      }

      default:
        return null
    }
  },
}
