import type {
  AnalystConsensus,
  AnalystRating,
  AnalystRecommendation,
  Asset,
  CompanyFundamentals,
  CompanyNewsItem,
  PriceTarget,
} from '../types'
import {
  getMockCompanyFundamentals,
  getMockCompanyNews,
  getMockPriceTarget,
  getMockRecommendationTrends,
} from '../data/mockAnalysisData'

// ---------------------------------------------------------------------------
// analysisService — consensus analystes, objectifs de cours, tendances de
// recommandation, actualités, fondamentaux.
//
// STRICTEMENT SÉPARÉ de marketDataService (cours/historique/dividendes/splits).
//
// Source : Finnhub (https://finnhub.io). Sans clé → données mock déterministes.
// Ne lève jamais d'exception : retourne null / [] en cas d'indisponibilité.
// Cache LocalStorage avec expiration de 12 h pour limiter les appels API.
// ---------------------------------------------------------------------------

const FINNHUB_KEY = (import.meta.env.VITE_FINNHUB_API_KEY as string | undefined)?.trim()
const BASE = 'https://finnhub.io/api/v1'

export const isFinnhubConfigured = Boolean(FINNHUB_KEY)
export type AnalysisMode = 'FINNHUB' | 'MOCK'
export const analysisMode: AnalysisMode = isFinnhubConfigured ? 'FINNHUB' : 'MOCK'

/** Symbole Finnhub à utiliser : finnhubSymbol, sinon fallback sur ticker. */
export function finnhubSymbolFor(asset: Asset): string {
  return asset.finnhubSymbol?.trim() || asset.ticker.trim()
}

// --- Cache LocalStorage (TTL 12 h) -----------------------------------------
const CACHE_PREFIX = 'finnhub-cache:'
const TTL_MS = 12 * 60 * 60 * 1000

function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { t: number; v: T }
    if (Date.now() - parsed.t > TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return undefined
    }
    return parsed.v
  } catch {
    return undefined
  }
}

function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    /* quota / mode privé — on ignore */
  }
}

