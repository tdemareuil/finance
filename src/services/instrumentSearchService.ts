// Recherche mondiale d'instruments via Finnhub /search.
// Gère noms, tickers et ISINs. Cache mémoire 5 min.

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined
const BASE = 'https://finnhub.io/api/v1'
const TTL = 5 * 60_000
const MAX_RESULTS = 12

export interface InstrumentSearchResult {
  symbol: string        // symbole Finnhub (ex : "AAPL", "SAP.DE")
  displaySymbol: string // symbole affiché (ex : "AAPL", "SAP.DE")
  description: string   // nom de l'émetteur (ex : "APPLE INC")
  type: string          // "Common Stock", "ETP", "Crypto", etc.
}

interface CacheEntry {
  results: InstrumentSearchResult[]
  ts: number
}

const cache = new Map<string, CacheEntry>()

export async function searchInstruments(query: string): Promise<InstrumentSearchResult[]> {
  if (!FINNHUB_KEY || !query.trim()) return []
  const key = query.trim().toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) return hit.results
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(query.trim())}&token=${FINNHUB_KEY}`,
    )
    if (!res.ok) return []
    const data = await res.json()
    const results: InstrumentSearchResult[] = (data.result ?? []).slice(0, MAX_RESULTS)
    cache.set(key, { results, ts: Date.now() })
    return results
  } catch {
    return []
  }
}

/** Convertit un symbole Finnhub en symbole TradingView (heuristique best-effort). */
export function toTradingViewSymbol(symbol: string): string {
  // Symboles sans point → US → passer tel quel
  if (!symbol.includes('.')) return symbol
  // SAP.DE → XETR:SAP  (XETR couvre la plupart des actions allemandes)
  // MC.PA → EURONEXT:MC
  const [ticker, exchange] = symbol.split('.')
  const TV_EXCHANGE: Record<string, string> = {
    DE: 'XETR',
    PA: 'EURONEXT',
    AS: 'EURONEXT',
    BR: 'EURONEXT',
    LS: 'EURONEXT',
    MI: 'MIL',
    MC: 'BME',
    L:  'LSE',
    TO: 'TSX',
    HK: 'HKEX',
    T:  'TSE',
    AX: 'ASX',
  }
  const prefix = TV_EXCHANGE[exchange]
  return prefix ? `${prefix}:${ticker}` : symbol
}
