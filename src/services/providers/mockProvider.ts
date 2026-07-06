import type { Asset, AnalystConsensus, MarketPrice, StockSplit } from '../../types'
import type { CacheParams, DataCapability, DataProvider } from './types'
import { computeRating } from '../consensus'
import {
  getMockDividendEvents,
  getMockHistoricalPrices,
  getMockLatestPrice,
} from '../../data/mockMarketData'
import {
  getMockCompanyFundamentals,
  getMockCompanyNews,
  getMockPriceTarget,
  getMockRecommendationTrends,
} from '../../data/mockAnalysisData'

// ---------------------------------------------------------------------------
// MockProvider — dernier recours (toujours activé). Données déterministes.
// Deux objets : marché et analyse. Garantit que le prototype fonctionne sans
// aucune clé API.
// ---------------------------------------------------------------------------

function symbolFor(asset: Asset): string {
  return asset.finnhubSymbol?.trim() || asset.eodhdSymbol?.trim() || asset.ticker.trim()
}

const MARKET_CAPS: DataCapability[] = ['LATEST_PRICE', 'HISTORICAL_PRICES', 'DIVIDENDS', 'SPLITS']

export const mockMarketDataProvider: DataProvider = {
  name: 'mock',
  capabilities: MARKET_CAPS,
  isEnabled: () => true,
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset, params: CacheParams): Promise<unknown> {
    const symbol = symbolFor(asset)
    const today = new Date().toISOString().slice(0, 10)

    switch (capability) {
      case 'LATEST_PRICE': {
        const p = getMockLatestPrice(symbol, today)
        const mp: MarketPrice = { assetId: asset.id, date: p.date, close: p.close, currency: asset.currency }
        return mp
      }
      case 'HISTORICAL_PRICES': {
        const from = String(params.from ?? today)
        const to = String(params.to ?? today)
        return getMockHistoricalPrices(symbol, from, to).map<MarketPrice>((p) => ({
          assetId: asset.id,
          date: p.date,
          close: p.close,
          currency: asset.currency,
        }))
      }
      case 'DIVIDENDS':
        return getMockDividendEvents(symbol, today).map((d, i) => ({
          id: `mock-${asset.id}-${i}`,
          userId: asset.userId,
          assetId: asset.id,
          exDate: d.exDate,
          paymentDate: d.paymentDate,
          amountPerShare: d.amountPerShare,
          currency: asset.currency,
          createdAt: new Date().toISOString(),
        }))
      case 'SPLITS':
        return [] as StockSplit[] // pas de splits fictifs
      default:
        return null
    }
  },
}

const ANALYSIS_CAPS: DataCapability[] = [
  'ANALYST_CONSENSUS',
  'PRICE_TARGET',
  'RECOMMENDATION_TRENDS',
  'NEWS',
  'FUNDAMENTALS',
]

export const mockAnalysisProvider: DataProvider = {
  name: 'mock',
  capabilities: ANALYSIS_CAPS,
  isEnabled: () => true,
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset): Promise<unknown> {
    switch (capability) {
      case 'RECOMMENDATION_TRENDS':
        return getMockRecommendationTrends(asset)
      case 'ANALYST_CONSENSUS': {
        const trends = getMockRecommendationTrends(asset)
        if (trends.length === 0) return null
        const l = trends[0]
        const total = l.strongBuy + l.buy + l.hold + l.sell + l.strongSell
        if (total <= 0) return null
        const consensus: AnalystConsensus = {
          assetId: asset.id,
          symbol: symbolFor(asset),
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
      case 'PRICE_TARGET':
        return getMockPriceTarget(asset)
      case 'NEWS':
        return getMockCompanyNews(asset)
      case 'FUNDAMENTALS':
        return getMockCompanyFundamentals(asset)
      default:
        return null
    }
  },
}