/** Appel Finnhub tolérant aux erreurs (retourne null si échec / non configuré). */
async function finnhubGet<T>(path: string): Promise<T | null> {
  if (!FINNHUB_KEY) return null
  try {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${BASE}${path}${sep}token=${encodeURIComponent(FINNHUB_KEY)}`)
    if (!res.ok) return null // 401/403 (premium)/429 (rate limit)/… → indisponible
    return (await res.json()) as T
  } catch {
    return null
  }
}

// --- Logique de consensus --------------------------------------------------
interface RecCounts {
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

/**
 * Note synthétique à partir des comptages de recommandation.
 * "Majoritaire" est interprété comme le bucket le plus nombreux (pluralité).
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

// --- Tendances de recommandation -------------------------------------------
export async function getRecommendationTrends(asset: Asset): Promise<AnalystRecommendation[]> {
  const symbol = finnhubSymbolFor(asset)

  if (!isFinnhubConfigured) return getMockRecommendationTrends(asset)

  const cacheKey = `rec:${symbol}`
  const cached = cacheGet<AnalystRecommendation[]>(cacheKey)
  if (cached) return cached.map((r) => ({ ...r, assetId: asset.id }))

  type Row = {
    period: string
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
  }
  const data = await finnhubGet<Row[]>(`/stock/recommendation?symbol=${encodeURIComponent(symbol)}`)
  if (!Array.isArray(data)) return []

  const trends: AnalystRecommendation[] = data
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
    .sort((a, b) => (a.period ?? '') < (b.period ?? '') ? 1 : -1)

  cacheSet(cacheKey, trends)
  return trends
}

// --- Consensus (dérivé de la période la plus récente) ----------------------
export async function getAnalystConsensus(asset: Asset): Promise<AnalystConsensus | null> {
  const trends = await getRecommendationTrends(asset)
  if (trends.length === 0) return null
  const latest = trends[0]
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
  if (total <= 0) return null
  return {
    assetId: asset.id,
    symbol: finnhubSymbolFor(asset),
    period: latest.period,
    strongBuy: latest.strongBuy,
    buy: latest.buy,
    hold: latest.hold,
    sell: latest.sell,
    strongSell: latest.strongSell,
    total,
    rating: computeRating(latest),
    updatedAt: new Date().toISOString(),
  }
}

// --- Objectifs de cours ----------------------------------------------------
export async function getPriceTarget(asset: Asset): Promise<PriceTarget | null> {
  const symbol = finnhubSymbolFor(asset)

  if (!isFinnhubConfigured) return getMockPriceTarget(asset)

  const cacheKey = `pt:${symbol}`
  const cached = cacheGet<PriceTarget>(cacheKey)
  if (cached) return { ...cached, assetId: asset.id }

  type PT = {
    targetHigh?: number
    targetLow?: number
    targetMean?: number
    targetMedian?: number
    lastUpdated?: string
  }
  // Endpoint premium sur le plan gratuit : peut renvoyer null (géré proprement).
  const data = await finnhubGet<PT>(`/stock/price-target?symbol=${encodeURIComponent(symbol)}`)
  if (!data || (!data.targetMean && !data.targetHigh && !data.targetLow && !data.targetMedian)) {
    return null
  }
  const target: PriceTarget = {
    assetId: asset.id,
    symbol,
    targetHigh: data.targetHigh,
    targetLow: data.targetLow,
    targetMean: data.targetMean,
    targetMedian: data.targetMedian,
    currency: asset.currency,
    updatedAt: data.lastUpdated ?? new Date().toISOString(),
  }
  cacheSet(cacheKey, target)
  return target
}

// --- Actualités ------------------------------------------------------------
export async function getCompanyNews(asset: Asset): Promise<CompanyNewsItem[]> {
  const symbol = finnhubSymbolFor(asset)

  if (!isFinnhubConfigured) return getMockCompanyNews(asset)

  const cacheKey = `news:${symbol}`
  const cached = cacheGet<CompanyNewsItem[]>(cacheKey)
  if (cached) return cached.map((n) => ({ ...n, assetId: asset.id }))

  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  type Row = {
    id: number
    headline: string
    source?: string
    url?: string
    datetime?: number
    summary?: string
    image?: string
  }
  const data = await finnhubGet<Row[]>(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}`,
  )
  if (!Array.isArray(data)) return []

  const news: CompanyNewsItem[] = data
    .filter((r) => r.headline)
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, 10)
    .map((r) => ({
      id: `finnhub-${r.id}`,
      assetId: asset.id,
      headline: r.headline,
      source: r.source,
      url: r.url,
      datetime: r.datetime ? new Date(r.datetime * 1000).toISOString() : undefined,
      summary: r.summary,
      image: r.image,
    }))

  cacheSet(cacheKey, news)
  return news
}

// --- Fondamentaux ----------------------------------------------------------
export async function getCompanyFundamentals(asset: Asset): Promise<CompanyFundamentals | null> {
  const symbol = finnhubSymbolFor(asset)

  if (!isFinnhubConfigured) return getMockCompanyFundamentals(asset)

  const cacheKey = `metric:${symbol}`
  const cached = cacheGet<CompanyFundamentals>(cacheKey)
  if (cached) return { ...cached, assetId: asset.id }

  type Metric = Record<string, number | undefined>
  const data = await finnhubGet<{ metric?: Metric }>(
    `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
  )
  const m = data?.metric
  if (!m) return null

  const fundamentals: CompanyFundamentals = {
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
  // Si tout est vide, considérer comme indisponible.
  const hasAny = Object.entries(fundamentals).some(
    ([k, v]) => !['assetId', 'symbol', 'currency'].includes(k) && v != null,
  )
  if (!hasAny) return null

  cacheSet(cacheKey, fundamentals)
  return fundamentals
}
