import type {
  Account,
  AccountType,
  Asset,
  Currency,
  MarketPrice,
  Position,
  PortfolioSummary,
  Transaction,
} from '../types'

/** Types de compte porteurs d'intérêts (calcul automatique à la quinzaine). */
export const INTEREST_BEARING_TYPES: AccountType[] = ['LIVRET_A', 'LDDS', 'LIVRET_PLUS']

export function isInterestBearing(type: AccountType): boolean {
  return INTEREST_BEARING_TYPES.includes(type)
}

// ---------------------------------------------------------------------------
// Moteur de calcul du portefeuille (fonctions pures, testables).
// Toutes les valeurs monétaires agrégées sont converties dans la devise
// principale (EUR par défaut) via une table de change simple.
// ---------------------------------------------------------------------------

/** Taux de change : multiplie un montant de la devise donnée pour obtenir des EUR. */
export type FxTable = Record<Currency, number>
export const DEFAULT_FX: FxTable = { EUR: 1, USD: 0.92 }

export function toEur(amount: number, currency: Currency, fx: FxTable = DEFAULT_FX): number {
  return amount * (fx[currency] ?? 1)
}

function key(assetId: string, accountId: string): string {
  return `${assetId}::${accountId}`
}

interface Lot {
  quantity: number
  totalCost: number // dans la devise de l'actif, frais inclus
  feesPaid: number
  realizedPnL: number
  dividends: number
}

/**
 * Calcule les positions courantes à partir des transactions.
 * @param priceByAssetId cours actuel par actif (devise de l'actif).
 */
export function computePositions(
  transactions: Transaction[],
  accounts: Account[],
  assets: Asset[],
  priceByAssetId: Record<string, number | null>,
  fx: FxTable = DEFAULT_FX,
): Position[] {
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const lots = new Map<string, Lot>()

  const ordered = [...transactions]
    .filter((t) => t.assetId && (t.type === 'BUY' || t.type === 'SELL' || t.type === 'DIVIDEND'))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  for (const t of ordered) {
    if (!t.assetId) continue
    const k = key(t.assetId, t.accountId)
    const lot = lots.get(k) ?? { quantity: 0, totalCost: 0, feesPaid: 0, realizedPnL: 0, dividends: 0 }
    const fees = t.fees ?? 0

    if (t.type === 'BUY') {
      const cost = (t.quantity ?? 0) * (t.price ?? 0) + fees
      lot.quantity += t.quantity ?? 0
      lot.totalCost += cost
      lot.feesPaid += fees
    } else if (t.type === 'SELL') {
      const qty = t.quantity ?? 0
      const avg = lot.quantity > 0 ? lot.totalCost / lot.quantity : 0
      const proceeds = qty * (t.price ?? 0) - fees
      lot.realizedPnL += proceeds - qty * avg
      lot.quantity -= qty
      lot.totalCost -= qty * avg
      lot.feesPaid += fees
      if (lot.quantity < 1e-9) {
        lot.quantity = 0
        lot.totalCost = 0
      }
    } else if (t.type === 'DIVIDEND') {
      lot.dividends += t.amount ?? 0
    }
    lots.set(k, lot)
  }

  // Valeur totale (EUR) pour calculer les poids.
  const positions: Position[] = []
  let totalValueEur = 0

  for (const [k, lot] of lots) {
    const [assetId, accountId] = k.split('::')
    const asset = assetMap.get(assetId)
    const account = accountMap.get(accountId)
    if (!asset || !account) continue
    if (lot.quantity <= 0 && lot.realizedPnL === 0 && lot.dividends === 0) continue

    const currentPrice = priceByAssetId[assetId] ?? null
    const averageCost = lot.quantity > 0 ? lot.totalCost / lot.quantity : 0
    const currentValue = currentPrice != null ? currentPrice * lot.quantity : null
    const unrealizedPnL = currentValue != null ? currentValue - lot.totalCost : null
    const performancePct =
      currentValue != null && lot.totalCost > 0 ? (currentValue - lot.totalCost) / lot.totalCost : null

    if (currentValue != null) totalValueEur += toEur(currentValue, asset.currency, fx)

    positions.push({
      assetId,
      accountId,
      asset,
      account,
      quantity: lot.quantity,
      averageCost,
      totalCost: lot.totalCost,
      feesPaid: lot.feesPaid,
      realizedPnL: lot.realizedPnL,
      dividendsReceived: lot.dividends,
      currentPrice,
      currentValue,
      unrealizedPnL,
      performancePct,
      weight: 0,
      currency: asset.currency,
    })
  }

  // Poids
  for (const p of positions) {
    if (p.currentValue != null && totalValueEur > 0) {
      p.weight = toEur(p.currentValue, p.currency, fx) / totalValueEur
    }
  }

  // Tri par valeur décroissante
  positions.sort((a, b) => (b.currentValue ?? 0) * (fx[b.currency] ?? 1) - (a.currentValue ?? 0) * (fx[a.currency] ?? 1))
  return positions
}

