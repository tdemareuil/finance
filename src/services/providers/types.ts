import type { Asset } from '../../types'

// ---------------------------------------------------------------------------
// Abstraction multi-provider.
// Les composants React n'appellent JAMAIS un provider directement : ils passent
// par marketDataService / analysisService, qui orchestrent les providers via
// fetchWithFallback (apiCacheService).
// ---------------------------------------------------------------------------

export type DataCapability =
  | 'LATEST_PRICE'
  | 'HISTORICAL_PRICES'
  | 'DIVIDENDS'
  | 'SPLITS'
  | 'ANALYST_CONSENSUS'
  | 'PRICE_TARGET'
  | 'RECOMMENDATION_TRENDS'
  | 'NEWS'
  | 'FUNDAMENTALS'

export type ProviderName = 'eodhd' | 'finnhub' | 'fmp' | 'mock'

/** Paramètres additionnels d'un appel (from/to/resolution…), sérialisés dans la clé de cache. */
export type CacheParams = Record<string, string | number | boolean | undefined>

export interface ProviderCapabilityMap {
  providerName: ProviderName
  capabilities: DataCapability[]
}

/**
 * Un provider expose ses capacités et une méthode fetch générique.
 * fetch retourne la donnée déjà mappée dans le type métier (ou null si vide),
 * et LÈVE une erreur pour les erreurs contrôlées (402/403/429/quota/symbole inconnu).
 */
export interface DataProvider {
  name: ProviderName
  capabilities: DataCapability[]
  /** true si le provider est utilisable (clé API présente ; mock toujours true). */
  isEnabled: () => boolean
  /** Symbole propre au provider (déterministe) — sert aussi à construire la clé de cache. */
  symbolFor: (asset: Asset) => string
  fetch: (capability: DataCapability, asset: Asset, params: CacheParams) => Promise<unknown>
}

/** Résultat renvoyé par les services, avec la source réellement utilisée. */
export interface SourcedResult<T> {
  data: T | null
  source: ProviderName | 'none'
}

export function providerLabel(source: ProviderName | 'none'): string {
  switch (source) {
    case 'eodhd':
      return 'EODHD'
    case 'finnhub':
      return 'Finnhub'
    case 'fmp':
      return 'FMP'
    case 'mock':
      return 'données de démonstration'
    default:
      return '—'
  }
}
