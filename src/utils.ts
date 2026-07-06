import type { AccountType, Asset, Currency, Position, Transaction } from './types'
import { DEFAULT_FX, toEur, type FxTable } from './services/portfolioCalculator'

// ===========================================================================
// Utilitaires transverses : formatage, thème, risque, erreurs, agrégations.
// (Regroupés en un seul module pour limiter le nombre de fichiers.)
// ===========================================================================

// --- Formatage -------------------------------------------------------------
const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const usdFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function formatMoney(value: number | null | undefined, currency: Currency = 'EUR'): string {
  if (value == null || Number.isNaN(value)) return '—'
  return (currency === 'USD' ? usdFmt : eurFmt).format(value)
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value)
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

/** Classe CSS pour colorer une valeur selon son signe. */
export function signClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

// --- Thème clair / sombre (sombre par défaut, persisté) --------------------
export type Theme = 'light' | 'dark'
const THEME_KEY = 'patrimoine-theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function initTheme(): void {
  applyTheme(getTheme())
}

// --- Niveau de risque (heuristique) ----------------------------------------
// --- Comptes ---------------------------------------------------------------
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CTO: 'CTO',
  PEA: 'PEA',
  LIVRET_A: 'Livret A',
  LDDS: 'LDDS',
  LIVRET_PLUS: 'Livret+',
  PER: 'PER',
  PEE: 'PEE',
}

export type RiskLevel = 'Faible' | 'Modéré' | 'Élevé'
export const RISK_ORDER: RiskLevel[] = ['Faible', 'Modéré', 'Élevé']

export function assetRisk(asset: Asset): RiskLevel {
  // Liquidités / livrets = risque nul. ETF et actions = exposition marché actions,
  // donc risque élevé (un ETF actions n'est pas un placement sûr).
  if (asset.type === 'CASH') return 'Faible'
  return 'Élevé'
}

// --- Détection d'erreur réseau (serveur injoignable / bloqué) --------------
export function isUnreachableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const status =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : undefined
  return status === 0 || /failed to fetch|networkerror|load failed|fetch/i.test(msg)
}

// --- Agrégations (graphiques) ----------------------------------------------
export interface MonthlyPoint {
  month: string
  value: number
}
export interface AllocationSlice {
  name: string
  value: number
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** Dividendes reçus par mois (EUR). */
export function dividendsByMonth(transactions: Transaction[], fx: FxTable = DEFAULT_FX): MonthlyPoint[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'DIVIDEND') continue
    const k = monthKey(t.date)
    map.set(k, (map.get(k) ?? 0) + toEur(t.amount ?? 0, t.currency, fx))
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, value]) => ({ month, value: Math.round(value * 100) / 100 }))
}

/** Dividendes reçus par actif (EUR). */
export function dividendsByAsset(
  transactions: Transaction[],
  assets: Asset[],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'DIVIDEND' || !t.assetId) continue
    const name = assetMap.get(t.assetId)?.name ?? 'Inconnu'
    map.set(name, (map.get(name) ?? 0) + toEur(t.amount ?? 0, t.currency, fx))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

// --- Allocations (valeur EUR des positions) --------------------------------
function allocationBy(positions: Position[], keyFn: (p: Position) => string, fx: FxTable): AllocationSlice[] {
  const map = new Map<string, number>()
  for (const p of positions) {
    if (p.currentValue == null || p.quantity <= 0) continue
    const key = keyFn(p)
    map.set(key, (map.get(key) ?? 0) + toEur(p.currentValue, p.currency, fx))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

export function allocationByAccount(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.account.name, fx)
}
export function allocationByType(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  const label: Record<string, string> = { STOCK: 'Action', ETF: 'ETF', CASH: 'Cash' }
  return allocationBy(positions, (p) => label[p.asset.type] ?? p.asset.type, fx)
}
export function allocationByCurrency(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.currency, fx)
}
export function allocationBySector(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.asset.sector ?? 'Non renseigné', fx)
}
export function allocationByCountry(positions: Position[], fx: FxTable = DEFAULT_FX): AllocationSlice[] {
  return allocationBy(positions, (p) => p.asset.country ?? 'Non renseigné', fx)
}
