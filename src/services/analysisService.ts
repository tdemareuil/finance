import type {
  AnalystConsensus,
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  PriceTarget,
} from '../types'
import { fetchWithFallback } from './apiCacheService'
import { computeRating } from './consensus'
import type { DataProvider, SourcedResult } from './providers/types'
import { finnhubProvider } from './providers/finnhubProvider'
import { fmpAnalysisProvider } from './providers/fmpProvider'
import { mockAnalysisProvider } from './providers/mockProvider'

// ---------------------------------------------------------------------------
// analysisService — consensus, objectifs de cours, tendances, news, fondamentaux.
// Orchestrateur multi-provider. Ordre de fallback : Finnhub → FMP → Mock.
// STRICTEMENT séparé de marketDataService.
// ---------------------------------------------------------------------------

const ANALYSIS_PROVIDERS: DataProvider[] = [finnhubProvider, fmpAnalysisProvider, mockAnalysisProvider]

export const isFinnhubConfigured = finnhubProvider.isEnabled()
export const isFmpConfigured = fmpAnalysisProvider.isEnabled()

export type AnalysisMode = 'FINNHUB' | 'FMP' | 'MOCK'
export const analysisMode: AnalysisMode = isFinnhubConfigured
  ? 'FINNHUB'
  : isFmpConfigured
    ? 'FMP'
    : 'MOCK'

export { computeRating }

export function getRecommendationTrends(asset: Asset): Promise<SourcedResult<AnalystRecommendation[]>> {
  return fetchWithFallback<AnalystRecommendation[]>('RECOMMENDATION_TRENDS', asset, {}, ANALYSIS_PROVIDERS)
}

/**
 * Consensus dérivé de la période la plus récente des tendances de recommandation.
 * On réutilise getRecommendationTrends → même clé de cache : aucun appel réseau
 * supplémentaire (et déduplication in-flight si les deux sont demandés en parallèle).
 */
export async function getConsensus(asset: Asset): Promise<SourcedResult<AnalystConsensus>> {
  const { data: trends, source } = await getRecommendationTrends(asset)
  if (!trends || trends.length === 0) return { data: null, source: 'none' }
  const l = trends[0]
  const total = l.strongBuy + l.buy + l.hold + l.sell + l.strongSell
  if (total <= 0) return { data: null, source: 'none' }
  const consensus: AnalystConsensus = {
    assetId: asset.id,
    symbol: l.symbol,
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
  return { data: consensus, source }
}

export function getPriceTarget(asset: Asset): Promise<SourcedResult<PriceTarget>> {
  return fetchWithFallback<PriceTarget>('PRICE_TARGET', asset, {}, ANALYSIS_PROVIDERS)
}

export function getNews(asset: Asset): Promise<SourcedResult<CompanyNewsItem[]>> {
  const to = new Date().toISOString().slice(0, 10)
  const fromD = new Date()
  fromD.setDate(fromD.getDate() - 30)
  const from = fromD.toISOString().slice(0, 10)
  return fetchWithFallback<CompanyNewsItem[]>('NEWS', asset, { from, to }, ANALYSIS_PROVIDERS)
}

export function getFundamentals(asset: Asset): Promise<SourcedResult<CompanyFundamentals>> {
  return fetchWithFallback<CompanyFundamentals>('FUNDAMENTALS', asset, {}, ANALYSIS_PROVIDERS)
}