/** Liquidités disponibles (EUR) = flux de trésorerie cumulés. */
export function computeCash(transactions: Transaction[], fx: FxTable = DEFAULT_FX): number {
  let cash = 0
  for (const t of transactions) {
    const cur = t.currency
    switch (t.type) {
      case 'DEPOSIT':
        cash += toEur(t.amount ?? 0, cur, fx)
        break
      case 'WITHDRAWAL':
        cash -= toEur(t.amount ?? 0, cur, fx)
        break
      case 'BUY':
        cash -= toEur((t.quantity ?? 0) * (t.price ?? 0) + (t.fees ?? 0), cur, fx)
        break
      case 'SELL':
        cash += toEur((t.quantity ?? 0) * (t.price ?? 0) - (t.fees ?? 0), cur, fx)
        break
      case 'DIVIDEND':
        cash += toEur(t.amount ?? 0, cur, fx)
        break
      case 'FEE':
        cash -= toEur(t.amount ?? 0, cur, fx)
        break
    }
  }
  return cash
}

// ---------------------------------------------------------------------------
// Intérêts Livret+ — règle française des quinzaines.
//  - Un versement porte intérêt à partir de la quinzaine SUIVANTE
//    (dépôt du 1–15 → à partir du 16 ; du 16–fin → à partir du 1er du mois suivant).
//  - Un retrait cesse de porter intérêt dès la quinzaine où il intervient
//    (retrait du 1–15 → effet au 1er du mois ; du 16–fin → effet au 16).
//  - Chaque quinzaine rapporte taux/24 sur le solde présent en début de quinzaine.
//  - Les intérêts sont capitalisés une fois par an, au 31/12 (puis composés).
// ---------------------------------------------------------------------------

export interface LivretInterest {
  /** Intérêts des années révolues (capitalisés), = argent réellement crédité. */
  credited: number
  /** Intérêts courus de l'année en cours, pas encore crédités (estimation). */
  accrued: number
}

function quinzaineStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() <= 15 ? 1 : 16)
}
function nextQuinzaine(d: Date): Date {
  return d.getDate() === 1
    ? new Date(d.getFullYear(), d.getMonth(), 16)
    : new Date(d.getFullYear(), d.getMonth() + 1, 1)
}
/** Date de valeur d'un flux selon la règle des quinzaines. */
function valueDate(dateStr: string, isDeposit: boolean): Date {
  const dt = new Date(dateStr)
  const y = dt.getFullYear()
  const m = dt.getMonth()
  const day = dt.getDate()
  if (isDeposit) return day <= 15 ? new Date(y, m, 16) : new Date(y, m + 1, 1)
  return day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16)
}

/**
 * Intérêts d'un Livret+ à partir de flux signés (+versement, −retrait),
 * dans la devise du compte.
 */
