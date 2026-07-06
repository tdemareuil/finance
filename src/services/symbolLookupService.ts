import { getOrCreateInFlight } from './apiCacheService'

// ---------------------------------------------------------------------------
// Résolution du VRAI symbole (ticker) à partir d'un ISIN ou d'un nom, via les
// sources de données utilisées (Finnhub en primaire, FMP en repli).
// On n'invente JAMAIS de ticker : si rien n'est trouvé, on retourne null.
// Cache LocalStorage longue durée (les symboles changent rarement) + dédup in-flight.
// ---------------------------------------------------------------------------

const FINNHUB_KEY = (import.meta.env.VITE_FINNHUB_API_KEY as string | undefined)?.trim()
const FMP_KEY = (import.meta.env.VITE_FMP_API_KEY as string | undefined)?.trim()

const CACHE_PREFIX = 'symbol-lookup:'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export interface ResolvedSymbol {
  /** Ticker « nu » (ex : CRM, SAP). */
  ticker?: string
  /** Suffixe place si présent (ex : DE pour SAP.DE). */
  exchange?: string
  /** Symbole Finnhub complet (ex : CRM, SAP.DE). */
  finnhubSymbol?: string
  /** Symbole TradingView si déductible (tickers US sans suffixe). */
  tradingViewSymbol?: string
  name?: string
}

// undefined = pas en cache ; null = recherche déjà faite, rien trouvé.
function cacheGet(key: string): ResolvedSymbol | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { t: number; v: ResolvedSymbol | null }
    if (Date.now() - parsed.t > TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return undefined
    }
    return parsed.v
  } catch {
    return undefined
  }
}

function cacheSet(key: string, value: ResolvedSymbol | null): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    /* ignore */
  }
}

/** Transforme un symbole "SAP.DE" → {ticker:'SAP', exchange:'DE', finnhubSymbol:'SAP.DE'}. */
function fromSymbol(symbol: string, name?: string): ResolvedSymbol {
  const s = symbol.trim()
  const dot = s.indexOf('.')
  const ticker = dot > 0 ? s.slice(0, dot) : s
  const exchange = dot > 0 ? s.slice(dot + 1) : undefined
  return {
    ticker,
    exchange,
    finnhubSymbol: s,
    // Sans suffixe (titres US), le ticker nu fonctionne dans le widget TradingView.
    tradingViewSymbol: exchange ? undefined : ticker,
    name,
  }
}

async function tryFinnhub(query: string): Promise<ResolvedSymbol | null> {
  if (!FINNHUB_KEY) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(FINNHUB_KEY)}`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as { result?: Array<{ symbol: string; displaySymbol?: string; description?: string; type?: string }> }
    const first = (json.result ?? []).find((r) => r.symbol)
    if (!first) return null
    return fromSymbol(first.displaySymbol || first.symbol, first.description)
  } catch {
    return null
  }
}

async function tryFmp(query: string): Promise<ResolvedSymbol | null> {
  if (!FMP_KEY) return null
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=1&apikey=${encodeURIComponent(FMP_KEY)}`,
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{ symbol: string; name?: string }>
    const first = Array.isArray(rows) ? rows[0] : undefined
    if (!first?.symbol) return null
    return fromSymbol(first.symbol, first.name)
  } catch {
    return null
  }
}

/**
 * Résout le symbole réel par ISIN (prioritaire) ou par nom.
 * Retourne null si aucune source ne trouve (aucun ticker inventé).
 */
export async function resolveSymbol(isin?: string, name?: string): Promise<ResolvedSymbol | null> {
  const query = (isin?.trim() || name?.trim() || '').trim()
  if (!query) return null

  const cached = cacheGet(query)
  if (cached !== undefined) return cached

  return getOrCreateInFlight(`symbol:${query}`, async () => {
    let result = await tryFinnhub(query)
    if (!result) result = await tryFmp(query)
    // On mémorise aussi l'absence de résultat (null) pour ne pas re-solliciter l'API.
    cacheSet(query, result)
    return result
  })
}
