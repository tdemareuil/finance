import type { Asset, CompanyFundamentals, MarketPrice, PriceTarget } from '../types'
import type {
  CacheParams,
  DataCapability,
  DataProvider,
  ProviderName,
  SourcedResult,
} from './providers/types'

// ---------------------------------------------------------------------------
// Cache API générique + déduplication des requêtes en cours + fallback.
// Objectif : ne jamais consommer inutilement de crédits API.
//  - cache mémoire + LocalStorage, TTL par type de donnée ;
//  - cache aussi les résultats VIDES et les ERREURS contrôlées ;
//  - mutualise les requêtes identiques simultanées (in-flight) ;
//  - fallback ordonné entre providers, arrêt dès qu'une donnée valide est trouvée.
// ---------------------------------------------------------------------------

export type CacheStatus = 'HIT' | 'MISS' | 'EMPTY' | 'ERROR'

export interface CachedApiResult<T> {
  key: string
  provider: ProviderName
  capability: DataCapability
  status: CacheStatus
  data: T | null
  fetchedAt: string
  expiresAt: string
  errorMessage?: string
}

// --- TTL par capability ----------------------------------------------------
export const CACHE_TTL: Record<DataCapability, number> = {
  LATEST_PRICE: 15 * 60 * 1000,
  HISTORICAL_PRICES: 24 * 60 * 60 * 1000,
  DIVIDENDS: 7 * 24 * 60 * 60 * 1000,
  SPLITS: 7 * 24 * 60 * 60 * 1000,
  ANALYST_CONSENSUS: 24 * 60 * 60 * 1000,
  PRICE_TARGET: 24 * 60 * 60 * 1000,
  RECOMMENDATION_TRENDS: 24 * 60 * 60 * 1000,
  NEWS: 6 * 60 * 60 * 1000,
  FUNDAMENTALS: 24 * 60 * 60 * 1000,
}

/** TTL court pour les erreurs contrôlées (quota, endpoint payant, symbole inconnu…). */
export const ERROR_TTL = 60 * 60 * 1000

// --- Helpers de validité ("donnée valide") ---------------------------------
export function isValidLatestPrice(d: unknown): boolean {
  return !!d && typeof (d as MarketPrice).close === 'number' && (d as MarketPrice).close > 0
}
export function isValidArray(d: unknown): boolean {
  return Array.isArray(d) && d.length > 0
}
export function isValidConsensus(d: unknown): boolean {
  return !!d && typeof (d as { total?: number }).total === 'number' && (d as { total: number }).total > 0
}
export function isValidPriceTarget(d: unknown): boolean {
  if (!d) return false
  const t = d as PriceTarget
  return t.targetMean != null || t.targetMedian != null || t.targetHigh != null || t.targetLow != null
}
export function isValidFundamentals(d: unknown): boolean {
  if (!d) return false
  const f = d as CompanyFundamentals
  return [
    f.marketCapitalization,
    f.peNormalizedAnnual,
    f.peBasicExclExtraTTM,
    f.epsBasicExclExtraItemsTTM,
    f.dividendYieldIndicatedAnnual,
    f.beta,
    f.week52High,
    f.week52Low,
  ].some((v) => v != null)
}

const VALIDATORS: Record<DataCapability, (d: unknown) => boolean> = {
  LATEST_PRICE: isValidLatestPrice,
  HISTORICAL_PRICES: isValidArray,
  DIVIDENDS: isValidArray,
  SPLITS: isValidArray,
  ANALYST_CONSENSUS: isValidConsensus,
  PRICE_TARGET: isValidPriceTarget,
  RECOMMENDATION_TRENDS: isValidArray,
  NEWS: isValidArray,
  FUNDAMENTALS: isValidFundamentals,
}

// --- Stockage (mémoire + LocalStorage) -------------------------------------
const CACHE_PREFIX = 'api-cache:'
const memoryCache = new Map<string, CachedApiResult<unknown>>()