export function computeLivretInterest(
  flows: { date: string; amount: number }[],
  rate: number,
  asOf: Date = new Date(),
): LivretInterest {
  if (!rate || rate <= 0 || flows.length === 0) return { credited: 0, accrued: 0 }
  const deltas = flows
    .map((f) => ({ t: valueDate(f.date, f.amount >= 0).getTime(), amount: f.amount }))
    .sort((a, b) => a.t - b.t)
  const perQuinzaine = rate / 24
  let balance = 0
  let yearAcc = 0
  let credited = 0
  let di = 0
  let cur = quinzaineStart(new Date(deltas[0].t))
  const asOfTime = asOf.getTime()
  // Garde-fou : borne le nombre d'itérations (max ~24 quinzaines × 100 ans).
  for (let guard = 0; cur.getTime() <= asOfTime && guard < 2400; guard++) {
    while (di < deltas.length && deltas[di].t <= cur.getTime()) {
      balance += deltas[di].amount
      di++
    }
    if (balance > 0) yearAcc += balance * perQuinzaine
    const nxt = nextQuinzaine(cur)
    if (nxt.getFullYear() !== cur.getFullYear()) {
      // Fin d'année (après la quinzaine du 16 déc.) → capitalisation au 31/12.
      credited += yearAcc
      balance += yearAcc
      yearAcc = 0
    }
    cur = nxt
  }
  return {
    credited: Math.round(credited * 100) / 100,
    accrued: Math.round(yearAcc * 100) / 100,
  }
}

