import type { Asset, DividendEvent, MarketPrice, StockSplit } from '../types'
import { fetchWithFallback } from './apiCacheService'
import type { DataProvider, SourcedResult } from './providers/types'
import { eodhdProvider } from './providers/eodhdProvider'
import { fmpMarketDataProvider } from './providers/fmpProvider'
import { mockMarketDataProvider } from './providers/mockProvider'

// ---------------------------------------------------------------------------
// marketDataService — cours, historique, dividendes, splits.
// Orchestrateur multi-provider (ne parle jamais directement à une API depuis un
// composant). Ordre de fallback : EODHD → FMP → Mock.
// STRICTEMENT séparé de analysisService.
// ---------------------------------------------------------------------------

const MARKET_PROVIDERS: DataProvider[] = [eodhdProvider, fmpMarketDataProvider, mockMarketDataProvider]

export const isEodhdConfigured = eodhdProvider.isEnabled()
export const isFmpConfigured = fmpMarketDataProvider.isEnabled()

export type MarketDataMode = 'EODHD' | 'FMP' | 'MOCK'
export const marketDataMode: MarketDataMode = isEodhdConfigured
  ? 'EODHD'
  : isFmpConfigured
    ? 'FMP'
    : 'MOCK'

export function getLatestPrice(asset: Asset): Promise<SourcedResult<MarketPrice>> {
  return fetchWithFallback<MarketPrice>('LATEST_PRICE', asset, {}, MARKET_PROVIDERS)
}

export function getHistoricalPrices(
  asset: Asset,
  from: string,
  to: string,
): Promise<SourcedResult<MarketPrice[]>> {
  return fetchWithFallback<MarketPrice[]>(
    'HISTORICAL_PRICES',
    asset,
    { from, to, resolution: '1d' },
    MARKET_PROVIDERS,
  )
}

export function getDividends(asset: Asset): Promise<SourcedResult<DividendEvent[]>> {
  return fetchWithFallback<DividendEvent[]>('DIVIDENDS', asset, {}, MARKET_PROVIDERS)
}

export function getSplits(asset: Asset): Promise<SourcedResult<StockSplit[]>> {
  return fetchWithFallback<StockSplit[]>('SPLITS', asset, {}, MARKET_PROVIDERS)
}
