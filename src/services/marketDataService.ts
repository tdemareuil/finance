import type { Asset, DividendEvent, MarketPrice, StockSplit } from '../types'
import { fetchWithFallback } from './apiCacheService'
import type { DataProvider, SourcedResult } from './providers/types'
import { eodhdProvider } from './providers/eodhdProvider'
import { fmpMarketDataProvider } from './providers/fmpProvider'
import { mockMarketDataProvider } from './providers/mockProvider'
import { getMockEurUsd } from '../data'

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

// ---------------------------------------------------------------------------
// Cours EUR/USD (USD pour 1 EUR) — série quotidienne pour le graphe des
// paramètres. Les providers utilisent des symboles forex différents, donc on
// interroge directement (EODHD → FMP), avec repli mock déterministe. Résultat
// mis en cache 12 h dans le localStorage pour éviter les appels répétés.
// ---------------------------------------------------------------------------

const EODHD_KEY = (import.meta.env.VITE_EODHD_API_KEY as string | undefined)?.trim()
const FMP_KEY = (import.meta.env.VITE_FMP_API_KEY as string | undefined)?.trim()

export interface FxPoint {
  date: string
  /** Cours EUR/USD : nombre de dollars pour 1 euro. */
  rate: number
}
export interface FxSeries {
  points: FxPoint[]
  source: 'EODHD' | 'FMP' | 'MOCK'
}

const FX_CACHE_PREFIX = 'eurusd-series:'
const FX_TTL_MS = 12 * 60 * 60 * 1000

function fxCacheGet(key: string): FxSeries | undefined {
  try {
    const raw = localStorage.getItem(FX_CACHE_PREFIX + key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { t: number; v: FxSeries }
    if (Date.now() - parsed.t > FX_TTL_MS) {
      localStorage.removeItem(FX_CACHE_PREFIX + key)
      return undefined
    }
    return parsed.v
  } catch {
    return undefined
  }
}
function fxCacheSet(key: string, value: FxSeries): void {
  try {
    localStorage.setItem(FX_CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    /* ignore */
  }
}

async function fetchEodhdEurUsd(from: string, to: string): Promise<FxPoint[] | null> {
  if (!EODHD_KEY) return null
  const res = await fetch(
    `https://eodhd.com/api/eod/EURUSD.FOREX?api_token=${encodeURIComponent(EODHD_KEY)}&fmt=json&from=${from}&to=${to}&period=d`,
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ date: string; adjusted_close?: number; close?: number }>
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows
    .map((r) => ({ date: r.date, rate: r.adjusted_close ?? r.close ?? 0 }))
    .filter((p) => p.rate > 0)
}

async function fetchFmpEurUsd(from: string, to: string): Promise<FxPoint[] | null> {
  if (!FMP_KEY) return null
  const res = await fetch(
    `https://financialmodelingprep.com/api/v3/historical-price-full/EURUSD?from=${from}&to=${to}&apikey=${encodeURIComponent(FMP_KEY)}`,
  )
  if (!res.ok) return null
  const json = (await res.json()) as { historical?: Array<{ date: string; adjClose?: number; close?: number }> }
  const rows = json.historical ?? []
  if (rows.length === 0) return null
  return rows
    .map((r) => ({ date: r.date, rate: r.adjClose ?? r.close ?? 0 }))
    .filter((p) => p.rate > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/**
 * Dernier cours EUR/USD connu (USD pour 1 EUR), ou null si indisponible.
 * S'appuie sur la série récente (donc sur le cache 12 h et les mêmes providers).
 */
export async function getLatestEurUsd(): Promise<number | null> {
  // Même fenêtre que le graphe EUR/USD (1 an) → partage du cache 12 h et
  // cohérence garantie entre la dernière valeur affichée et le cours utilisé.
  const to = new Date().toISOString().slice(0, 10)
  const fromDate = new Date()
  fromDate.setFullYear(fromDate.getFullYear() - 1)
  const from = fromDate.toISOString().slice(0, 10)
  try {
    const series = await getEurUsdSeries(from, to)
    const last = series.points.at(-1)
    return last && last.rate > 0 ? last.rate : null
  } catch {
    return null
  }
}

/** Série EUR/USD entre deux dates (ISO). Cache 12 h ; repli mock déterministe. */
export async function getEurUsdSeries(from: string, to: string): Promise<FxSeries> {
  const key = `${from}_${to}`
  const cached = fxCacheGet(key)
  if (cached) return cached

  let result: FxSeries | null = null
  try {
    const eod = await fetchEodhdEurUsd(from, to)
    if (eod && eod.length) result = { points: eod, source: 'EODHD' }
  } catch {
    /* fallback */
  }
  if (!result) {
    try {
      const fmp = await fetchFmpEurUsd(from, to)
      if (fmp && fmp.length) result = { points: fmp, source: 'FMP' }
    } catch {
      /* fallback */
    }
  }
  if (!result) result = { points: getMockEurUsd(from, to), source: 'MOCK' }

  fxCacheSet(key, result)
  return result
}