/** Agrège les intérêts Livret+ de tous les comptes concernés (en EUR). */
export function computeAllLivretInterest(
  accounts: Account[],
  transactions: Transaction[],
  fx: FxTable = DEFAULT_FX,
  asOf: Date = new Date(),
): LivretInterest {
  let credited = 0
  let accrued = 0
  for (const acc of accounts) {
    if (!isInterestBearing(acc.type) || !acc.interestRate) continue
    const flows = transactions
      .filter((t) => t.accountId === acc.id && (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL'))
      .map((t) => ({ date: t.date, amount: (t.type === 'DEPOSIT' ? 1 : -1) * (t.amount ?? 0) }))
    const r = computeLivretInterest(flows, acc.interestRate, asOf)
    credited += toEur(r.credited, acc.currency, fx)
    accrued += toEur(r.accrued, acc.currency, fx)
  }
  return { credited: Math.round(credited * 100) / 100, accrued: Math.round(accrued * 100) / 100 }
}

/** Capital investi net (EUR) = dépôts − retraits. */
export function computeInvestedCapital(transactions: Transaction[], fx: FxTable = DEFAULT_FX): number {
  let net = 0
  for (const t of transactions) {
    if (t.type === 'DEPOSIT') net += toEur(t.amount ?? 0, t.currency, fx)
    else if (t.type === 'WITHDRAWAL') net -= toEur(t.amount ?? 0, t.currency, fx)
  }
  return net
}

/** Total des frais payés (EUR) : frais de transaction + transactions FEE. */
export function computeTotalFees(transactions: Transaction[], fx: FxTable = DEFAULT_FX): number {
  let fees = 0
  for (const t of transactions) {
    fees += toEur(t.fees ?? 0, t.currency, fx)
    if (t.type === 'FEE') fees += toEur(t.amount ?? 0, t.currency, fx)
  }
  return fees
}

export function computeDividends(transactions: Transaction[], fx: FxTable = DEFAULT_FX): number {
  return transactions
    .filter((t) => t.type === 'DIVIDEND')
    .reduce((s, t) => s + toEur(t.amount ?? 0, t.currency, fx), 0)
}

function firstTransactionDate(transactions: Transaction[]): string | null {
  if (transactions.length === 0) return null
  return transactions.reduce((min, t) => (t.date < min ? t.date : min), transactions[0].date)
}

/** Résumé global du portefeuille. */
export function computeSummary(
  positions: Position[],
  transactions: Transaction[],
  accounts: Account[] = [],
  fx: FxTable = DEFAULT_FX,
): PortfolioSummary {
  const holdingsValue = positions.reduce(
    (s, p) => s + (p.currentValue != null ? toEur(p.currentValue, p.currency, fx) : 0),
    0,
  )
  const livret = computeAllLivretInterest(accounts, transactions, fx)
  // Les intérêts crédités (années révolues) sont de l'argent réellement disponible → cash.
  const cash = computeCash(transactions, fx) + livret.credited
  const investedCapital = computeInvestedCapital(transactions, fx)
  const unrealizedPnL = positions.reduce(
    (s, p) => s + (p.unrealizedPnL != null ? toEur(p.unrealizedPnL, p.currency, fx) : 0),
    0,
  )
  const realizedPnL = positions.reduce((s, p) => s + toEur(p.realizedPnL, p.currency, fx), 0)
  const dividendsReceived = computeDividends(transactions, fx)
  const feesPaid = computeTotalFees(transactions, fx)
  // Les intérêts courus (année en cours) sont dus mais pas encore versés → dans la valeur totale.
  const totalValue = holdingsValue + cash + livret.accrued

  const totalReturnPct = investedCapital > 0 ? (totalValue - investedCapital) / investedCapital : null

  let annualizedReturnPct: number | null = null
  const first = firstTransactionDate(transactions)
  if (first && totalReturnPct != null) {
    const years = (Date.now() - new Date(first).getTime()) / (365.25 * 86_400_000)
    if (years > 0.05) {
      annualizedReturnPct = Math.pow(1 + totalReturnPct, 1 / years) - 1
    }
  }

  return {
    totalValue,
    investedCapital,
    cash,
    unrealizedPnL,
    realizedPnL,
    dividendsReceived,
    feesPaid,
    totalReturnPct,
    annualizedReturnPct,
    livretInterestCredited: livret.credited,
    livretInterestAccrued: livret.accrued,
    positions,
  }
}

// ---------------------------------------------------------------------------
// Série temporelle de la valeur du portefeuille (pour les graphiques).
// ---------------------------------------------------------------------------

export interface ValuePoint {
  date: string
  totalValue: number
  invested: number
}

function priceOnOrBefore(series: MarketPrice[], date: string): number | null {
  let result: number | null = null
  for (const p of series) {
    if (p.date <= date) result = p.close
    else break
  }
  return result
}

/** Génère des dates de fin de mois entre from et to (inclus). */
export function monthEndDates(from: string, to: string): string[] {
  const out: string[] = []
  const start = new Date(from)
  const end = new Date(to)
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  while (d <= end) {
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    out.push(monthEnd.toISOString().slice(0, 10))
    d.setMonth(d.getMonth() + 1)
  }
  // On termine sur la date "to" exacte.
  const toStr = to
  if (out[out.length - 1] !== toStr) out.push(toStr)
  return out
}

/**
 * Série de valeur du patrimoine dans le temps.
 * @param historicalByAsset séries de prix historiques par assetId (devise actif).
 */
export function computeValueSeries(
  transactions: Transaction[],
  assets: Asset[],
  historicalByAsset: Record<string, MarketPrice[]>,
  accounts: Account[] = [],
  fx: FxTable = DEFAULT_FX,
): ValuePoint[] {
  const first = firstTransactionDate(transactions)
  if (!first) return []
  const today = new Date().toISOString().slice(0, 10)
  const dates = monthEndDates(first, today)
  const assetMap = new Map(assets.map((a) => [a.id, a]))

  return dates.map((date) => {
    const upTo = transactions.filter((t) => t.date <= date)
    // Quantités détenues par actif à cette date.
    const qty = new Map<string, number>()
    for (const t of upTo) {
      if (!t.assetId) continue
      if (t.type === 'BUY') qty.set(t.assetId, (qty.get(t.assetId) ?? 0) + (t.quantity ?? 0))
      else if (t.type === 'SELL') qty.set(t.assetId, (qty.get(t.assetId) ?? 0) - (t.quantity ?? 0))
    }
    let holdings = 0
    for (const [assetId, q] of qty) {
      if (q <= 0) continue
      const asset = assetMap.get(assetId)
      if (!asset) continue
      const price = priceOnOrBefore(historicalByAsset[assetId] ?? [], date)
      if (price != null) holdings += toEur(price * q, asset.currency, fx)
    }
    const cash = computeCash(upTo, fx)
    const invested = computeInvestedCapital(upTo, fx)
    const livret = computeAllLivretInterest(accounts, upTo, fx, new Date(date))
    return {
      date,
      totalValue: Math.round((holdings + cash + livret.credited + livret.accrued) * 100) / 100,
      invested: Math.round(invested * 100) / 100,
    }
  })
}
