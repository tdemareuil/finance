import type { Asset, MarketPrice, PriceTarget } from '../types'
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

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// --- TTL par capability ----------------------------------------------------
export const CACHE_TTL: Record<DataCapability, number> = {
  LATEST_PRICE: 30 * MINUTE, // base ; ajusté selon l'ouverture des marchés (voir ttlFor)
  HISTORICAL_PRICES: 24 * HOUR,
  DIVIDENDS: 7 * DAY,
  SPLITS: 7 * DAY,
  ANALYST_CONSENSUS: 24 * HOUR,
  PRICE_TARGET: 24 * HOUR,
  RECOMMENDATION_TRENDS: 24 * HOUR,
  NEWS: 6 * HOUR,
  NEXT_EARNINGS: 24 * HOUR,
}

/**
 * TTL effectif d'un cours (#3) : les prix ne bougent pas marché fermé, donc on
 * garde le cache bien plus longtemps la nuit et le week-end pour économiser des
 * appels. Heure locale du navigateur (Europe pour l'utilisateur).
 */
export function latestPriceTtl(now: Date = new Date()): number {
  const day = now.getDay() // 0 = dimanche, 6 = samedi
  if (day === 0 || day === 6) return 24 * HOUR // week-end : marchés fermés
  const h = now.getHours()
  // Hors ~08h–23h (Euronext + sessions US converties Paris) : marchés fermés.
  if (h < 8 || h >= 23) return 4 * HOUR
  return 30 * MINUTE // séance : rafraîchissement modéré
}

/** TTL d'un résultat valide (HIT) ou vide (EMPTY), par capability. */
function ttlFor(capability: DataCapability): number {
  return capability === 'LATEST_PRICE' ? latestPriceTtl() : CACHE_TTL[capability]
}

/** TTL des erreurs transitoires (quota 429, 5xx, réseau) : on réessaie vite. */
export const ERROR_TTL = 1 * HOUR
/** TTL des erreurs « permanentes » (symbole inconnu 404, endpoint payant 402/403,
 *  clé invalide 401, requête invalide 400/422) : inutile de re-solliciter souvent. */
export const PERMANENT_ERROR_TTL = 7 * DAY

/**
 * Classe une erreur contrôlée pour choisir son TTL de cache (#2).
 * Les providers lèvent des messages du type « FMP 402 », « TwelveData 404 »,
 * « Finnhub 429 » ; on en extrait le code HTTP. Sans code (erreur réseau), on
 * traite comme transitoire.
 */
export function errorTtlFor(message: string): number {
  const m = /\b([45]\d\d)\b/.exec(message)
  const code = m ? Number(m[1]) : 0
  if (code === 429 || code >= 500) return ERROR_TTL // quota / serveur → transitoire
  if (code >= 400) return PERMANENT_ERROR_TTL // 400/401/402/403/404/422 → durable
  return ERROR_TTL // réseau / inconnu → transitoire
}

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
export function isValidNextEarnings(d: unknown): boolean {
  return !!d && typeof (d as { date?: unknown }).date === 'string' && (d as { date: string }).date !== ''
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
  NEXT_EARNINGS: isValidNextEarnings,
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
          expiresAt: new Date(now.getTime() + ttlFor(capability)).toISOString(),
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
        expiresAt: new Date(now.getTime() + ttlFor(capability)).toISOString(),
      })
    } catch (err) {
      // Erreur contrôlée → TTL court (transitoire) ou long (permanent, cf. #2).
      const message = err instanceof Error ? err.message : String(err)
      setCachedResult<T>({
        key,
        provider: provider.name,
        capability,
        status: 'ERROR',
        data: null,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + errorTtlFor(message)).toISOString(),
        errorMessage: message,
      })
    }
  }

  return { data: null, source: 'none' }
}

// Nettoyage opportuniste au démarrage.
clearExpiredCache()
