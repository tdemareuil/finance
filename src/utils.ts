import type { AccountType, Asset, Currency, Position, Transaction } from './types'
import { DEFAULT_FX, toEur, isInterestBearing, type FxTable } from './services/portfolioCalculator'

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

/** Comptes-titres (détiennent des actifs cotés importés par CSV). */
export const SECURITIES_ACCOUNT_TYPES: AccountType[] = ['CTO', 'PEA']

/** Un compte d'épargne (livret / plan) : son solde EST l'actif, pas de titres. */
export function isSavingsAccount(type: AccountType): boolean {
  return !SECURITIES_ACCOUNT_TYPES.includes(type)
}

export type RiskLevel = 'Faible' | 'Modéré' | 'Élevé'
export const RISK_ORDER: RiskLevel[] = ['Faible', 'Modéré', 'Élevé']

export function assetRisk(asset: Asset): RiskLevel {
  // Liquidités / livrets = risque nul. ETF et actions = exposition marché actions,
  // donc risque élevé (un ETF actions n'est pas un placement sûr).
  if (asset.type === 'CASH') return 'Faible'
  return 'Élevé'
}

// --- Description d'erreur lisible ------------------------------------------
// Les erreurs Supabase (PostgREST) sont des objets simples `{ message, details,
// hint, code }`, PAS des instances d'Error : `err instanceof Error` est faux et
// `String(err)` donne « [object Object] ». On extrait ici un message exploitable.
export function errorMessage(err: unknown): string {
  if (err == null) return 'Erreur inconnue.'
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
  const parts = [e.message, e.details, e.hint]
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
  if (parts.length) {
    const code = typeof e.code === 'string' && e.code ? ` [${e.code}]` : ''
    return parts.join(' — ') + code
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// --- Détection d'erreur réseau (serveur injoignable / bloqué) --------------
export function isUnreachableError(err: unknown): boolean {
  const msg = errorMessage(err)
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

/** Solde d'épargne à intégrer aux allocations (livrets, PER, PEE). */
export interface SavingsAllocItem {
  accountName: string
  accountType: AccountType
  value: number
}

/** Ajoute les soldes d'épargne aux tranches d'allocation, sous une clé donnée. */
function withSavings(
  base: AllocationSlice[],
  savings: SavingsAllocItem[],
  keyFn: (s: SavingsAllocItem) => string,
): AllocationSlice[] {
  const map = new Map(base.map((s) => [s.name, s.value]))
  for (const it of savings) {
    if (it.value <= 0) continue
    const k = keyFn(it)
    map.set(k, (map.get(k) ?? 0) + it.value)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

export function allocationByAccount(
  positions: Position[],
  savings: SavingsAllocItem[] = [],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  return withSavings(allocationBy(positions, (p) => p.account.name, fx), savings, (s) => s.accountName)
}
export function allocationByType(
  positions: Position[],
  savings: SavingsAllocItem[] = [],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  const label: Record<string, string> = { STOCK: 'Action', ETF: 'ETF', CASH: 'Cash' }
  return withSavings(
    allocationBy(positions, (p) => label[p.asset.type] ?? p.asset.type, fx),
    savings,
    (s) => (isInterestBearing(s.accountType) ? 'Livrets' : ACCOUNT_TYPE_LABEL[s.accountType]),
  )
}
export function allocationByCurrency(
  positions: Position[],
  savings: SavingsAllocItem[] = [],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  return withSavings(allocationBy(positions, (p) => p.currency, fx), savings, () => 'EUR')
}
export function allocationBySector(
  positions: Position[],
  savings: SavingsAllocItem[] = [],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  // Livrets → « Livrets » ; PER/PEE → supposés diversifiés.
  return withSavings(
    allocationBy(positions, (p) => p.asset.sector ?? 'Non renseigné', fx),
    savings,
    (s) => (isInterestBearing(s.accountType) ? 'Livrets' : 'Diversifié'),
  )
}
export function allocationByCountry(
  positions: Position[],
  savings: SavingsAllocItem[] = [],
  fx: FxTable = DEFAULT_FX,
): AllocationSlice[] {
  // Livrets → « Livrets » ; PER/PEE → supposés français.
  return withSavings(
    allocationBy(positions, (p) => p.asset.country ?? 'Non renseigné', fx),
    savings,
    (s) => (isInterestBearing(s.accountType) ? 'Livrets' : 'France'),
  )
}
