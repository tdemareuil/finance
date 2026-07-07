import type { Asset, MarketPrice } from '../../types'
import type { CacheParams, DataCapability, DataProvider } from './types'

// ---------------------------------------------------------------------------
// Twelve Data — provider de marché PRINCIPAL (cours + historique).
// Désactivé automatiquement si VITE_TWELVE_DATA_API_KEY est absente ; en cas de
// quota atteint (429 / status "error"), on lève une erreur contrôlée pour que
// le service bascule sur le provider suivant (FMP → Finnhub).
// La clé n'est JAMAIS en dur : elle vient de l'environnement Vite.
// ---------------------------------------------------------------------------

const TWELVE_DATA_KEY = (import.meta.env.VITE_TWELVE_DATA_API_KEY as string | undefined)?.trim()
const BASE = 'https://api.twelvedata.com'

/** Symbole propre : on réutilise finnhubSymbol (ex. « AAPL », « MC.PA »), sinon le ticker. */
function symbolFor(asset: Asset): string {
  return asset.finnhubSymbol?.trim() || asset.ticker.trim()
}

/**
 * Appel JSON. Twelve Data renvoie souvent HTTP 200 avec `{ status: "error",
 * code, message }` (quota, symbole inconnu, endpoint payant) → on lève pour
 * déclencher le fallback + un cache ERROR côté service.
 */
async function getJson<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}apikey=${encodeURIComponent(TWELVE_DATA_KEY ?? '')}`)
  if (!res.ok) throw new Error(`TwelveData ${res.status}`) // 401/403/429 → erreur contrôlée
  const json = (await res.json()) as T & { status?: string; code?: number; message?: string }
  if (json && typeof json === 'object' && json.status === 'error') {
    throw new Error(`TwelveData ${json.code ?? ''}: ${json.message ?? 'error'}`)
  }
  return json as T
}

const MARKET_CAPS: DataCapability[] = ['LATEST_PRICE', 'HISTORICAL_PRICES']

export const twelveDataProvider: DataProvider = {
  name: 'twelvedata',
  capabilities: MARKET_CAPS,
  isEnabled: () => Boolean(TWELVE_DATA_KEY),
  symbolFor,

  async fetch(capability: DataCapability, asset: Asset, params: CacheParams): Promise<unknown> {
    const symbol = symbolFor(asset)

    switch (capability) {
      case 'LATEST_PRICE': {
        const json = await getJson<{ price?: string }>(`/price?symbol=${encodeURIComponent(symbol)}`)
        const close = json.price != null ? Number(json.price) : NaN
        if (!Number.isFinite(close) || close <= 0) return null
        const mp: MarketPrice = {
          assetId: asset.id,
          date: new Date().toISOString().slice(0, 10),
          close,
          currency: asset.currency,
        }
        return mp
      }

      case 'HISTORICAL_PRICES': {
        const from = String(params.from ?? '')
        const to = String(params.to ?? '')
        const json = await getJson<{ values?: Array<{ datetime: string; close: string }> }>(
          `/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day` +
            `&start_date=${from}&end_date=${to}&outputsize=5000&order=ASC`,
        )
        const rows = json.values ?? []
        return rows
          .map<MarketPrice>((r) => ({
            assetId: asset.id,
            date: r.datetime.slice(0, 10),
            close: Number(r.close),
            currency: asset.currency,
          }))
          .filter((p) => Number.isFinite(p.close) && p.close > 0)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
      }

      default:
        return null
    }
  },
}