export function getCachedResult<T>(key: string): CachedApiResult<T> | null {
  const mem = memoryCache.get(key)
  if (mem) return mem as CachedApiResult<T>
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedApiResult<T>
    memoryCache.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function setCachedResult<T>(result: CachedApiResult<T>): void {
  memoryCache.set(result.key, result)
  try {
    localStorage.setItem(CACHE_PREFIX + result.key, JSON.stringify(result))
  } catch {
    /* quota / mode privé — le cache mémoire reste actif */
  }
}

export function isFresh(result: CachedApiResult<unknown>): boolean {
  return new Date(result.expiresAt).getTime() > Date.now()
}

export function clearExpiredCache(): void {
  for (const [k, v] of memoryCache) if (!isFresh(v)) memoryCache.delete(k)
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(CACHE_PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as CachedApiResult<unknown>
        if (!parsed.expiresAt || !isFresh(parsed)) toRemove.push(key)
      } catch {
        toRemove.push(key)
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

// --- Requêtes en cours (in-flight) -----------------------------------------
const inFlightRequests = new Map<string, Promise<unknown>>()

export function getOrCreateInFlight<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key)
  if (existing) return existing as Promise<T>
  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key)
  })
  inFlightRequests.set(key, promise)
  return promise
}

/** Nombre de requêtes réseau réellement parties (utile pour les tests/diagnostic). */
let networkCallCount = 0
export function getNetworkCallCount(): number {
  return networkCallCount
}

// --- Clé de cache déterministe ---------------------------------------------
export function buildCacheKey(
  provider: ProviderName,
  capability: DataCapability,
  symbol: string,
  params: CacheParams,
): string {
  const suffix = Object.keys(params)
    .sort()
    .map((k) => params[k])
    .filter((v) => v !== undefined && v !== '')
    .join(':')
  return suffix
    ? `${provider}:${capability}:${symbol}:${suffix}`
    : `${provider}:${capability}:${symbol}`
}

// --- Fallback intelligent ---------------------------------------------------
export async function fetchWithFallback<T>(
  capability: DataCapability,
  asset: Asset,
  params: CacheParams,
  providers: DataProvider[],
): Promise<SourcedResult<T>> {
  const validator = VALIDATORS[capability] ?? (() => true)

  // 1) providers avec clé API + qui supportent la capability.
  const active = providers.filter((p) => p.isEnabled() && p.capabilities.includes(capability))

  for (const provider of active) {
    const key = buildCacheKey(provider.name, capability, provider.symbolFor(asset), params)

    // 2) cache frais → on ne rappelle pas l'API.
    const cached = getCachedResult<T>(key)
    if (cached && isFresh(cached)) {
      if (cached.status === 'HIT') return { data: cached.data, source: provider.name }
      // EMPTY ou ERROR frais → provider suivant, sans appel réseau.
      continue
    }

    // 3) appel réseau, mutualisé si déjà en cours.
    const now = new Date()
    try {
      const data = await getOrCreateInFlight<T>(key, () => {
        networkCallCount++
        return provider.fetch(capability, asset, params) as Promise<T>
      })

      if (data != null && validator(data)) {
        setCachedResult<T>({
          key,
          provider: provider.name,
          capability,
          status: 'HIT',
          data,
          fetchedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + CACHE_TTL[capability]).toISOString(),
        })
        return { data, source: provider.name }
      }

      // Résultat vide → on le cache pour ne pas redemander pendant le TTL.
      setCachedResult<T>({
        key,
        provider: provider.name,
        capability,
        status: 'EMPTY',
        data: null,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + CACHE_TTL[capability]).toISOString(),
      })
    } catch (err) {
      // Erreur contrôlée → cache court, pas de nouvel appel avant ERROR_TTL.
      setCachedResult<T>({
        key,
        provider: provider.name,
        capability,
        status: 'ERROR',
        data: null,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ERROR_TTL).toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { data: null, source: 'none' }
}

// Nettoyage opportuniste au démarrage.
clearExpiredCache()
