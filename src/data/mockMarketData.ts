import type { Currency } from '../types'

// ---------------------------------------------------------------------------
// Données de marché fictives (mode mock).
// Génère des séries de prix déterministes (marche aléatoire seedée) pour que
// l'application soit pleinement fonctionnelle sans clé EODHD.
// ---------------------------------------------------------------------------

interface MockSymbolConfig {
  basePrice: number
  /** Volatilité quotidienne relative. */
  vol: number
  /** Dérive annuelle attendue (ex : 0.07 = +7%/an). */
  annualDrift: number
  currency: Currency
  /** Dividende annuel par action (approximatif), 0 si aucun. */
  annualDividend?: number
}

// Symboles connus des données de démo + benchmark MSCI World.
const SYMBOLS: Record<string, MockSymbolConfig> = {
  'CW8.PA': { basePrice: 480, vol: 0.008, annualDrift: 0.09, currency: 'EUR', annualDividend: 0 },
  'IWDA.AS': { basePrice: 92, vol: 0.008, annualDrift: 0.09, currency: 'EUR', annualDividend: 0 },
  'URTH': { basePrice: 150, vol: 0.008, annualDrift: 0.09, currency: 'USD', annualDividend: 2.2 },
  'AAPL.US': { basePrice: 195, vol: 0.014, annualDrift: 0.12, currency: 'USD', annualDividend: 1.0 },
  'MC.PA': { basePrice: 720, vol: 0.013, annualDrift: 0.06, currency: 'EUR', annualDividend: 13 },
  'AIR.PA': { basePrice: 145, vol: 0.013, annualDrift: 0.08, currency: 'EUR', annualDividend: 1.8 },
}

const DEFAULT_CONFIG: MockSymbolConfig = {
  basePrice: 100,
  vol: 0.012,
  annualDrift: 0.05,
  currency: 'EUR',
}

/** Hash déterministe d'une chaîne → nombre [0,1). */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) + 1
}

function resolveConfig(symbol: string): MockSymbolConfig {
  return SYMBOLS[symbol] ?? { ...DEFAULT_CONFIG, basePrice: 50 + (hashString(symbol) % 200) }
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface MockPricePoint {
  date: string
  close: number
  currency: Currency
}

/**
 * Génère la série de prix quotidienne d'un symbole entre deux dates.
 * Déterministe : même symbole + mêmes dates ⇒ même série.
 */
export function getMockHistoricalPrices(
  symbol: string,
  from: string,
  to: string,
): MockPricePoint[] {
  const cfg = resolveConfig(symbol)
  const rand = seededRandom(hashString(symbol))
  const start = new Date(from)
  const end = new Date(to)
  const totalDays = Math.max(1, daysBetween(start, end))
  const dailyDrift = cfg.annualDrift / 252

  const out: MockPricePoint[] = []
  let price = cfg.basePrice
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    // On saute les week-ends (marché fermé).
    if (dow === 0 || dow === 6) continue
    const shock = (rand() - 0.5) * 2 * cfg.vol
    price = price * (1 + dailyDrift + shock)
    out.push({ date: toISODate(d), close: Math.round(price * 100) / 100, currency: cfg.currency })
  }
  return out
}

/** Dernier prix connu (aujourd'hui) pour un symbole. */
export function getMockLatestPrice(symbol: string, today: string): MockPricePoint {
  // On régénère sur ~2 ans pour obtenir un prix "actuel" cohérent.
  const from = new Date(today)
  from.setFullYear(from.getFullYear() - 2)
  const series = getMockHistoricalPrices(symbol, toISODate(from), today)
  return series[series.length - 1] ?? { date: today, close: resolveConfig(symbol).basePrice, currency: resolveConfig(symbol).currency }
}

export interface MockDividend {
  exDate: string
  paymentDate: string
  amountPerShare: number
  currency: Currency
}

/**
 * Événements de dividendes fictifs pour un symbole (trimestriels si annualDividend > 0).
 * Couvre l'année passée et les 2 prochains trimestres (calendrier).
 */
export function getMockDividendEvents(symbol: string, today: string): MockDividend[] {
  const cfg = resolveConfig(symbol)
  if (!cfg.annualDividend) return []
  const perQuarter = Math.round((cfg.annualDividend / 4) * 100) / 100
  const now = new Date(today)
  const events: MockDividend[] = []
  // De -4 trimestres à +2 trimestres.
  for (let q = -4; q <= 2; q++) {
    const ex = new Date(now)
    ex.setMonth(now.getMonth() + q * 3)
    ex.setDate(15)
    const pay = new Date(ex)
    pay.setDate(ex.getDate() + 20)
    events.push({
      exDate: toISODate(ex),
      paymentDate: toISODate(pay),
      amountPerShare: perQuarter,
      currency: cfg.currency,
    })
  }
  return events
}

export const KNOWN_MOCK_SYMBOLS = Object.keys(SYMBOLS)
