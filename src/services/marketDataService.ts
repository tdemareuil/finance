import type { Asset, Currency, DividendEvent, MarketPrice } from '../types'
import {
  getMockDividendEvents,
  getMockHistoricalPrices,
  getMockLatestPrice,
} from '../data/mockMarketData'

// ---------------------------------------------------------------------------
// Service de données de marché.
// Deux modes :
//   - MOCK (par défaut) : séries déterministes générées localement.
//   - EODHD : si VITE_EODHD_API_KEY est fournie.
// L'app ne doit jamais être bloquée si EODHD échoue : on retombe sur le mock.
// La clé n'est JAMAIS hardcodée (lue depuis import.meta.env).
// ---------------------------------------------------------------------------

const EODHD_KEY = (import.meta.env.VITE_EODHD_API_KEY as string | undefined)?.trim()
const EODHD_BASE = 'https://eodhd.com/api'

export const isEodhdConfigured = Boolean(EODHD_KEY)
export type MarketDataMode = 'EODHD' | 'MOCK'
export const marketDataMode: MarketDataMode = isEodhdConfigured ? 'EODHD' : 'MOCK'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Symbole EODHD à utiliser pour un actif (fallback : TICKER.EXCHANGE). */
function symbolFor(asset: Asset): string {
  if (asset.eodhdSymbol) return asset.eodhdSymbol
  if (asset.exchange) return `${asset.ticker}.${asset.exchange}`
  return asset.ticker
}

// --- Dernier prix ----------------------------------------------------------
export async function getLatestPrice(asset: Asset): Promise<MarketPrice> {
  const symbol = symbolFor(asset)
  if (isEodhdConfigured) {
    try {
      const url = `${EODHD_BASE}/real-time/${encodeURIComponent(symbol)}?api_token=${EODHD_KEY}&fmt=json`
      const res = await fetch(url)
      if (res.ok) {
        const json = (await res.json()) as { close?: number; timestamp?: number }
        if (typeof json.close === 'number' && !Number.isNaN(json.close)) {
          return { assetId: asset.id, date: today(), close: json.close, currency: asset.currency }
        }
      }
    } catch {
      /* fallback mock */
    }
  }
  const p = getMockLatestPrice(symbol, today())
  return { assetId: asset.id, date: p.date, close: p.close, currency: asset.currency }
}

// --- Historique ------------------------------------------------------------
export async function getHistoricalPrices(
  asset: Asset,
  from: string,
  to: string,
): Promise<MarketPrice[]> {
  const symbol = symbolFor(asset)
  if (isEodhdConfigured) {
    try {
      const url =
        `${EODHD_BASE}/eod/${encodeURIComponent(symbol)}` +
        `?api_token=${EODHD_KEY}&from=${from}&to=${to}&period=d&fmt=json`
      const res = await fetch(url)
      if (res.ok) {
        const rows = (await res.json()) as Array<{ date: string; adjusted_close?: number; close?: number }>
        if (Array.isArray(rows) && rows.length) {
          return rows.map((r) => ({
            assetId: asset.id,
            date: r.date,
            close: r.adjusted_close ?? r.close ?? 0,
            currency: asset.currency,
          }))
        }
      }
    } catch {
      /* fallback mock */
    }
  }
  return getMockHistoricalPrices(symbol, from, to).map((p) => ({
    assetId: asset.id,
    date: p.date,
    close: p.close,
    currency: asset.currency,
  }))
}

// --- Dividendes ------------------------------------------------------------
export async function getDividendEvents(asset: Asset): Promise<DividendEvent[]> {
  const symbol = symbolFor(asset)
  const nowIso = new Date().toISOString()
  if (isEodhdConfigured) {
    try {
      const from = new Date()
      from.setFullYear(from.getFullYear() - 1)
      const url =
        `${EODHD_BASE}/div/${encodeURIComponent(symbol)}` +
        `?api_token=${EODHD_KEY}&from=${from.toISOString().slice(0, 10)}&fmt=json`
      const res = await fetch(url)
      if (res.ok) {
        const rows = (await res.json()) as Array<{ date: string; value: number; currency?: string; paymentDate?: string }>
        if (Array.isArray(rows) && rows.length) {
          return rows.map((r, i) => ({
            id: `eodhd-${asset.id}-${i}`,
            userId: asset.userId,
            assetId: asset.id,
            exDate: r.date,
            paymentDate: r.paymentDate,
            amountPerShare: r.value,
            currency: (r.currency as Currency) ?? asset.currency,
            createdAt: nowIso,
          }))
        }
      }
    } catch {
      /* fallback mock */
    }
  }
  return getMockDividendEvents(symbol, today()).map((d, i) => ({
    id: `mock-${asset.id}-${i}`,
    userId: asset.userId,
    assetId: asset.id,
    exDate: d.exDate,
    paymentDate: d.paymentDate,
    amountPerShare: d.amountPerShare,
    currency: asset.currency,
    createdAt: nowIso,
  }))
}
